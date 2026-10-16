#!/usr/bin/env node
/* Unit test for public/firebase-api.js against an in-memory fake Firebase SDK (no network, no emulator).
 *   node scripts/test-firebase-api.js
 * The fake also mirrors the intent of firestore.rules (customer/admin/anonymous permissions) so that the shim
 * is proven never to need more rights than the rules grant. (The rules text itself is NOT executed here.) */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const ADMIN = 'boss@example.com';
const store = new Map(); // col -> Map(id -> data)
const col = (n) => { if (!store.has(n)) store.set(n, new Map()); return store.get(n); };
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
let seq = 0;

const rulesLog = [];
function userOf(db) { return db.auth.currentUser; }
const isAdminU = (u) => !!(u && u.email && u.email.toLowerCase() === ADMIN);
const isCust = (u) => !!(u && u.anonymous);
const denied = (msg) => { const e = new Error('rules: ' + msg); e.code = 'permission-denied'; throw e; };
function checkRead(db, cname, id, q, data) { // q = list of {field,op,v} for list queries, null for get
  const u = userOf(db); if (isAdminU(u)) return;
  if (cname === 'property' || (cname === 'settings' && id === 'public')) { if (id) return; denied('list ' + cname); }
  if (!isCust(u)) denied('read ' + cname + ' as ' + (u ? 'non-admin' : 'unauth'));
  const has = (f, v) => q && q.some((c) => c.field === f && c.op === '==' && c.v === v);
  if (cname === 'contents') { if (id ? data && data.active === true : has('active', true)) return; denied('contents list needs active==true'); }
  if (cname === 'pushes') { if (id ? data && data.status === 'sent' : has('status', 'sent')) return; denied('pushes list needs status==sent'); }
  if (cname === 'personalFiles') { if (id ? data && data.customerId === u.uid : has('customerId', u.uid)) return; denied('personalFiles needs customerId==uid'); }
  if (cname === 'customers' && id === u.uid) return;
  denied('read ' + cname);
}
const EVT = ['login', 'page', 'content', 'push_open', 'install', 'vr', 'library'];
function checkWrite(db, op, cname, id, data, existing) {
  const u = userOf(db); if (isAdminU(u)) return;
  if (!isCust(u)) denied('write ' + cname + ' unauth');
  if (cname === 'events' && op === 'create') {
    const k = Object.keys(data);
    if (k.every((x) => ['customerId', 'type', 'target', 'at'].includes(x)) && data.customerId === u.uid && EVT.includes(data.type) && typeof data.target === 'string') return;
    denied('event shape');
  }
  if (cname === 'customers' && id === u.uid) {
    if (op === 'create') {
      const okKeys = ['name', 'email', 'tags', 'status', 'assignee', 'memo', 'createdAt', 'lastSeenAt', 'pushSub', 'installed', 'platform'];
      if (Object.keys(data).every((x) => okKeys.includes(x)) && data.status === '新規' && data.assignee === '' && data.memo === '' && Array.isArray(data.tags) && data.tags.length <= 10 && data.pushSub === null && data.installed === false && data.platform === 'pc') return;
      denied('customer create shape');
    }
    if (op === 'update') {
      const changed = Object.keys(data).filter((k) => JSON.stringify(data[k]) !== JSON.stringify(existing[k]));
      if (changed.every((k) => ['name', 'email', 'lastSeenAt', 'pushSub', 'installed', 'platform'].includes(k))) return;
      denied('customer update keys ' + changed);
    }
  }
  denied('write ' + op + ' ' + cname);
}

