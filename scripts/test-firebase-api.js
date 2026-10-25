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
  if (cname === 'personalFiles') { // own files OR the primary's (customers/{uid}.primaryId)
    const prim = (col('customers').get(u.uid) || {}).primaryId || '-';
    if (id ? data && (data.customerId === u.uid || data.customerId === prim) : (has('customerId', u.uid) || has('customerId', prim))) return;
    denied('personalFiles needs customerId==uid|primaryId');
  }
  if (cname === 'claimCodes') { if (id) return; denied('claimCodes can not be listed'); } // single get only
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
  if (cname === 'claimCodes' && op === 'create') {
    const okK = ['uid', 'name', 'email', 'tags', 'createdAt'];
    if (/^[A-Z0-9]{8}$/.test(id) && Object.keys(data).every((x) => okK.includes(x)) && ['uid', 'name', 'email', 'tags'].every((x) => x in data) && data.uid === u.uid && Array.isArray(data.tags) && data.tags.length <= 10) return;
    denied('claimCodes create shape');
  }
  if (cname === 'customers' && id === u.uid) {
    if (op === 'create') {
      const okKeys = ['name', 'email', 'tags', 'status', 'assignee', 'memo', 'createdAt', 'lastSeenAt', 'pushSub', 'installed', 'platform', 'primaryId', 'claimCode'];
      const hasP = 'primaryId' in data, hasC = 'claimCode' in data;
      if (hasP || hasC) { // only when the claim code really belongs to that primary
        const cc = hasC && typeof data.claimCode === 'string' && /^[A-Z0-9]{8}$/.test(data.claimCode) ? col('claimCodes').get(data.claimCode) : null;
        if (!(hasP && hasC && cc && cc.uid === data.primaryId)) denied('customer create: primaryId must match claimCode owner');
      }
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
const apps = {};
const sdk = {
  app: { initializeApp: (cfg, name) => (apps[name] = { cfg, name, auth: mkAuth() }) },
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
// the shim reads aplika.claimCode from localStorage when it exists (browser only): fake one
const lsMap = new Map();
globalThis.document = {};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: { getItem: (k) => (lsMap.has(k) ? lsMap.get(k) : null), setItem: (k, v) => lsMap.set(k, String(v)), removeItem: (k) => lsMap.delete(k) } });
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
  for (const [c, id] of [['customers', 'other'], ['events', null], ['tags', 't001'], ['pushes', 'ps3'], ['adminSecrets', 'github']]) {
    let threw = false; try { id ? await sdk.fs.getDoc(sdk.fs.doc(cdb, c, id)) : await sdk.fs.getDocs(sdk.fs.collection(cdb, c)); } catch (e) { threw = true; }
    ok(threw, 'customer cannot read ' + c);
  }

  // github token: stored admin-only, round-trips, deletable; never readable by customers
  eq((await call('POST', '/admin/login', { email: 'BOSS@example.com', password: 'pw-correct' })).status, 200);
  eq((await call('GET', '/admin/github-token')).j, { token: '' });
  eq((await call('PUT', '/admin/github-token', { token: '' })).status, 400);
  eq((await call('PUT', '/admin/github-token', { token: 'github_pat_X' })).j, { ok: true });
  eq((await call('GET', '/admin/github-token')).j, { token: 'github_pat_X' });
  eq((await call('DELETE', '/admin/github-token')).j, { ok: true });
  eq((await call('GET', '/admin/github-token')).j, { token: '' });

  // schedule: future time -> status scheduled; past/invalid rejected; PUT with '' clears it
  eq((await call('POST', '/admin/login', { email: 'BOSS@example.com', password: 'pw-correct' })).status, 200);
  const sp1 = await call('POST', '/admin/pushes', { title: '予約', body: 'b', url: '', targetTags: [] });
  eq(sp1.status, 201);
  const soon = new Date(Date.now() + 3600e3).toISOString();
  const sch = await call('POST', `/admin/pushes/${sp1.j.id}/schedule`, { scheduledAt: soon });
  eq(sch.status, 200); eq(sch.j.status, 'scheduled'); eq(sch.j.scheduledAt, soon);
  eq((await call('POST', `/admin/pushes/${sp1.j.id}/schedule`, { scheduledAt: '2020-01-01T00:00:00Z' })).status, 400);
  eq((await call('POST', `/admin/pushes/${sp1.j.id}/schedule`, { scheduledAt: 'x' })).status, 400);
  eq((await call('POST', '/admin/pushes/nope/schedule', { scheduledAt: soon })).status, 404);
  const clr = await call('PUT', `/admin/pushes/${sp1.j.id}`, { scheduledAt: '' });
  eq(clr.j.status, 'draft');
  eq((await call('GET', '/pushes')).j.some(x => x.id === sp1.j.id), false, 'customers never see unsent');

  // customer deletion cascades to events / files / conversions
  eq((await call('POST', '/admin/login', { email: 'BOSS@example.com', password: 'pw-correct' })).status, 200);
  const ff = await call('POST', `/admin/customers/${uid}/files`, { title: '削除確認', url: 'https://x/z.pdf', kind: 'file' });
  eq(ff.status, 201);
  const evBefore = (await call('GET', `/admin/customers/${uid}/events`)).j.length;
  const del = await call('DELETE', `/admin/customers/${uid}`);
  eq(del.j.ok, true); ok(del.j.removed.events === evBefore && del.j.removed.files >= 1, 'cascade counts');
  eq((await call('GET', `/admin/customers/${uid}`)).status, 404);
  eq((await call('DELETE', `/admin/customers/${uid}`)).status, 404);

  // =================== claim code + duplicate merging ===================
  const newDevice = () => { apps.customer.auth.currentUser = null; lsMap.clear(); }; // fresh Safari tab / home-screen app storage
  const loginAdmin = async () => eq((await call('POST', '/admin/login', { email: 'BOSS@example.com', password: 'pw-correct' })).status, 200);
  const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/;
  const setCreated = (id, t) => { col('customers').get(id).createdAt = iso(t); };
  await loginAdmin();
  eq((await call('GET', '/admin/customers')).j.length, 0, 'clean slate');

  // register returns a claim code (and stores {uid,name,email,tags,createdAt} under it)
  newDevice();
  const rA = await call('POST', '/register', { name: 'Alice', email: 'alice@x.com', tags: ['来場予約'] });
  eq(rA.status, 200);
  ok(typeof rA.j.claimCode === 'string' && CODE_RE.test(rA.j.claimCode), 'claimCode 8 chars, unambiguous alphabet: ' + rA.j.claimCode);
  const A = rA.j.token, codeA = rA.j.claimCode;
  const cdoc = col('claimCodes').get(codeA);
  ok(cdoc && cdoc.uid === A && cdoc.name === 'Alice' && cdoc.email === 'alice@x.com' && cdoc.tags.length === 1 && cdoc.createdAt, 'claimCodes doc shape');
  lsMap.set('aplika.claimCode', codeA);
  eq((await call('POST', '/register', { name: 'Alice', email: 'alice@x.com' })).j.claimCode, codeA, 're-register on same device keeps the code');
  eq(col('claimCodes').size, 1);
  const alphaBad = /[01OIL]/; ok(!alphaBad.test(codeA), 'no ambiguous characters');
  setCreated(A, now - 9 * DAY);
  eq((await call('POST', `/admin/customers/${A}/files`, { title: 'Aの資料', url: 'https://x/a.pdf' })).status, 201);

  // claim on another "device"
  newDevice();
  eq((await call('POST', '/claim', { code: 'ZZZZZZZZ' })).status, 404, 'unknown code');
  eq((await call('POST', '/claim', { code: 'abc' })).status, 404, 'malformed code');
  eq((await call('POST', '/claim', {})).status, 404, 'missing code');
  eq((await call('GET', '/me')).status, 401, 'failed claim does not create a customer');
  const fmtCode = codeA.slice(0, 4).toLowerCase() + '-' + codeA.slice(4).toLowerCase();
  const clB = await call('POST', '/claim', { code: fmtCode });
  eq(clB.status, 200);
  const B = clB.j.token;
  ok(B !== A && clB.j.customer.primaryId === A && clB.j.customer.name === 'Alice' && clB.j.customer.status === '新規', 'claim shape');
  const bdoc = col('customers').get(B);
  ok(bdoc.primaryId === A && bdoc.claimCode === codeA && bdoc.email === 'alice@x.com' && bdoc.tags[0] === '来場予約', 'alias doc fields copied');
  eq((await call('GET', '/me')).j.customer.name, 'Alice', 'app behaves as the customer');
  eq((await call('GET', '/contents')).j.personalFiles.map((f) => f.title), ['Aの資料'], 'alias sees primary personal files');
  eq((await call('POST', '/claim', { code: codeA })).status, 200, 'claim again is idempotent');
  for (const [t, tg] of [['login', 'ios'], ['content', 'ct1']]) eq((await call('POST', '/event', { type: t, target: tg })).j, { ok: true });
  eq((await call('POST', '/push/subscribe', { subscription: { endpoint: 'https://push/b', keys: { p256dh: 'a', auth: 'b' } }, platform: 'ios' })).j, { ok: true });
  // a third device cannot see anyone's files unless claimed; other uid's primaryId attempts are rejected by the rules
  newDevice();
  const rX = await call('POST', '/register', { name: 'Mallory', email: 'm@x.com' }); eq(rX.status, 200);
  eq((await call('GET', '/contents')).j.personalFiles, [], 'unrelated customer sees no files');
  const mdb = sdk.fs.getFirestore({ auth: { currentUser: { uid: rX.j.token, anonymous: true } } });
  const mkAlias = (primaryId, claimCode) => sdk.fs.setDoc(sdk.fs.doc(mdb, 'customers', rX.j.token), { name: 'M', email: '', tags: [], status: '新規', assignee: '', memo: '', createdAt: iso(now), lastSeenAt: iso(now), pushSub: null, installed: false, platform: 'pc', primaryId, claimCode });
  col('customers').delete(rX.j.token);
  for (const [pid, cc] of [[A, 'ZZZZZZZZ'], [B, codeA], [A, undefined], ['someone', codeA]]) {
    let threw = false; try { await mkAlias(pid, cc); } catch (e) { threw = e.code === 'permission-denied'; }
    ok(threw, 'forged alias rejected ' + pid + '/' + cc);
  }
  for (const f of [() => sdk.fs.getDocs(sdk.fs.collection(mdb, 'claimCodes')), () => sdk.fs.updateDoc(sdk.fs.doc(mdb, 'claimCodes', codeA), { uid: rX.j.token }), () => sdk.fs.deleteDoc(sdk.fs.doc(mdb, 'claimCodes', codeA)),
    () => sdk.fs.setDoc(sdk.fs.doc(mdb, 'claimCodes', codeA), { uid: rX.j.token, name: 'x', email: '', tags: [] }),
    () => sdk.fs.setDoc(sdk.fs.doc(mdb, 'claimCodes', 'QQQQQQQQ'), { uid: A, name: 'x', email: '', tags: [] }),
    () => sdk.fs.setDoc(sdk.fs.doc(mdb, 'claimCodes', 'QQQQQQQQ'), { uid: rX.j.token, name: 'x', email: '', tags: [], evil: 1 })]) {
    let threw = false; try { await f(); } catch (e) { threw = e.code === 'permission-denied'; }
    ok(threw, 'claimCodes list/update/delete/forged create rejected');
  }
  eq((await sdk.fs.getDoc(sdk.fs.doc(mdb, 'claimCodes', codeA))).exists(), true, 'single get allowed');
  // mallory is now unregistered again -> clean the rest of her traces so the counts below stay simple
  col('claimCodes').forEach((v, k) => { if (v.uid === rX.j.token) col('claimCodes').delete(k); });
  col('events').forEach((v, k) => { if (v.customerId === rX.j.token) col('events').delete(k); });

  // ---- admin: grouping ----
  await loginAdmin();
  let lst = (await call('GET', '/admin/customers')).j;
  eq(lst.map((c) => c.id), [A], 'alias hidden from list');
  const evA = col('events'); const nEv = (id) => [...evA.values()].filter((e) => e.customerId === id).length;
  ok(lst[0].deviceCount === 2 && lst[0].hasPush === true && lst[0].eventCount === nEv(A) + nEv(B), 'row: devices, hasPush any, events summed');
  eq(col('customers').get(A).pushSub, null, 'primary itself has no push sub');
  ok(lst[0].lastSeenAt >= col('customers').get(A).lastSeenAt && lst[0].lastSeenAt >= col('customers').get(B).lastSeenAt, 'latest lastSeenAt');
  eq((await call('GET', '/admin/dashboard')).j.customers, 1, 'dashboard counts primaries');
  const dA = (await call('GET', `/admin/customers/${B}`)).j; // asking by alias id resolves to the primary
  ok(dA.id === A && dA.deviceCount === 2 && dA.memberIds.includes(B) && dA.installed === true, 'detail by alias id = primary');
  const evAll = (await call('GET', `/admin/customers/${A}/events`)).j;
  eq(evAll.length, nEv(A) + nEv(B), 'events of all devices merged'); ok(evAll.some((e) => e.customerId === B) && evAll[0].at >= evAll[evAll.length - 1].at, 'merged events newest first');
  eq((await call('GET', `/admin/customers/${A}/summary`)).j.stats.events, nEv(A) + nEv(B), 'summary uses all devices');
  const cvB = await call('POST', '/admin/conversions', { customerId: B, kind: 'document' });
  eq(cvB.j.customerId, A, 'conversion on an alias is stored on the primary');
  eq((await call('GET', `/admin/customers/${A}/summary`)).j.interests.points.some((x) => x.includes('資料請求')), true, 'conversions merged into summary');

  // mirror PUT (applied through the alias id too)
  const pu = await call('PUT', `/admin/customers/${B}`, { tags: ['資金計画'], status: '商談中', assignee: '佐藤', memo: 'm1' });
  eq(pu.status, 200); eq(pu.j.id, A);
  for (const id of [A, B]) { const d = col('customers').get(id); ok(d.status === '商談中' && d.assignee === '佐藤' && d.memo === 'm1' && JSON.stringify(d.tags) === '["資金計画"]', 'mirrored to ' + id); }
  eq(col('claimCodes').get(codeA).tags, ['資金計画'], 'claim code tags follow the customer');
  // alias device gets targeted content from mirrored tags
  apps.customer.auth.currentUser = { uid: B, anonymous: true, email: null };
  eq((await call('GET', '/contents')).j.contents.map((c) => c.id), ['ct2', 'ct1'], 'alias tags drive content');
  eq((await call('GET', '/pushes')).j.map((p) => p.id).includes('ps2'), true, 'alias tags drive pushes');

  // merge by identical e-mail (case-insensitive); oldest = primary
  newDevice(); const rC = await call('POST', '/register', { name: 'Alice 2', email: 'ALICE@x.com', tags: ['VIP'] });
  newDevice(); const rD = await call('POST', '/register', { name: 'Bob', email: 'bob@x.com' });
  newDevice(); const rE = await call('POST', '/register', { name: 'Bobby', email: 'Bob@X.com' });
  newDevice(); const rF = await call('POST', '/register', { name: 'Solo', email: 'solo@x.com' });
  const [C, D, E, F] = [rC, rD, rE, rF].map((x) => x.j.token);
  setCreated(C, now - 5 * DAY); setCreated(D, now - 4 * DAY); setCreated(E, now - 3 * DAY); setCreated(F, now - 2 * DAY);
  await loginAdmin();
  eq((await call('GET', '/admin/customers')).j.length, 5, 'five primaries before merging');
  const mg = await call('POST', '/admin/customers/merge-duplicates');
  eq(mg.status, 200); eq(mg.j.merged, 2); eq(mg.j.groups, 2);
  eq(col('customers').get(C).primaryId, A, 'newer duplicate -> oldest primary'); eq(col('customers').get(E).primaryId, D);
  ok(!col('customers').get(A).primaryId && !col('customers').get(D).primaryId && !col('customers').get(F).primaryId, 'primaries untouched');
  eq(col('customers').get(B).primaryId, A, 'existing alias still points at the primary');
  lst = (await call('GET', '/admin/customers')).j;
  eq(lst.map((c) => c.id).sort(), [A, D, F].sort()); eq(lst.find((c) => c.id === A).deviceCount, 3); eq(lst.find((c) => c.id === D).deviceCount, 2);
  for (const id of [A, B, C]) eq(col('customers').get(id).tags.slice().sort(), ['VIP', '資金計画'], 'merged tag union mirrored to ' + id);
  eq(col('claimCodes').get(rC.j.claimCode).uid, A, 'merged customer claim code now belongs to the primary');
  eq((await call('POST', '/admin/customers/merge-duplicates')).j, { ok: true, merged: 0, groups: 0 }, 'idempotent');
  eq((await call('GET', '/admin/dashboard')).j.customers, 3);
  // a device claiming the merged customer's old code ends up directly under the primary
  newDevice(); const clG = await call('POST', '/claim', { code: rC.j.claimCode });
  eq(clG.j.customer.primaryId, A, 'claim after merge points at the primary');
  await loginAdmin();

  // delete the whole group
  const G2 = clG.j.token;
  const before = { ev: [...col('events').values()].filter((e) => [A, B, C, G2].includes(e.customerId)).length };
  const dl = await call('DELETE', `/admin/customers/${C}`); // via an alias id
  eq(dl.status, 200);
  ok(dl.j.removed.devices === 4 && dl.j.removed.events === before.ev && dl.j.removed.files >= 1 && dl.j.removed.conversions === 1 && dl.j.removed.claimCodes >= 2, 'group delete counts ' + JSON.stringify(dl.j.removed));
  for (const id of [A, B, C, G2]) eq(col('customers').has(id), false, 'gone ' + id);
  ok([...col('events').values()].every((e) => ![A, B, C, G2].includes(e.customerId)) && [...col('personalFiles').values()].every((f) => ![A, B, C].includes(f.customerId)) && [...col('claimCodes').values()].every((c) => ![A, B, C, G2].includes(c.uid)), 'events/files/claims removed');
  eq(col('claimCodes').has(codeA), false);
  eq((await call('GET', '/admin/customers')).j.map((c) => c.id).sort(), [D, F].sort(), 'other groups untouched');
  eq((await call('POST', '/claim', { code: codeA })).status, 404, 'deleted customer code no longer valid');

  // customers registered before claim codes existed can mint one on demand (install page)
  apps.customer.auth.currentUser = { uid: F, anonymous: true, email: null }; lsMap.clear();
  col('claimCodes').forEach((v, k) => { if (v.uid === F) col('claimCodes').delete(k); });
  const lc = await call('POST', '/claim-code', {});
  ok(lc.status === 200 && CODE_RE.test(lc.j.claimCode) && col('claimCodes').get(lc.j.claimCode).uid === F, 'legacy customer gets a claim code');
  lsMap.set('aplika.claimCode', lc.j.claimCode);
  eq((await call('POST', '/claim-code', {})).j.claimCode, lc.j.claimCode, 'claim-code is stable while remembered');

  console.log(`OK  firebase-api shim: ${n} assertions passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
