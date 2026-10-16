'use strict';
// Express app: same API contract as server.js, backed by the async store (Firestore / in-memory).
const crypto = require('crypto');
const express = require('express');
const webpush = require('web-push');
const { ensureSeeded } = require('./lib/store');
const { generateSummary } = require('./lib/summary');
const { uid, newToken } = require('./lib/seed');

const ADMIN_TTL = 7 * 86400000;
const EVENT_TYPES = ['login', 'page', 'content', 'push_open', 'install', 'vr', 'library'];
const CONTENT_TYPES = ['folder', 'vr', 'gallery', 'pdf', 'video', 'link'];
const FILE_KINDS = ['file', 'link', 'mail'];
const CONV_KINDS = ['visit_reserve', 'document', 'contract_inquiry'];
const PLATFORMS = ['ios', 'android', 'pc'];

const nowISO = () => new Date().toISOString();
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strArr = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string').map((x) => x.trim().slice(0, 50)).filter(Boolean))].slice(0, 50) : null);
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const matches = (targetTags, tags) => !targetTags || !targetTags.length || targetTags.some((t) => (tags || []).includes(t));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const cmpDesc = (f) => (a, b) => String(b[f]).localeCompare(String(a[f]));

/**
 * opts: { store, getAdminPassword():string|undefined, getAllowedOrigins():string[], getVapidSubject():string,
 *         sendNotification?(sub,payload,opts) (test hook) }
 */
