'use strict';
// Store interface (async) with a Firestore implementation and an in-memory fake (tests).
//   list(col) get(col,id) where(col,field,op,val) count(col,[field,op,val]) set(col,id,obj) patch(col,id,fields)
//   del(col,id) create(col,id,obj)->bool  writeMany(col,[objs]) deleteMany(col,[ids]) tryLock(name,ms)->bool
// Collections: tags contents customers personalFiles pushes events conversions adminSessions;
// singleton docs: property/main, settings/main, meta/main.
const { seed, SEED_VERSION } = require('./seed');

const COLLECTIONS = ['tags', 'contents', 'customers', 'personalFiles', 'pushes', 'events', 'conversions'];
const strip = (o) => JSON.parse(JSON.stringify(o)); // drops undefined, deep clones

function firestoreStore(db) {
  const c = (col) => db.collection(col);
  const data = (d) => (d.exists ? d.data() : null);
  const chunks = (arr, n = 400) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
  const applyWhere = (q, f) => (f ? q.where(f[0], f[1], f[2]) : q);
  return {
    async list(col) { return (await c(col).get()).docs.map((d) => d.data()); },
    async get(col, id) { return data(await c(col).doc(id).get()); },
    async where(col, field, op, val) { return (await c(col).where(field, op, val).get()).docs.map((d) => d.data()); },
    async count(col, f) { return (await applyWhere(c(col), f).count().get()).data().count; },
    async set(col, id, obj) { await c(col).doc(id).set(strip(obj)); },
    async patch(col, id, fields) { await c(col).doc(id).set(strip(fields), { merge: true }); },
    async del(col, id) { await c(col).doc(id).delete(); },
    async create(col, id, obj) {
      try { await c(col).doc(id).create(strip(obj)); return true; }
      catch (e) { if (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message))) return false; throw e; }
    },
    async writeMany(col, objs) {
      for (const part of chunks(objs)) {
        const b = db.batch(); part.forEach((o) => b.set(c(col).doc(o.id), strip(o))); await b.commit();
      }
    },
    async deleteMany(col, ids) {
      for (const part of chunks(ids)) { const b = db.batch(); part.forEach((id) => b.delete(c(col).doc(id))); await b.commit(); }
    },
    async tryLock(name, ms) {
      const ref = c('meta').doc('lock-' + name);
      return db.runTransaction(async (t) => {
        const d = await t.get(ref); const now = Date.now();
        if (d.exists && d.data().until > now) return false;
        t.set(ref, { until: now + ms }); return true;
      });
    },
  };
}

function memoryStore() {
  const m = {}; // col -> Map
  const col = (n) => (m[n] || (m[n] = new Map()));
  const cmp = { '==': (a, b) => a === b, '>=': (a, b) => a >= b, '<': (a, b) => a < b, 'array-contains': (a, b) => Array.isArray(a) && a.includes(b) };
  const filt = (n, f) => [...col(n).values()].filter((o) => !f || cmp[f[1]](o[f[0]], f[2])).map(strip);
  const locks = {};
  return {
    _m: m,
    async list(n) { return filt(n); },
    async get(n, id) { const o = col(n).get(id); return o ? strip(o) : null; },
    async where(n, field, op, val) { return filt(n, [field, op, val]); },
    async count(n, f) { return filt(n, f).length; },
    async set(n, id, o) { col(n).set(id, strip(o)); },
    async patch(n, id, f) { col(n).set(id, { ...(col(n).get(id) || {}), ...strip(f) }); },
    async del(n, id) { col(n).delete(id); },
    async create(n, id, o) { if (col(n).has(id)) return false; col(n).set(id, strip(o)); return true; },
    async writeMany(n, os) { os.forEach((o) => col(n).set(o.id, strip(o))); },
    async deleteMany(n, ids) { ids.forEach((id) => col(n).delete(id)); },
    async tryLock(name, ms) { if ((locks[name] || 0) > Date.now()) return false; locks[name] = Date.now() + ms; return true; },
  };
}

// Seed on first request if empty; migrate older seedVersion (refresh property/contents/pushes only).
async function ensureSeeded(s, { generateVapid }) {
  const meta = await s.get('meta', 'main');
  if (!meta || (meta.seedVersion || 0) < SEED_VERSION) {
    const lockName = 'seed';
    for (let i = 0; i < 60; i++) {
      if (await s.tryLock(lockName, 120000)) {
        const cur = await s.get('meta', 'main');
        if (!cur || (cur.seedVersion || 0) < SEED_VERSION) {
          const fresh = seed();
          if (!cur) {
            await s.set('property', 'main', fresh.property);
            for (const k of ['tags', 'customers', 'personalFiles', 'events', 'conversions']) await s.writeMany(k, fresh[k]);
          } else {
            const oldProp = (await s.get('property', 'main')) || {};
            await s.set('property', 'main', { ...fresh.property, gtmId: oldProp.gtmId || '' });
            await s.deleteMany('contents', (await s.list('contents')).map((x) => x.id));
            await s.deleteMany('pushes', (await s.list('pushes')).map((x) => x.id));
          }
          await s.writeMany('contents', fresh.contents);
          await s.writeMany('pushes', fresh.pushes);
          await s.set('meta', 'main', { seedVersion: SEED_VERSION, seededAt: new Date().toISOString() });
        }
        break;
      }
      await new Promise((r) => setTimeout(r, 1000)); // another instance is seeding
      const cur = await s.get('meta', 'main');
      if (cur && (cur.seedVersion || 0) >= SEED_VERSION) break;
    }
  }
  let settings = await s.get('settings', 'main');
  if (!settings || !settings.vapid) {
    const v = generateVapid();
    if (!(await s.create('settings', 'main', { vapid: v }))) settings = await s.get('settings', 'main');
    else settings = { vapid: v };
    if (!settings.vapid) { // doc existed without vapid
      await s.patch('settings', 'main', { vapid: v }); settings = { vapid: v };
    }
  }
  return settings;
}

module.exports = { firestoreStore, memoryStore, ensureSeeded, COLLECTIONS };