// ---- fake SDK ----
function mkAuth() {
  const a = { currentUser: null, authStateReady: async () => {} };
  return a;
}
const accounts = { [ADMIN]: 'pw-correct' };
const sdk = {
  app: { initializeApp: (cfg, name) => ({ cfg, name, auth: mkAuth() }) },
  auth: {
    getAuth: (app) => app.auth,
    signInAnonymously: async (a) => { a.currentUser = { uid: 'anon' + ++seq, anonymous: true, email: null }; return { user: a.currentUser }; },
    signInWithEmailAndPassword: async (a, e, p) => { if (accounts[e.toLowerCase()] !== p) { const er = new Error('bad'); er.code = 'auth/invalid-credential'; throw er; } a.currentUser = { uid: 'adm', email: e }; return { user: a.currentUser }; },
    signOut: async (a) => { a.currentUser = null; },
  },
  fs: {
    getFirestore: (app) => ({ app, auth: app.auth }),
    collection: (db, name) => ({ type: 'col', db, name }),
    doc: (a, c, i) => (a.type === 'col' ? { type: 'doc', db: a.db, col: a.name, id: 'auto' + ++seq } : { type: 'doc', db: a, col: c, id: i }),
    where: (field, op, v) => ({ field, op, v }),
    query: (c, ...cs) => ({ type: 'q', col: c, cs }),
    getDoc: async (r) => { const d = col(r.col).get(r.id); checkRead(r.db, r.col, r.id, null, d); return { id: r.id, exists: () => d !== undefined, data: () => clone(d) }; },
    getDocs: async (qq) => {
      const c = qq.type === 'q' ? qq.col : qq; const cs = qq.type === 'q' ? qq.cs : [];
      checkRead(c.db, c.name, null, cs);
      const docs = [];
      for (const [id, d] of col(c.name)) {
        if (cs.every((w) => (w.op === '==' ? d[w.field] === w.v : w.op === '>=' ? d[w.field] >= w.v : w.op === 'array-contains' ? (d[w.field] || []).includes(w.v) : false))) docs.push({ id, data: () => clone(d) });
      }
      return { docs, size: docs.length };
    },
    getCountFromServer: async (qq) => { const s = await sdk.fs.getDocs(qq); return { data: () => ({ count: s.size }) }; },
    setDoc: async (r, data) => { const ex = col(r.col).get(r.id); checkWrite(r.db, ex ? 'update' : 'create', r.col, r.id, clone(data), ex); col(r.col).set(r.id, clone(data)); },
    updateDoc: async (r, data) => { const ex = col(r.col).get(r.id); if (!ex) throw new Error('no doc'); const n = Object.assign({}, ex, clone(data)); checkWrite(r.db, 'update', r.col, r.id, n, ex); col(r.col).set(r.id, n); },
    deleteDoc: async (r) => { checkWrite(r.db, 'delete', r.col, r.id, null, null); col(r.col).delete(r.id); },
    addDoc: async (c, data) => { const id = 'auto' + ++seq; checkWrite(c.db, 'create', c.name, id, clone(data)); col(c.name).set(id, clone(data)); return { id }; },
    writeBatch: (db) => { const ops = []; return {
      set: (r, d) => ops.push(() => sdk.fs.setDoc({ ...r, db }, d)),
      update: (r, d) => ops.push(() => sdk.fs.updateDoc({ ...r, db }, d)),
      delete: (r) => ops.push(() => sdk.fs.deleteDoc({ ...r, db })),
      commit: async () => { for (const o of ops) await o(); }, }; },
  },
};
// writeBatch.set/update receive refs created with db in scope already; keep db from ref
sdk.fs.writeBatch = (db) => { const ops = []; return {
  set: (r, d) => ops.push(() => sdk.fs.setDoc(r, d)), update: (r, d) => ops.push(() => sdk.fs.updateDoc(r, d)),
  delete: (r) => ops.push(() => sdk.fs.deleteDoc(r)), commit: async () => { for (const o of ops) await o(); } }; };

// ---- load shim exactly like the browser would ----
globalThis.GENTEI_CONFIG = { apiBase: 'firebase', firebase: { apiKey: 'k', projectId: 'demo', appId: 'a' }, adminEmails: [ADMIN] };
globalThis.__GENTEI_FIREBASE_SDK__ = sdk;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'public/config.js'), 'utf8'), { filename: 'config.js' });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'public/firebase-api.js'), 'utf8'), { filename: 'firebase-api.js' });