function createApp(opts) {
  const { store: s } = opts;
  const sendNotification = opts.sendNotification || ((sub, payload, o) => webpush.sendNotification(sub, payload, o));
  const app = express();
  app.disable('x-powered-by');

  // --- path normalisation: accept with or without /api prefix (even doubled) ---
  app.use((req, res, next) => {
    let u = req.url;
    while (/^\/api(\/|\?|$)/.test(u)) u = u.replace(/^\/api/, '') || '/';
    if (u.startsWith('?')) u = '/' + u;
    req.url = u;
    next();
  });

  // --- CORS (ALLOWED_ORIGINS; '*' allowed) ---
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin) {
      const list = opts.getAllowedOrigins().map((x) => x.replace(/\/+$/, ''));
      if (list.includes('*') || list.includes(origin.replace(/\/+$/, ''))) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
        res.set('Access-Control-Allow-Headers', 'content-type, x-customer-token, x-admin-token');
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.set('Access-Control-Max-Age', '86400');
      } else if (req.method === 'OPTIONS') return bad(res, 'origin not allowed', 403);
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  // The Functions framework may already have parsed the body (req.rawBody set); otherwise parse here.
  const json = express.json({ limit: '2mb' });
  app.use((req, res, next) => (req.rawBody !== undefined ? next() : json(req, res, next)));
  app.use((req, res, next) => { if (!req.body || typeof req.body !== 'object' || Buffer.isBuffer(req.body)) req.body = {}; next(); });

  // --- lazy seed + settings (per instance, once) ---
  let ready = null; let settings = null;
  const ensure = () => (ready || (ready = ensureSeeded(s, { generateVapid: () => webpush.generateVAPIDKeys() })
    .then((st) => { settings = st; }).catch((e) => { ready = null; throw e; })));
  app.use(wrap(async (req, res, next) => { await ensure(); next(); }));

  const getProperty = () => s.get('property', 'main');

  // ---------- Public ----------
  app.get('/property', wrap(async (req, res) => res.json(await getProperty())));
  app.get('/vapid-public-key', (req, res) => res.json({ key: settings.vapid.publicKey }));

  app.post('/register', wrap(async (req, res) => {
    const name = str(req.body.name, 100); const email = str(req.body.email, 200).toLowerCase();
    if (!name) return bad(res, 'name is required');
    if (!isEmail(email)) return bad(res, 'valid email is required');
    const tags = strArr(req.body.tags) || [];
    let [c] = await s.where('customers', 'email', '==', email);
    if (c) {
      c.name = name;
      if (tags.length) c.tags = [...new Set([...(c.tags || []), ...tags])];
    } else {
      c = { id: uid('c'), name, email, tags, status: '新規', assignee: '', memo: '', token: newToken(), createdAt: nowISO(), lastSeenAt: nowISO(), pushSub: null, installed: false, platform: 'pc' };
    }
    const eid = uid('e');
    await Promise.all([
      s.set('customers', c.id, c),
      s.set('events', eid, { id: eid, customerId: c.id, type: 'page', target: '/register.html', at: nowISO() }),
    ]);
    res.json({ customer: c, token: c.token });
  }));

  // ---------- Customer ----------
  const customerAuth = wrap(async (req, res, next) => {
    const t = req.get('x-customer-token');
    const c = t && (await s.where('customers', 'token', '==', String(t)))[0];
    if (!c || !safeEq(c.token, t)) return bad(res, 'unauthorized', 401);
    req.customer = c; next();
  });
  app.get('/me', customerAuth, wrap(async (req, res) => {
    req.customer.lastSeenAt = nowISO();
    const [property] = await Promise.all([getProperty(), s.patch('customers', req.customer.id, { lastSeenAt: req.customer.lastSeenAt })]);
    res.json({ customer: req.customer, property });
  }));
  app.get('/contents', customerAuth, wrap(async (req, res) => {
    const c = req.customer;
    const [all, personalFiles] = await Promise.all([s.list('contents'), s.where('personalFiles', 'customerId', '==', c.id)]);
    const contents = all.filter((x) => x.active && matches(x.targetTags, c.tags)).sort((a, b) => a.order - b.order);
    res.json({ contents, personalFiles });
  }));
  app.get('/pushes', customerAuth, wrap(async (req, res) => {
    const all = await s.where('pushes', 'status', '==', 'sent');
    res.json(all.filter((p) => matches(p.targetTags, req.customer.tags)).sort(cmpDesc('createdAt')));
  }));
  app.post('/push/subscribe', customerAuth, wrap(async (req, res) => {
    const sub = req.body.subscription;
    if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return bad(res, 'invalid subscription');
    const f = { pushSub: sub, installed: true };
    if (PLATFORMS.includes(req.body.platform)) f.platform = req.body.platform;
    await s.patch('customers', req.customer.id, f);
    res.json({ ok: true });
  }));
  app.post('/event', customerAuth, wrap(async (req, res) => {
    const type = req.body.type;
    if (!EVENT_TYPES.includes(type)) return bad(res, 'invalid event type');
    const at = nowISO(); const id = uid('e');
    const f = { lastSeenAt: at }; if (type === 'install') f.installed = true;
    await Promise.all([
      s.set('events', id, { id, customerId: req.customer.id, type, target: str(req.body.target, 300), at }),
      s.patch('customers', req.customer.id, f),
    ]);
    res.json({ ok: true });
  }));

  // ---------- Admin ----------
  app.post('/admin/login', wrap(async (req, res) => {
    const pw = opts.getAdminPassword();
    if (!pw) return bad(res, 'ADMIN_PASSWORD is not configured', 503);
    if (!safeEq(str(req.body.password, 200), pw)) return bad(res, 'invalid password', 401);
    const token = newToken(); const now = Date.now();
    await s.set('adminSessions', sha(token), { id: sha(token), exp: now + ADMIN_TTL, createdAt: nowISO() });
    // opportunistic cleanup of expired sessions
    s.where('adminSessions', 'exp', '<', now).then((old) => s.deleteMany('adminSessions', old.map((x) => x.id))).catch(() => {});
    res.json({ token });
  }));
  const admin = express.Router();
  admin.use(wrap(async (req, res, next) => {
    const t = req.get('x-admin-token');
    const sess = t && (await s.get('adminSessions', sha(t)));
    if (!sess || sess.exp < Date.now()) return bad(res, 'unauthorized', 401);
    next();
  }));

  // pushes
  admin.get('/pushes', wrap(async (req, res) => res.json((await s.list('pushes')).sort(cmpDesc('createdAt')))));
  admin.post('/pushes', wrap(async (req, res) => {
    const title = str(req.body.title, 100); if (!title) return bad(res, 'title is required');
    const p = { id: uid('ps'), title, body: str(req.body.body, 500), url: str(req.body.url, 500) || '/', targetTags: strArr(req.body.targetTags) || [], createdAt: nowISO(), status: 'draft', sentCount: 0 };
    await s.set('pushes', p.id, p); res.status(201).json(p);
  }));
  admin.put('/pushes/:id', wrap(async (req, res) => {
    const p = await s.get('pushes', req.params.id); if (!p) return bad(res, 'not found', 404);
    if (req.body.title !== undefined) { const t = str(req.body.title, 100); if (!t) return bad(res, 'title is required'); p.title = t; }
    if (req.body.body !== undefined) p.body = str(req.body.body, 500);
    if (req.body.url !== undefined) p.url = str(req.body.url, 500) || '/';
    if (req.body.targetTags !== undefined) { const a = strArr(req.body.targetTags); if (!a) return bad(res, 'targetTags must be array'); p.targetTags = a; }
    await s.set('pushes', p.id, p); res.json(p);
  }));
  admin.delete('/pushes/:id', wrap(async (req, res) => {
    if (!(await s.get('pushes', req.params.id))) return bad(res, 'not found', 404);
    await s.del('pushes', req.params.id); res.json({ ok: true });
  }));
  admin.post('/pushes/:id/send', wrap(async (req, res) => {
    const p = await s.get('pushes', req.params.id); if (!p) return bad(res, 'not found', 404);
    const targets = (await s.list('customers')).filter((c) => c.pushSub && matches(p.targetTags, c.tags));
    const payload = JSON.stringify({ title: p.title, body: p.body, url: p.url || '/', pushId: p.id });
    const vapidDetails = { subject: opts.getVapidSubject(), publicKey: settings.vapid.publicKey, privateKey: settings.vapid.privateKey };
    let sent = 0, failed = 0, removed = 0; const gone = [];
    await Promise.all(targets.map(async (c) => {
      try { await sendNotification(c.pushSub, payload, { TTL: 86400, vapidDetails }); sent++; }
      catch (e) {
        failed++;
        if (e.statusCode === 404 || e.statusCode === 410) { gone.push(c.id); removed++; }
        else console.warn('[push] failed', c.id, e.statusCode || e.message);
      }
    }));
    await Promise.all(gone.map((id) => s.patch('customers', id, { pushSub: null })));
    p.status = 'sent'; p.sentCount = sent; p.sentAt = nowISO();
    await s.set('pushes', p.id, p);
    res.json({ ok: true, sentCount: sent, failed, removed, targets: targets.length, push: p });
  }));

  // customers
  const pubCustomer = (c) => ({ ...c, hasPush: !!c.pushSub });
  admin.get('/customers', wrap(async (req, res) => {
    const cs = await s.list('customers'); const out = [];
    for (let i = 0; i < cs.length; i += 25) { // batched count queries
      const part = cs.slice(i, i + 25);
      const counts = await Promise.all(part.map((c) => s.count('events', ['customerId', '==', c.id])));
      part.forEach((c, k) => out.push({ ...pubCustomer(c), eventCount: counts[k] }));
    }
    res.json(out);
  }));
  admin.get('/customers/:id', wrap(async (req, res) => {
    const c = await s.get('customers', req.params.id); if (!c) return bad(res, 'not found', 404);
    res.json(pubCustomer(c));
  }));
  admin.put('/customers/:id', wrap(async (req, res) => {
    const c = await s.get('customers', req.params.id); if (!c) return bad(res, 'not found', 404);
    if (req.body.tags !== undefined) { const a = strArr(req.body.tags); if (!a) return bad(res, 'tags must be array'); c.tags = a; }
    if (req.body.status !== undefined) c.status = str(req.body.status, 50);
    if (req.body.assignee !== undefined) c.assignee = str(req.body.assignee, 50);
    if (req.body.memo !== undefined) c.memo = str(req.body.memo, 5000);
    await s.set('customers', c.id, c); res.json(pubCustomer(c));
  }));
  admin.get('/customers/:id/files', wrap(async (req, res) => {
    if (!(await s.get('customers', req.params.id))) return bad(res, 'not found', 404);
    res.json(await s.where('personalFiles', 'customerId', '==', req.params.id));
  }));
  admin.post('/customers/:id/files', wrap(async (req, res) => {
    if (!(await s.get('customers', req.params.id))) return bad(res, 'not found', 404);
    const title = str(req.body.title, 200); const url = str(req.body.url, 1000);
    if (!title || !url) return bad(res, 'title and url are required');
    const kind = FILE_KINDS.includes(req.body.kind) ? req.body.kind : 'file';
    const f = { id: uid('pf'), customerId: req.params.id, title, kind, url, createdAt: nowISO() };
    await s.set('personalFiles', f.id, f); res.status(201).json(f);
  }));
  admin.delete('/customers/:id/files/:fid', wrap(async (req, res) => {
    const f = await s.get('personalFiles', req.params.fid);
    if (!f || f.customerId !== req.params.id) return bad(res, 'not found', 404);
    await s.del('personalFiles', f.id); res.json({ ok: true });
  }));
  admin.get('/customers/:id/events', wrap(async (req, res) => {
    if (!(await s.get('customers', req.params.id))) return bad(res, 'not found', 404);
    res.json((await s.where('events', 'customerId', '==', req.params.id)).sort(cmpDesc('at')));
  }));
  admin.get('/customers/:id/summary', wrap(async (req, res) => {
    const c = await s.get('customers', req.params.id); if (!c) return bad(res, 'not found', 404);
    const [evs, contents, conversions] = await Promise.all([s.where('events', 'customerId', '==', c.id), s.list('contents'), s.list('conversions')]);
    res.json(await generateSummary(c, evs, contents, conversions));
  }));

  // contents
  admin.get('/contents', wrap(async (req, res) => res.json((await s.list('contents')).sort((a, b) => a.order - b.order))));
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
  admin.post('/contents', wrap(async (req, res) => {
    const all = await s.list('contents');
    const c = { id: uid('ct'), title: '', type: 'link', url: '', thumb: '', targetTags: [], active: true, order: all.reduce((m, x) => Math.max(m, x.order), 0) + 1, updatedAt: nowISO() };
    const err = applyContent(c, req.body, true); if (err) return bad(res, err);
    await s.set('contents', c.id, c); res.status(201).json(c);
  }));
  admin.put('/contents/:id', wrap(async (req, res) => {
    const c = await s.get('contents', req.params.id); if (!c) return bad(res, 'not found', 404);
    const err = applyContent(c, req.body, false); if (err) return bad(res, err);
    await s.set('contents', c.id, c); res.json(c);
  }));
  admin.delete('/contents/:id', wrap(async (req, res) => {
    if (!(await s.get('contents', req.params.id))) return bad(res, 'not found', 404);
    await s.del('contents', req.params.id); res.json({ ok: true });
  }));

  // tags (rename/delete propagate to customers, contents, pushes)
  async function retag(map) {
    for (const [col, field] of [['customers', 'tags'], ['contents', 'targetTags'], ['pushes', 'targetTags']]) {
      const hits = (await s.list(col)).filter((x) => (x[field] || []).some((t) => map.has(t)));
      hits.forEach((x) => { x[field] = [...new Set(x[field].map((t) => (map.has(t) ? map.get(t) : t)).filter((t) => t !== null))]; });
      if (hits.length) await s.writeMany(col, hits);
    }
  }
  admin.get('/tags', wrap(async (req, res) => res.json((await s.list('tags')).sort((a, b) => a.id.localeCompare(b.id)))));
  admin.post('/tags', wrap(async (req, res) => {
    const name = str(req.body.name, 50); if (!name) return bad(res, 'name is required');
    if ((await s.where('tags', 'name', '==', name)).length) return bad(res, 'tag already exists', 409);
    const t = { id: uid('t'), name, color: /^#[0-9a-fA-F]{3,8}$/.test(req.body.color || '') ? req.body.color : '#0b3d91' };
    await s.set('tags', t.id, t); res.status(201).json(t);
  }));
  admin.put('/tags/:id', wrap(async (req, res) => {
    const t = await s.get('tags', req.params.id); if (!t) return bad(res, 'not found', 404);
    if (req.body.color !== undefined) { if (!/^#[0-9a-fA-F]{3,8}$/.test(req.body.color)) return bad(res, 'invalid color'); t.color = req.body.color; }
    let rename = null;
    if (req.body.name !== undefined) {
      const name = str(req.body.name, 50); if (!name) return bad(res, 'name is required');
      if ((await s.where('tags', 'name', '==', name)).some((x) => x.id !== t.id)) return bad(res, 'tag already exists', 409);
      if (t.name !== name) rename = new Map([[t.name, name]]);
      t.name = name;
    }
    await s.set('tags', t.id, t);
    if (rename) await retag(rename);
    res.json(t);
  }));
  admin.delete('/tags/:id', wrap(async (req, res) => {
    const t = await s.get('tags', req.params.id); if (!t) return bad(res, 'not found', 404);
    await s.del('tags', t.id);
    await retag(new Map([[t.name, null]]));
    res.json({ ok: true });
  }));

  // conversions
  admin.get('/conversions', wrap(async (req, res) => res.json((await s.list('conversions')).sort(cmpDesc('at')))));
  admin.post('/conversions', wrap(async (req, res) => {
    if (typeof req.body.customerId !== 'string' || !(await s.get('customers', req.body.customerId))) return bad(res, 'unknown customerId');
    if (!CONV_KINDS.includes(req.body.kind)) return bad(res, 'invalid kind');
    const v = { id: uid('cv'), customerId: req.body.customerId, kind: req.body.kind, at: req.body.at && !isNaN(Date.parse(req.body.at)) ? new Date(req.body.at).toISOString() : nowISO(), note: str(req.body.note, 500) };
    await s.set('conversions', v.id, v); res.status(201).json(v);
  }));

  admin.get('/dashboard', wrap(async (req, res) => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [customers, installed, pushesSent, events7d, conversions] = await Promise.all([
      s.count('customers'), s.count('customers', ['installed', '==', true]), s.count('pushes', ['status', '==', 'sent']),
      s.count('events', ['at', '>=', since]), s.count('conversions'),
    ]);
    res.json({ customers, installed, pushesSent, events7d, conversions });
  }));

  admin.get('/property', wrap(async (req, res) => res.json(await getProperty())));
  admin.put('/property', wrap(async (req, res) => {
    const b = req.body, p = await getProperty();
    if (b.name !== undefined) { const n = str(b.name, 200); if (!n) return bad(res, 'name is required'); p.name = n; }
    if (b.tagline !== undefined) p.tagline = str(b.tagline, 1000);
    if (b.heroImage !== undefined) p.heroImage = str(b.heroImage, 2000000);
    for (const k of ['heroImageSp', 'logo', 'clientLogo']) if (b[k] !== undefined) p[k] = str(b[k], 2000000);
    if (b.clientName !== undefined) p.clientName = str(b.clientName, 200);
    if (b.gtmId !== undefined) { const g = str(b.gtmId, 30); if (g && !/^GTM-[A-Z0-9]+$/.test(g)) return bad(res, 'invalid gtmId'); p.gtmId = g; }
    await s.set('property', 'main', p); res.json(p);
  }));
  app.use('/admin', admin);

  // ---------- 404 / errors ----------
  app.use((req, res) => bad(res, 'not found', 404));
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') return bad(res, 'invalid JSON');
    if (err && err.type === 'entity.too.large') return bad(res, 'payload too large', 413);
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'internal error' });
  });
  return app;
}

module.exports = { createApp };
