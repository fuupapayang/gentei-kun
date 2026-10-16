'use strict';
// Runs the Express app (in-memory store fake) on a local port and exercises every endpoint group.
const assert = require('assert');
const { createApp } = require('../app');
const { memoryStore } = require('../lib/store');

const PORT = Number(process.env.TEST_PORT || 3295);
const sent = [];
const store = memoryStore();
let pw = 'secret-pw';
const app = createApp({
  store,
  getAdminPassword: () => pw,
  getAllowedOrigins: () => ['https://user.github.io'],
  getVapidSubject: () => 'mailto:t@example.com',
  sendNotification: async (sub, payload) => { if (sub.endpoint.includes('gone')) { const e = new Error('gone'); e.statusCode = 410; throw e; } sent.push(JSON.parse(payload)); },
});
const server = app.listen(PORT);
const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, h = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...h }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) { /* none */ }
  return { s: r.status, j, r };
};
const DEMO = { 'x-customer-token': 'demo-token-gentei-0001' };
(async () => {
  let r = await call('GET', '/api/property'); assert.equal(r.s, 200); assert.equal(r.j.id, 'p0061');
  r = await call('GET', '/property'); assert.equal(r.s, 200, 'no /api prefix'); 
  r = await call('GET', '/api/api/property'); assert.equal(r.s, 200, 'doubled prefix');
  assert.equal(store._m.contents.size, 11); assert.equal(store._m.customers.size, 8); assert.equal((await call('GET', '/api/vapid-public-key')).j.key.length > 40, true);
  // CORS
  r = await call('OPTIONS', '/api/me', { h: { origin: 'https://user.github.io', 'access-control-request-method': 'GET' } });
  assert.equal(r.s, 204); assert.equal(r.r.headers.get('access-control-allow-origin'), 'https://user.github.io');
  r = await call('OPTIONS', '/api/me', { h: { origin: 'https://evil.example' } }); assert.equal(r.s, 403);
  r = await call('GET', '/api/property', { h: { origin: 'https://evil.example' } }); assert.equal(r.r.headers.get('access-control-allow-origin'), null);
  // customer
  r = await call('GET', '/api/me'); assert.equal(r.s, 401);
  r = await call('GET', '/api/me', { h: DEMO }); assert.equal(r.s, 200); assert.equal(r.j.customer.name, '山田 太郎');
  r = await call('GET', '/api/contents', { h: DEMO }); assert.equal(r.s, 200);
  assert.ok(r.j.contents.length && r.j.contents.every((c) => c.active) && r.j.personalFiles.length === 2);
  assert.ok(!r.j.contents.some((c) => c.title.startsWith('VIP限定')), 'tag filter');
  r = await call('GET', '/api/pushes', { h: DEMO }); assert.equal(r.s, 200); assert.ok(r.j.length >= 1);
  r = await call('POST', '/api/push/subscribe', { h: DEMO, body: { subscription: { endpoint: 'http://bad' } } }); assert.equal(r.s, 400);
  r = await call('POST', '/api/push/subscribe', { h: DEMO, body: { platform: 'ios', subscription: { endpoint: 'https://push.example/ok', keys: { p256dh: 'a', auth: 'b' } } } }); assert.equal(r.j.ok, true);
  r = await call('POST', '/api/event', { h: DEMO, body: { type: 'bogus' } }); assert.equal(r.s, 400);
  r = await call('POST', '/api/event', { h: DEMO, body: { type: 'content', target: 'CGギャラリー' } }); assert.equal(r.j.ok, true);
  r = await call('POST', '/api/register', { body: { name: 'x', email: 'bad' } }); assert.equal(r.s, 400);
  r = await call('POST', '/api/register', { body: { name: '新規 太郎', email: 'New@Example.com', tags: ['VIP'] } }); assert.ok(r.j.token);
  const newTok = r.j.token, newId = r.j.customer.id;
  r = await call('POST', '/api/register', { body: { name: '新規 太郎2', email: 'new@example.com', tags: ['来場予約'] } });
  assert.equal(r.j.customer.id, newId); assert.deepEqual(r.j.customer.tags, ['VIP', '来場予約']);
  r = await call('GET', '/api/contents', { h: { 'x-customer-token': newTok } }); assert.ok(r.j.contents.some((c) => c.title.startsWith('VIP限定')));
  // admin
  const A = {};
  r = await call('GET', '/api/admin/dashboard'); assert.equal(r.s, 401);
  r = await call('POST', '/api/admin/login', { body: { password: 'nope' } }); assert.equal(r.s, 401);
  pw = ''; r = await call('POST', '/api/admin/login', { body: { password: '' } }); assert.equal(r.s, 503, 'unset password refuses login'); pw = 'secret-pw';
  r = await call('POST', '/api/admin/login', { body: { password: 'admin' } }); assert.equal(r.s, 401, 'no default admin');
  r = await call('POST', '/api/admin/login', { body: { password: 'secret-pw' } }); assert.equal(r.s, 200); A['x-admin-token'] = r.j.token;
  assert.equal(store._m.adminSessions.size, 1);
  r = await call('GET', '/api/admin/dashboard', { h: A }); assert.equal(r.s, 200); assert.equal(r.j.customers, 9); assert.equal(r.j.pushesSent, 3);
  assert.ok(r.j.events7d > 0 && r.j.installed >= 6 && r.j.conversions === 5);
  r = await call('GET', '/api/admin/customers', { h: A }); assert.equal(r.j.length, 9); assert.ok(r.j.find((c) => c.id === 'c001').eventCount > 20);
  assert.equal(r.j.find((c) => c.id === 'c001').hasPush, true);
  r = await call('PUT', '/api/admin/customers/c002', { h: A, body: { status: '商談中', memo: 'm', tags: ['VIP'] } }); assert.equal(r.j.status, '商談中');
  r = await call('GET', '/api/admin/customers/c002', { h: A }); assert.deepEqual(r.j.tags, ['VIP']);
  r = await call('GET', '/api/admin/customers/zzz', { h: A }); assert.equal(r.s, 404);
  r = await call('POST', '/api/admin/customers/c002/files', { h: A, body: { title: 't', url: 'https://x', kind: 'link' } }); assert.equal(r.s, 201); const fid = r.j.id;
  r = await call('GET', '/api/admin/customers/c002/files', { h: A }); assert.equal(r.j.length, 1);
  r = await call('DELETE', `/api/admin/customers/c002/files/${fid}`, { h: A }); assert.equal(r.j.ok, true);
  r = await call('GET', '/api/admin/customers/c001/events', { h: A }); assert.ok(r.j.length > 20 && r.j[0].at >= r.j[1].at);
  r = await call('GET', '/api/admin/customers/c003/summary', { h: A }); assert.ok(r.j.overview.headline && r.j.stats.events > 0 && Array.isArray(r.j.timeline));
  // contents
  r = await call('POST', '/api/admin/contents', { h: A, body: { title: 'New', type: 'bogus' } }); assert.equal(r.s, 400);
  r = await call('POST', '/api/admin/contents', { h: A, body: { title: 'New', type: 'link', url: 'https://n', targetTags: ['VIP'] } }); assert.equal(r.s, 201); assert.equal(r.j.order, 12); const cid = r.j.id;
  r = await call('PUT', `/api/admin/contents/${cid}`, { h: A, body: { active: false } }); assert.equal(r.j.active, false);
  r = await call('GET', '/api/admin/contents', { h: A }); assert.equal(r.j.length, 12);
  r = await call('DELETE', `/api/admin/contents/${cid}`, { h: A }); assert.equal(r.j.ok, true);
  // tags + propagation
  r = await call('POST', '/api/admin/tags', { h: A, body: { name: 'VIP' } }); assert.equal(r.s, 409);
  r = await call('POST', '/api/admin/tags', { h: A, body: { name: '新タグ', color: '#123456' } }); assert.equal(r.s, 201);
  r = await call('PUT', '/api/admin/tags/t004', { h: A, body: { name: 'VVIP' } }); assert.equal(r.j.name, 'VVIP');
  r = await call('GET', '/api/admin/customers/c003', { h: A }); assert.ok(r.j.tags.includes('VVIP') && !r.j.tags.includes('VIP'));
  r = await call('GET', '/api/admin/contents', { h: A }); assert.ok(r.j.find((c) => c.id === 'ct009').targetTags.includes('VVIP'));
  r = await call('DELETE', '/api/admin/tags/t004', { h: A }); assert.equal(r.j.ok, true);
  r = await call('GET', '/api/admin/customers/c003', { h: A }); assert.ok(!r.j.tags.includes('VVIP'));
  r = await call('GET', '/api/admin/tags', { h: A }); assert.equal(r.j.length, 5);
  // conversions
  r = await call('POST', '/api/admin/conversions', { h: A, body: { customerId: 'nope', kind: 'document' } }); assert.equal(r.s, 400);
  r = await call('POST', '/api/admin/conversions', { h: A, body: { customerId: 'c001', kind: 'document', note: 'n' } }); assert.equal(r.s, 201);
  r = await call('GET', '/api/admin/conversions', { h: A }); assert.equal(r.j.length, 6);
  // property
  r = await call('PUT', '/api/admin/property', { h: A, body: { gtmId: 'bad' } }); assert.equal(r.s, 400);
  r = await call('PUT', '/api/admin/property', { h: A, body: { gtmId: 'GTM-ABC123', tagline: 'T' } }); assert.equal(r.j.gtmId, 'GTM-ABC123');
  assert.equal((await call('GET', '/api/property')).j.tagline, 'T');
  // pushes + send
  r = await call('POST', '/api/admin/pushes', { h: A, body: { title: 'Hello', body: 'b', targetTags: [] } }); assert.equal(r.s, 201); const pid = r.j.id;
  r = await call('PUT', `/api/admin/pushes/${pid}`, { h: A, body: { body: 'b2' } }); assert.equal(r.j.body, 'b2');
  await call('POST', '/api/push/subscribe', { h: { 'x-customer-token': newTok }, body: { subscription: { endpoint: 'https://push.example/gone', keys: { p256dh: 'a', auth: 'b' } } } });
  r = await call('POST', `/api/admin/pushes/${pid}/send`, { h: A }); assert.equal(r.s, 200);
  assert.equal(r.j.sentCount, 1); assert.equal(r.j.removed, 1); assert.equal(r.j.targets, 2); assert.equal(sent[0].title, 'Hello');
  assert.equal((await call('GET', `/api/admin/customers/${newId}`, { h: A })).j.hasPush, false);
  r = await call('GET', '/api/admin/pushes', { h: A }); assert.equal(r.j.find((p) => p.id === pid).status, 'sent');
  r = await call('DELETE', `/api/admin/pushes/${pid}`, { h: A }); assert.equal(r.j.ok, true);
  r = await call('GET', '/api/nothing'); assert.equal(r.s, 404);
  r = await fetch(base + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' }); assert.equal(r.status, 400);
  // expired session
  const sk = [...store._m.adminSessions.keys()][0]; store._m.adminSessions.get(sk).exp = 1;
  r = await call('GET', '/api/admin/dashboard', { h: A }); assert.equal(r.s, 401);
  // seed idempotency / migration: bump older version
  store._m.meta.set('main', { seedVersion: 1 }); store._m.contents.clear();
  const { ensureSeeded } = require('../lib/store');
  await ensureSeeded(Object.assign(store, { tryLock: async () => true }), { generateVapid: () => { throw new Error('vapid must persist'); } });
  assert.equal(store._m.contents.size, 11); assert.equal(store._m.customers.size, 9, 'customers kept on migration');
  console.log('ALL OK');
  server.close();
})().catch((e) => { console.error('FAIL', e); server.close(); process.exit(1); });