// raw admin-side seeding (bypasses the shim and rules)
const put = (c, id, d) => col(c).set(id, clone(d));
const iso = (t) => new Date(t).toISOString();
const now = Date.now(), DAY = 86400000;
put('property', 'main', { id: 'p0061', name: 'グランレ・ジェイド葉山', tagline: 'tag', heroImage: '/assets/img/top_mv.jpg', gtmId: '' });
put('settings', 'public', { vapidPublicKey: 'BPUBKEY' });
put('tags', 't001', { id: 't001', name: '来場予約', color: '#c00000' });
put('tags', 't002', { id: 't002', name: '資金計画', color: '#0b3d91' });
put('contents', 'ct1', { id: 'ct1', title: '全員向けVR', type: 'vr', url: '', thumb: '', targetTags: [], active: true, order: 2, updatedAt: iso(now) });
put('contents', 'ct2', { id: 'ct2', title: '資金計画シミュレーション', type: 'link', url: '', thumb: '', targetTags: ['資金計画'], active: true, order: 1, updatedAt: iso(now) });
put('contents', 'ct3', { id: 'ct3', title: '停止中', type: 'pdf', url: '', thumb: '', targetTags: [], active: false, order: 3, updatedAt: iso(now) });
put('pushes', 'ps1', { id: 'ps1', title: '全員へ', body: 'b', url: '/', targetTags: [], createdAt: iso(now - 3 * DAY), status: 'sent', sentCount: 5 });
put('pushes', 'ps2', { id: 'ps2', title: '資金計画の方へ', body: 'b', url: '/', targetTags: ['資金計画'], createdAt: iso(now - 2 * DAY), status: 'sent', sentCount: 2 });
put('pushes', 'ps3', { id: 'ps3', title: '下書き', body: 'b', url: '/', targetTags: [], createdAt: iso(now - DAY), status: 'draft', sentCount: 0 });

const FB = globalThis.GenteiFirebaseApi.FB_ROOT;
const call = async (m, p, body, as) => {
  const r = await fetch(gApi(p), { method: m, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json(); return { status: r.status, j };
};
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); n++; };

