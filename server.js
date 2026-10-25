'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const webpush = require('web-push');
const store = require('./lib/db');
const { generateSummary } = require('./lib/summary');

const first = store.init();
const db = store.get();
const { uid, newToken, nowISO, save } = store;

webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', db.settings.vapid.publicKey, db.settings.vapid.privateKey);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

const adminTokens = new Map(); // token -> expiry
const ADMIN_TTL = 7 * 86400000;
const adminPassword = () => process.env.ADMIN_PASSWORD || db.settings.adminPassword || 'admin';

const EVENT_TYPES = ['login', 'page', 'content', 'push_open', 'install', 'vr', 'library'];
const CONTENT_TYPES = ['folder', 'vr', 'gallery', 'pdf', 'video', 'link'];
const FILE_KINDS = ['file', 'link', 'mail'];
const CONV_KINDS = ['visit_reserve', 'document', 'contract_inquiry'];
const PLATFORMS = ['ios', 'android', 'pc'];

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strArr = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string').map((x) => x.trim().slice(0, 50)).filter(Boolean))].slice(0, 50) : null);
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const matches = (targetTags, tags) => !targetTags || !targetTags.length || targetTags.some((t) => (tags || []).includes(t));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// ---------- Public ----------
app.get('/api/property', (req, res) => res.json(db.property));
app.get('/api/vapid-public-key', (req, res) => res.json({ key: db.settings.vapid.publicKey }));

app.post('/api/register', (req, res) => {
  const name = str(req.body.name, 100); const email = str(req.body.email, 200).toLowerCase();
  if (!name) return bad(res, 'name is required');
  if (!isEmail(email)) return bad(res, 'valid email is required');
  const tags = strArr(req.body.tags) || [];
  let c = db.customers.find((x) => x.email === email);
  if (c) {
    c.name = name;
    if (tags.length) c.tags = [...new Set([...(c.tags || []), ...tags])];
  } else {
    c = { id: uid('c'), name, email, tags, status: '新規', assignee: '', memo: '', token: newToken(), createdAt: nowISO(), lastSeenAt: nowISO(), pushSub: null, installed: false, platform: 'pc' };
    db.customers.push(c);
  }
  db.events.push({ id: uid('e'), customerId: c.id, type: 'page', target: '/register.html', at: nowISO() });
  save();
  res.json({ customer: c, token: c.token });
});