(async () => {
  ok(gApi('/x') === FB + '/x', 'gApi returns the intercepted root');
  ok(fetch.__gentei_fb, 'fetch interceptor installed');
  eq((await call('GET', '/property')).j.name, 'グランレ・ジェイド葉山');
  eq((await call('GET', '/property')).j.id, 'p0061');
  eq((await call('GET', '/vapid-public-key')).j, { key: 'BPUBKEY' });

  // customer before registering
  eq((await call('GET', '/me')).status, 401);
  eq((await call('GET', '/contents')).status, 401);
  eq((await call('POST', '/register', { name: '', email: 'a@b.co' })).status, 400);
  eq((await call('POST', '/register', { name: 'x', email: 'bad' })).status, 400);

  const reg = await call('POST', '/register', { name: '山田太郎', email: 'Yamada@Example.com' });
  eq(reg.status, 200);
  ok(reg.j.token && reg.j.customer.id === reg.j.token && reg.j.customer.email === 'yamada@example.com' && reg.j.customer.status === '新規', 'register shape');
  const uid = reg.j.token;
  const me = await call('GET', '/me'); eq(me.status, 200);
  ok(me.j.customer.name === '山田太郎' && me.j.property.id === 'p0061', '/me shape');
  eq((await call('POST', '/register', { name: '山田次郎', email: 'yamada@example.com' })).j.token, uid, 'same browser re-register keeps uid');
  eq((await call('GET', '/me')).j.customer.name, '山田次郎');

  let cs = (await call('GET', '/contents')).j;
  eq(cs.contents.map((c) => c.id), ['ct1'], 'untagged customer sees only untargeted+active');
  eq(cs.personalFiles, []);
  eq((await call('GET', '/pushes')).j.map((p) => p.id), ['ps1'], 'only sent + matching pushes');

  // ---- admin ----
  eq((await call('GET', '/admin/customers')).status, 401, 'admin route w/o login');
  eq((await call('POST', '/admin/login', { email: ADMIN, password: 'nope' })).status, 401);
  eq((await call('POST', '/admin/login', { email: 'x@y.zz', password: 'pw-correct' })).status, 401);
  const lg = await call('POST', '/admin/login', { email: 'BOSS@example.com', password: 'pw-correct' });
  eq(lg.status, 200); ok(lg.j.token, 'login token');

  const custs = (await call('GET', '/admin/customers')).j;
  eq(custs.length, 1); ok(custs[0].eventCount === 2 && custs[0].hasPush === false && custs[0].id === uid, 'customers list shape');
  eq((await call('GET', '/admin/customers/zzz')).status, 404);
  const put1 = await call('PUT', `/admin/customers/${uid}`, { tags: ['資金計画', '資金計画', 'VIP'], status: '商談中', assignee: '佐藤', memo: 'メモ' });
  eq(put1.j.tags, ['資金計画', 'VIP']); eq(put1.j.status, '商談中');

  cs = (await call('GET', '/contents')).j;
  eq(cs.contents.map((c) => c.id), ['ct2', 'ct1'], 'tag unlocks targeted content, order respected');
  eq((await call('GET', '/pushes')).j.map((p) => p.id), ['ps2', 'ps1']);

  // personal files
  const f1 = await call('POST', `/admin/customers/${uid}/files`, { title: '間取り', url: 'https://x/y.pdf', kind: 'file' });
  eq(f1.status, 201); eq((await call('POST', `/admin/customers/${uid}/files`, { title: '', url: '' })).status, 400);
  eq((await call('GET', '/contents')).j.personalFiles.map((f) => f.title), ['間取り']);
  eq((await call('DELETE', `/admin/customers/${uid}/files/${f1.j.id}`)).j, { ok: true });
  eq((await call('DELETE', `/admin/customers/${uid}/files/${f1.j.id}`)).status, 404);

  // customer actions
  eq((await call('POST', '/event', { type: 'bogus' })).status, 400);
  for (const [t, tg] of [['login', 'ios'], ['content', 'ct1'], ['vr', 'ct1'], ['content', 'ct2'], ['library', ''], ['install', 'ios']]) eq((await call('POST', '/event', { type: t, target: tg })).j, { ok: true });
  eq((await call('POST', '/push/subscribe', { subscription: { endpoint: 'http://no' }, platform: 'ios' })).status, 400);
  eq((await call('POST', '/push/subscribe', { subscription: { endpoint: 'https://push/x', expirationTime: null, keys: { p256dh: 'a', auth: 'b' } }, platform: 'ios' })).j, { ok: true });
  const after = (await call('GET', `/admin/customers/${uid}`)).j;
  ok(after.installed === true && after.platform === 'ios' && after.hasPush === true, 'subscribe/install reflected');
  eq((await call('GET', '/admin/customers')).j[0].eventCount, 8);
  const evs = (await call('GET', `/admin/customers/${uid}/events`)).j;
  eq(evs.length, 8); ok(evs[0].at >= evs[evs.length - 1].at, 'events newest first');

  // summary == lib/summary.js
  const { ruleSummary } = require(path.join(ROOT, 'lib/summary.js'));
  const sum = (await call('GET', `/admin/customers/${uid}/summary`)).j;
  const cust = (await call('GET', `/admin/customers/${uid}`)).j;
  const allC = (await call('GET', '/admin/contents')).j;
  eq(sum, ruleSummary(cust, evs, allC, []), 'summary identical to lib/summary.js');
  ok(sum.overview.headline && sum.stats.events === 8, 'summary shape');
  eq((await call('GET', '/admin/customers/zzz/summary')).status, 404);

  // pushes CRUD + send=queue
  const np = await call('POST', '/admin/pushes', { title: '新着', body: '本文', url: '', targetTags: ['VIP'] });
  eq(np.status, 201); ok(np.j.status === 'draft' && np.j.url === '/' && np.j.sentCount === 0, 'new push shape');
  eq((await call('POST', '/admin/pushes', { title: ' ' })).status, 400);
  eq((await call('PUT', `/admin/pushes/${np.j.id}`, { body: '更新' })).j.body, '更新');
  const snd = await call('POST', `/admin/pushes/${np.j.id}/send`);
  ok(snd.status === 200 && snd.j.queued === true && snd.j.push.status === 'queued' && snd.j.sentCount === 0, 'send queues');
  eq(col('pushes').get(np.j.id).status, 'queued'); ok(col('pushes').get(np.j.id).queuedAt, 'queuedAt');
  eq((await call('GET', '/pushes')).j.some((p) => p.id === np.j.id), false, 'queued is not visible to customers');
  col('pushes').get(np.j.id).status = 'sent'; col('pushes').get(np.j.id).sentCount = 3; // what the GitHub Action does
  eq((await call('GET', '/pushes')).j.some((p) => p.id === np.j.id), true, 'sent+matching visible');
  eq((await call('POST', '/admin/pushes/none/send')).status, 404);
  eq((await call('GET', '/admin/pushes')).j.length, 4);
  eq((await call('DELETE', `/admin/pushes/${np.j.id}`)).j, { ok: true });

  // contents CRUD
  const nc = await call('POST', '/admin/contents', { title: '新コンテンツ', type: 'gallery', gallery: [{ title: 'a', src: 'x.jpg' }, { src: '' }], targetTags: ['来場予約'] });
  eq(nc.status, 201); ok(nc.j.order === 4 && nc.j.active === true && nc.j.gallery.length === 1, 'content create');
  eq((await call('POST', '/admin/contents', { title: 'x', type: 'bad' })).status, 400);
  eq((await call('PUT', `/admin/contents/${nc.j.id}`, { active: false, order: 9 })).j.active, false);
  eq((await call('GET', '/contents')).j.contents.some((c) => c.id === nc.j.id), false, 'inactive hidden');
  eq((await call('DELETE', `/admin/contents/${nc.j.id}`)).j, { ok: true });
  eq((await call('PUT', '/admin/contents/none', {})).status, 404);

  // tags: create, dup, rename propagation, delete propagation
  const nt = await call('POST', '/admin/tags', { name: 'テスト', color: 'zzz' });
  eq(nt.status, 201); eq(nt.j.color, '#0b3d91');
  eq((await call('POST', '/admin/tags', { name: 'テスト' })).status, 409);
  await call('PUT', `/admin/customers/${uid}`, { tags: ['資金計画', 'テスト'] });
  eq((await call('PUT', `/admin/tags/${nt.j.id}`, { name: 'テスト2', color: '#112233' })).j.name, 'テスト2');
  eq((await call('GET', `/admin/customers/${uid}`)).j.tags, ['資金計画', 'テスト2'], 'rename propagates to customers');
  eq((await call('PUT', `/admin/tags/${nt.j.id}`, { name: '資金計画' })).status, 409);
  eq((await call('DELETE', `/admin/tags/${nt.j.id}`)).j, { ok: true });
  eq((await call('GET', `/admin/customers/${uid}`)).j.tags, ['資金計画'], 'delete propagates');
  eq((await call('GET', '/admin/tags')).j.length, 2);

  // conversions + dashboard + property
  eq((await call('POST', '/admin/conversions', { customerId: 'nope', kind: 'document' })).status, 400);
  eq((await call('POST', '/admin/conversions', { customerId: uid, kind: 'bad' })).status, 400);
  const cv = await call('POST', '/admin/conversions', { customerId: uid, kind: 'visit_reserve', note: 'n' });
  eq(cv.status, 201); eq((await call('GET', '/admin/conversions')).j.length, 1);
  const dash = (await call('GET', '/admin/dashboard')).j;
  eq(dash, { customers: 1, installed: 1, pushesSent: 2, events7d: 8, conversions: 1 });
  eq((await call('PUT', '/admin/property', { name: '' })).status, 400);
  eq((await call('PUT', '/admin/property', { gtmId: 'bad' })).status, 400);
  const pr = await call('PUT', '/admin/property', { tagline: '新', gtmId: 'GTM-ABC12' });
  ok(pr.j.tagline === '新' && pr.j.gtmId === 'GTM-ABC12' && pr.j.id === 'p0061', 'property put');
  eq((await call('GET', '/property')).j.tagline, '新');
  eq((await call('GET', '/admin/nope')).status, 404);

  // admin sign-out -> 401 again; customer session independent of admin session
  await globalThis.GenteiFirebaseApi.signOutAdmin();
  eq((await call('GET', '/admin/customers')).status, 401, 'after sign-out');
  eq((await call('GET', '/me')).status, 200, 'customer identity unaffected by admin sign-out');

  // rules mirror: the escalation attempts a malicious customer could make directly are rejected
  const cdb = sdk.fs.getFirestore({ auth: { currentUser: { uid, anonymous: true } } });
  const ref = sdk.fs.doc(cdb, 'customers', uid);
  for (const bad of [{ tags: ['VIP'] }, { status: '成約' }, { assignee: 'x' }, { memo: 'm' }]) {
    let threw = false; try { await sdk.fs.updateDoc(ref, bad); } catch (e) { threw = e.code === 'permission-denied'; }
    ok(threw, 'escalation rejected: ' + Object.keys(bad));
  }
  for (const [c, id] of [['customers', 'other'], ['events', null], ['tags', 't001'], ['pushes', 'ps3']]) {
    let threw = false; try { id ? await sdk.fs.getDoc(sdk.fs.doc(cdb, c, id)) : await sdk.fs.getDocs(sdk.fs.collection(cdb, c)); } catch (e) { threw = true; }
    ok(threw, 'customer cannot read ' + c);
  }

  console.log(`OK  firebase-api shim: ${n} assertions passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