// ---------- Customer ----------
function customerAuth(req, res, next) {
  const t = req.get('x-customer-token');
  const c = t && db.customers.find((x) => safeEq(x.token, t));
  if (!c) return bad(res, 'unauthorized', 401);
  req.customer = c; next();
}
const customerRouter = express.Router();
customerRouter.get('/me', customerAuth, (req, res) => {
  req.customer.lastSeenAt = nowISO(); save();
  res.json({ customer: req.customer, property: db.property });
});
customerRouter.get('/contents', customerAuth, (req, res) => {
  const c = req.customer;
  const contents = db.contents.filter((x) => x.active && matches(x.targetTags, c.tags)).sort((a, b) => a.order - b.order);
  const personalFiles = db.personalFiles.filter((f) => f.customerId === c.id);
  res.json({ contents, personalFiles });
});
customerRouter.get('/pushes', customerAuth, (req, res) => {
  res.json(db.pushes.filter((p) => p.status === 'sent' && matches(p.targetTags, req.customer.tags)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
customerRouter.post('/push/subscribe', customerAuth, (req, res) => {
  const sub = req.body.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return bad(res, 'invalid subscription');
  req.customer.pushSub = sub; req.customer.installed = true;
  if (PLATFORMS.includes(req.body.platform)) req.customer.platform = req.body.platform;
  save(); res.json({ ok: true });
});
customerRouter.post('/event', customerAuth, (req, res) => {
  const type = req.body.type;
  if (!EVENT_TYPES.includes(type)) return bad(res, 'invalid event type');
  db.events.push({ id: uid('e'), customerId: req.customer.id, type, target: str(req.body.target, 300), at: nowISO() });
  req.customer.lastSeenAt = nowISO();
  if (type === 'install') req.customer.installed = true;
  if (db.events.length > 100000) db.events.splice(0, db.events.length - 100000);
  save(); res.json({ ok: true });
});
app.use('/api', customerRouter);

// ---------- Admin ----------
app.post('/api/admin/login', (req, res) => {
  if (!safeEq(str(req.body.password, 200), adminPassword())) return bad(res, 'invalid password', 401);
  const token = newToken(); adminTokens.set(token, Date.now() + ADMIN_TTL);
  res.json({ token });
});
const admin = express.Router();
admin.use((req, res, next) => {
  const t = req.get('x-admin-token'); const exp = t && adminTokens.get(t);
  if (!exp || exp < Date.now()) return bad(res, 'unauthorized', 401);
  next();
});
const find = (arr, id) => arr.find((x) => x.id === id);

// pushes
admin.get('/pushes', (req, res) => res.json(db.pushes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
admin.post('/pushes', (req, res) => {
  const title = str(req.body.title, 100); if (!title) return bad(res, 'title is required');
  const p = { id: uid('ps'), title, body: str(req.body.body, 500), url: str(req.body.url, 500) || '/', targetTags: strArr(req.body.targetTags) || [], createdAt: nowISO(), status: 'draft', sentCount: 0 };
  db.pushes.push(p); save(); res.status(201).json(p);
});
admin.put('/pushes/:id', (req, res) => {
  const p = find(db.pushes, req.params.id); if (!p) return bad(res, 'not found', 404);
  if (req.body.title !== undefined) { const t = str(req.body.title, 100); if (!t) return bad(res, 'title is required'); p.title = t; }
  if (req.body.body !== undefined) p.body = str(req.body.body, 500);
  if (req.body.url !== undefined) p.url = str(req.body.url, 500) || '/';
  if (req.body.targetTags !== undefined) { const a = strArr(req.body.targetTags); if (!a) return bad(res, 'targetTags must be array'); p.targetTags = a; }
  save(); res.json(p);
});
admin.delete('/pushes/:id', (req, res) => {
  const i = db.pushes.findIndex((x) => x.id === req.params.id); if (i < 0) return bad(res, 'not found', 404);
  db.pushes.splice(i, 1); save(); res.json({ ok: true });
});
admin.post('/pushes/:id/send', wrap(async (req, res) => {
  const p = find(db.pushes, req.params.id); if (!p) return bad(res, 'not found', 404);
  const targets = db.customers.filter((c) => c.pushSub && matches(p.targetTags, c.tags));
  const payload = JSON.stringify({ title: p.title, body: p.body, url: p.url || '/', pushId: p.id });
  let sent = 0, failed = 0, removed = 0;
  await Promise.all(targets.map(async (c) => {
    try { await webpush.sendNotification(c.pushSub, payload, { TTL: 86400 }); sent++; }
    catch (e) {
      failed++;
      if (e.statusCode === 404 || e.statusCode === 410) { c.pushSub = null; removed++; }
      else console.warn('[push] failed', c.id, e.statusCode || e.message);
    }
  }));
  p.status = 'sent'; p.sentCount = sent; p.sentAt = nowISO();
  save();
  res.json({ ok: true, sentCount: sent, failed, removed, targets: targets.length, push: p });
}));

// customers
const pubCustomer = (c) => ({ ...c, hasPush: !!c.pushSub });
admin.get('/customers', (req, res) => {
  const cnt = {}; db.events.forEach((e) => { cnt[e.customerId] = (cnt[e.customerId] || 0) + 1; });
  res.json(db.customers.map((c) => ({ ...pubCustomer(c), eventCount: cnt[c.id] || 0 })));
});
admin.get('/customers/:id', (req, res) => {
  const c = find(db.customers, req.params.id); if (!c) return bad(res, 'not found', 404);
  res.json(pubCustomer(c));
});
admin.put('/customers/:id', (req, res) => {
  const c = find(db.customers, req.params.id); if (!c) return bad(res, 'not found', 404);
  if (req.body.tags !== undefined) { const a = strArr(req.body.tags); if (!a) return bad(res, 'tags must be array'); c.tags = a; }
  if (req.body.status !== undefined) c.status = str(req.body.status, 50);
  if (req.body.assignee !== undefined) c.assignee = str(req.body.assignee, 50);
  if (req.body.memo !== undefined) c.memo = str(req.body.memo, 5000);
  save(); res.json(pubCustomer(c));
});
admin.delete('/customers/:id', (req, res) => {
  const i = db.customers.findIndex((c) => c.id === req.params.id); if (i < 0) return bad(res, 'not found', 404);
  const id = req.params.id;
  db.customers.splice(i, 1);
  db.events = db.events.filter((e) => e.customerId !== id);
  db.personalFiles = db.personalFiles.filter((f) => f.customerId !== id);
  db.conversions = db.conversions.filter((x) => x.customerId !== id);
  save(); res.json({ ok: true });
});
admin.get('/customers/:id/files', (req, res) => {
  if (!find(db.customers, req.params.id)) return bad(res, 'not found', 404);
  res.json(db.personalFiles.filter((f) => f.customerId === req.params.id));
});
admin.post('/customers/:id/files', (req, res) => {
  if (!find(db.customers, req.params.id)) return bad(res, 'not found', 404);
  const title = str(req.body.title, 200); const url = str(req.body.url, 1000);
  if (!title || !url) return bad(res, 'title and url are required');
  const kind = FILE_KINDS.includes(req.body.kind) ? req.body.kind : 'file';
  const f = { id: uid('pf'), customerId: req.params.id, title, kind, url, createdAt: nowISO() };
  db.personalFiles.push(f); save(); res.status(201).json(f);
});
admin.delete('/customers/:id/files/:fid', (req, res) => {
  const i = db.personalFiles.findIndex((f) => f.id === req.params.fid && f.customerId === req.params.id);
  if (i < 0) return bad(res, 'not found', 404);
  db.personalFiles.splice(i, 1); save(); res.json({ ok: true });
});
admin.get('/customers/:id/events', (req, res) => {
  if (!find(db.customers, req.params.id)) return bad(res, 'not found', 404);
  res.json(db.events.filter((e) => e.customerId === req.params.id).sort((a, b) => b.at.localeCompare(a.at)));
});
admin.get('/customers/:id/summary', wrap(async (req, res) => {
  const c = find(db.customers, req.params.id); if (!c) return bad(res, 'not found', 404);
  const evs = db.events.filter((e) => e.customerId === c.id);
  res.json(await generateSummary(c, evs, db.contents, db.conversions));
}));

// contents
admin.get('/contents', (req, res) => res.json(db.contents.slice().sort((a, b) => a.order - b.order)));
function applyContent(c, b, creating) {
  if (creating || b.title !== undefined) { const t = str(b.title, 200); if (!t) return 'title is required'; c.title = t; }
  if (creating || b.type !== undefined) { if (!CONTENT_TYPES.includes(b.type)) return 'invalid type'; c.type = b.type; }
  if (b.url !== undefined) c.url = str(b.url, 2000);
  if (b.thumb !== undefined) c.thumb = str(b.thumb, 200000);
  if (b.gallery !== undefined) {
    if (!Array.isArray(b.gallery)) return 'gallery must be array';
    c.gallery = b.gallery.filter((g) => g && typeof g.src === 'string' && g.src.trim()).slice(0, 100).map((g) => ({ title: str(g.title, 200), src: str(g.src, 2000000) }));
  }
  if (b.targetTags !== undefined) { const a = strArr(b.targetTags); if (!a) return 'targetTags must be array'; c.targetTags = a; }
  if (b.active !== undefined) c.active = !!b.active;
  if (b.order !== undefined) { const n = Number(b.order); if (!Number.isFinite(n)) return 'invalid order'; c.order = n; }
  c.updatedAt = nowISO();
  return null;
}
admin.post('/contents', (req, res) => {
  const c = { id: uid('ct'), title: '', type: 'link', url: '', thumb: '', targetTags: [], active: true, order: db.contents.reduce((m, x) => Math.max(m, x.order), 0) + 1, updatedAt: nowISO() };
  const err = applyContent(c, req.body, true); if (err) return bad(res, err);
  db.contents.push(c); save(); res.status(201).json(c);
});
admin.put('/contents/:id', (req, res) => {
  const c = find(db.contents, req.params.id); if (!c) return bad(res, 'not found', 404);
  const err = applyContent(c, req.body, false); if (err) return bad(res, err);
  save(); res.json(c);
});
admin.delete('/contents/:id', (req, res) => {
  const i = db.contents.findIndex((x) => x.id === req.params.id); if (i < 0) return bad(res, 'not found', 404);
  db.contents.splice(i, 1); save(); res.json({ ok: true });
});

// tags
admin.get('/tags', (req, res) => res.json(db.tags));
admin.post('/tags', (req, res) => {
  const name = str(req.body.name, 50); if (!name) return bad(res, 'name is required');
  if (db.tags.some((t) => t.name === name)) return bad(res, 'tag already exists', 409);
  const t = { id: uid('t'), name, color: /^#[0-9a-fA-F]{3,8}$/.test(req.body.color || '') ? req.body.color : '#0b3d91' };
  db.tags.push(t); save(); res.status(201).json(t);
});
admin.put('/tags/:id', (req, res) => {
  const t = find(db.tags, req.params.id); if (!t) return bad(res, 'not found', 404);
  if (req.body.color !== undefined) { if (!/^#[0-9a-fA-F]{3,8}$/.test(req.body.color)) return bad(res, 'invalid color'); t.color = req.body.color; }
  if (req.body.name !== undefined) {
    const name = str(req.body.name, 50); if (!name) return bad(res, 'name is required');
    if (db.tags.some((x) => x.name === name && x.id !== t.id)) return bad(res, 'tag already exists', 409);
    const old = t.name; t.name = name;
    if (old !== name) { // propagate rename
      const re = (arr) => arr.map((x) => (x === old ? name : x));
      db.customers.forEach((c) => { c.tags = re(c.tags || []); });
      db.contents.forEach((c) => { c.targetTags = re(c.targetTags || []); });
      db.pushes.forEach((p) => { p.targetTags = re(p.targetTags || []); });
    }
  }
  save(); res.json(t);
});
admin.delete('/tags/:id', (req, res) => {
  const i = db.tags.findIndex((x) => x.id === req.params.id); if (i < 0) return bad(res, 'not found', 404);
  const [t] = db.tags.splice(i, 1);
  const rm = (arr) => (arr || []).filter((x) => x !== t.name);
  db.customers.forEach((c) => { c.tags = rm(c.tags); });
  db.contents.forEach((c) => { c.targetTags = rm(c.targetTags); });
  db.pushes.forEach((p) => { p.targetTags = rm(p.targetTags); });
  save(); res.json({ ok: true });
});

// conversions
admin.get('/conversions', (req, res) => res.json(db.conversions.slice().sort((a, b) => b.at.localeCompare(a.at))));
admin.post('/conversions', (req, res) => {
  if (!find(db.customers, req.body.customerId)) return bad(res, 'unknown customerId');
  if (!CONV_KINDS.includes(req.body.kind)) return bad(res, 'invalid kind');
  const v = { id: uid('cv'), customerId: req.body.customerId, kind: req.body.kind, at: req.body.at && !isNaN(Date.parse(req.body.at)) ? new Date(req.body.at).toISOString() : nowISO(), note: str(req.body.note, 500) };
  db.conversions.push(v); save(); res.status(201).json(v);
});

admin.get('/dashboard', (req, res) => {
  const since = Date.now() - 7 * 86400000;
  res.json({
    customers: db.customers.length,
    installed: db.customers.filter((c) => c.installed).length,
    pushesSent: db.pushes.filter((p) => p.status === 'sent').length,
    events7d: db.events.filter((e) => new Date(e.at).getTime() >= since).length,
    conversions: db.conversions.length,
  });
});

admin.get('/property', (req, res) => res.json(db.property));
admin.put('/property', (req, res) => {
  const b = req.body, p = db.property;
  if (b.name !== undefined) { const n = str(b.name, 200); if (!n) return bad(res, 'name is required'); p.name = n; }
  if (b.tagline !== undefined) p.tagline = str(b.tagline, 1000);
  if (b.heroImage !== undefined) p.heroImage = str(b.heroImage, 2000000);
  for (const k of ['heroImageSp', 'logo', 'clientLogo']) if (b[k] !== undefined) p[k] = str(b[k], 2000000);
  if (b.clientName !== undefined) p.clientName = str(b.clientName, 200);
  if (b.gtmId !== undefined) { const g = str(b.gtmId, 30); if (g && !/^GTM-[A-Z0-9]+$/.test(g)) return bad(res, 'invalid gtmId'); p.gtmId = g; }
  save(); res.json(p);
});

app.use('/api/admin', admin);

// ---------- API 404 / errors ----------
app.use('/api', (req, res) => bad(res, 'not found', 404));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return bad(res, 'invalid JSON');
  if (err && err.type === 'entity.too.large') return bad(res, 'payload too large', 413);
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'internal error' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`プライムサイト server: http://localhost:${PORT}  (admin: /admin/, tool: /tool/)`);
  console.log(`admin password: ${process.env.ADMIN_PASSWORD ? '(from ADMIN_PASSWORD)' : db.settings.adminPassword}`);
  const demo = db.customers.find((c) => c.token === store.DEMO_TOKEN);
  if (demo) console.log(`demo customer token (${demo.name}): ${demo.token}`);
  if (first) console.log('first run: seeded data/db.json and generated VAPID keys');
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
