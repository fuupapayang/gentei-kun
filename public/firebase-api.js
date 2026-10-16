/* 限定くん — Firebase (Spark / no server) client shim.
 *
 * When GENTEI_CONFIG.apiBase === "firebase", every request built with gApi() (customer app, admin console, sales tool)
 * is answered HERE from Firestore / Firebase Auth, returning the same JSON shapes + status codes the Express server
 * (server.js) returns. The UI code stays unchanged. For any other apiBase this file does nothing.
 *
 *  - Firebase JS SDK v10 (modular ESM from gstatic) is imported lazily on the first API call.
 *  - Two named Firebase apps ("customer" = anonymous auth, "admin" = email/password) so that an admin signing in on the
 *    same browser can never replace the visitor's anonymous identity (auth persistence is per app name).
 *  - customer identity = anonymous-auth uid; customers/{uid} doc holds tags/status/... ; tag visibility is filtered here.
 *  - admin "token" is just a marker ("firebase"); real authority = Firebase Auth user + firestore.rules (admin emails).
 *  - AI customer summary is computed in the browser (verbatim port of lib/summary.js ruleSummary).
 * Test hook: set globalThis.__GENTEI_FIREBASE_SDK__ = {app, auth, fs} (same shape as the three SDK modules) to inject a fake.
 */
(function (G) {
  'use strict';
  var C = G.GENTEI_CONFIG || {};
  var FB_ROOT = 'https://firebase.invalid/api'; /* must equal what config.js gApi() returns for apiBase "firebase" */
  var SDK_BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';

  /* =================== AI summary: verbatim port of lib/summary.js (rule-based part) =================== */
const LOAN_RE = /資金|ローン|シミュレーション|返済|loan|simulat|price|価格/i;
const VR_RE = /vr/i;
const VISIT_RE = /来場|予約|reserve|visit/i;
const SESSION_GAP = 30 * 60 * 1000;

function fmtDate(d) { return `${d.getMonth() + 1}月${d.getDate()}日`; }
function monthKey(d) { return `${d.getFullYear()}年${d.getMonth() + 1}月`; }

function resolveTarget(e, contents) {
  const c = contents.find((x) => x.id === e.target);
  return c ? c.title : e.target;
}

function computeStats(customer, events, contents, now = Date.now()) {
  const evs = events.slice().sort((a, b) => a.at.localeCompare(b.at));
  let sessions = 0; let lastT = 0;
  for (const e of evs) {
    const t = new Date(e.at).getTime();
    if (e.type === 'login' || t - lastT > SESSION_GAP) sessions++;
    lastT = t;
  }
  const withTitle = evs.map((e) => ({ ...e, title: resolveTarget(e, contents), t: new Date(e.at).getTime() }));
  const contentViews = withTitle.filter((e) => e.type === 'content' || e.type === 'vr');
  const vr = withTitle.filter((e) => e.type === 'vr' || (e.type === 'content' && VR_RE.test(e.title)));
  const library = withTitle.filter((e) => e.type === 'library');
  const loan = withTitle.filter((e) => ['content', 'vr', 'page'].includes(e.type) && LOAN_RE.test(e.title));
  const visit = withTitle.filter((e) => ['content', 'page'].includes(e.type) && VISIT_RE.test(e.title));
  const pushOpen = withTitle.filter((e) => e.type === 'push_open');
  const counts = {};
  contentViews.forEach((e) => { counts[e.title] = (counts[e.title] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const last = withTitle.length ? withTitle[withTitle.length - 1].t : null;
  const first = withTitle.length ? withTitle[0].t : null;
  const days7 = withTitle.filter((e) => now - e.t <= 7 * 86400000);
  const days30 = withTitle.filter((e) => now - e.t <= 30 * 86400000);
  const prev30 = withTitle.filter((e) => now - e.t > 30 * 86400000 && now - e.t <= 60 * 86400000);
  return { evs: withTitle, sessions, contentViews, vr, library, loan, visit, pushOpen, top, last, first, days7, days30, prev30, now };
}

function ruleSummary(customer, events, contents, conversions = [], now = Date.now()) {
  const s = computeStats(customer, events, contents, now);
  const name = `${customer.name}様`;
  const total = s.evs.length;
  const out = { stats: { events: total, sessions: s.sessions } };

  if (!total) {
    out.overview = { headline: '行動ログがまだありません', body: `${name}は登録済みですが、アプリ利用の記録がありません。まずはホーム画面への追加と通知許可をご案内しましょう。` };
    out.timeline = [];
    out.interests = { headline: '興味関心はまだ判断できません', points: ['閲覧データが蓄積されるまでお待ちください。'] };
    out.hints = { headline: '初回接点づくりを優先', points: ['登録御礼とあわせてCGギャラリーなど見やすいコンテンツを案内する。', 'ホーム画面追加の手順を再送する。'] };
    return out;
  }

  const daysSince = s.last ? Math.floor((now - s.last) / 86400000) : null;
  const spanDays = Math.max(1, Math.floor((s.last - s.first) / 86400000));
  let level; let levelWord;
  const recentRate = s.days7.length;
  if (daysSince <= 3 && s.sessions >= 8) { level = '高'; levelWord = '非常に積極的な閲覧傾向'; }
  else if (daysSince <= 14 && s.sessions >= 4) { level = '中'; levelWord = '継続的な閲覧傾向'; }
  else if (daysSince > 30) { level = '低'; levelWord = '関心が薄れつつある傾向'; }
  else { level = '中〜低'; levelWord = '様子見の閲覧傾向'; }

  const recency = daysSince === 0 ? '本日' : daysSince === 1 ? '昨日' : `${daysSince}日前`;
  out.overview = {
    headline: `検討度「${level}」: ${levelWord}`,
    body: `${name}は${customer.installed ? 'アプリをホーム画面に追加済みで、' : ''}これまでに累計${s.sessions}回のセッション・${total}件の行動が記録されています。` +
      `限定情報ライブラリの閲覧は${s.library.length}回、コンテンツ閲覧${s.contentViews.length}件(うちVR${s.vr.length}件)。最終アクセスは${recency}(${fmtDate(new Date(s.last))})です。` +
      (s.pushOpen.length ? `Push通知からの起動も${s.pushOpen.length}回あり、情報配信への反応は良好です。` : '')
      + (customer.status ? `現在のステータスは「${customer.status}」です。` : ''),
  };

  // timeline by month
  const byMonth = new Map();
  for (const e of s.evs) {
    const k = monthKey(new Date(e.t));
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(e);
  }
  out.timeline = [];
  let prevCount = null;
  for (const [period, list] of byMonth) {
    const ss = list.filter((e) => e.type === 'login').length;
    const cv = list.filter((e) => e.type === 'content' || e.type === 'vr');
    const tc = {};
    cv.forEach((e) => { tc[e.title] = (tc[e.title] || 0) + 1; });
    const tt = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
    const hasInstall = list.some((e) => e.type === 'install');
    let action = `ログイン${ss}回・コンテンツ閲覧${cv.length}件`;
    if (hasInstall) action = '会員登録・ホーム画面に追加。' + action;
    if (tt.length) action += `(主に「${tt.join('」「')}」)`;
    let feature;
    if (list.length <= 3) feature = '利用は限定的。接点が薄い月。';
    else if (prevCount !== null && list.length > prevCount * 1.5) feature = '前月より行動量が大きく増加。関心が高まった時期。';
    else if (prevCount !== null && list.length < prevCount * 0.5) feature = '前月より行動量が減少。熱量が落ち着いた時期。';
    else if (cv.some((e) => VR_RE.test(e.title))) feature = 'VR内覧など体験型コンテンツに関心。';
    else if (cv.some((e) => LOAN_RE.test(e.title))) feature = '資金面の情報収集が中心。';
    else feature = '安定した閲覧ペース。';
    prevCount = list.length;
    out.timeline.push({ period, action, feature });
  }
  if (out.timeline.length > 8) out.timeline = out.timeline.slice(-8);

  // interests
  const pts = [];
  if (s.top.length) pts.push(`最も閲覧が多いのは「${s.top[0][0]}」(${s.top[0][1]}回)${s.top[1] ? `、次いで「${s.top[1][0]}」(${s.top[1][1]}回)` : ''}。`);
  if (s.loan.length) pts.push(`資金計画・価格関連の閲覧が${s.loan.length}件あり、予算や返済イメージを具体的に検討している様子。`);
  if (s.vr.length) pts.push(`VR内覧を${s.vr.length}回利用。間取りや空間の広がりを重視している可能性が高い。`);
  if (s.visit.length) pts.push(`来場予約に関する導線を${s.visit.length}回確認しており、現地確認への意欲がある。`);
  if (customer.tags && customer.tags.length) pts.push(`登録タグ: ${customer.tags.join('、')}。`);
  const cvs = conversions.filter((c) => c.customerId === customer.id);
  if (cvs.length) {
    const label = { visit_reserve: '来場予約', document: '資料請求', contract_inquiry: '契約相談' };
    pts.push(`成果実績: ${cvs.map((c) => `${label[c.kind] || c.kind}(${fmtDate(new Date(c.at))})`).join('、')}。`);
  }
  if (!pts.length) pts.push('特定のコンテンツへの偏りは見られません。');
  const head = s.loan.length >= Math.max(2, s.vr.length) ? '資金計画・価格への関心が強い' :
    s.vr.length >= 2 ? '空間体験(VR・CG)への関心が強い' : s.top.length ? `「${s.top[0][0]}」に注目` : '関心領域は形成途上';
  out.interests = { headline: head, points: pts };

  // hints
  const h = [];
  if (daysSince > 30) h.push(`最終アクセスから${daysSince}日経過。新着コンテンツ更新のPush配信で再接触を。`);
  else if (daysSince <= 3) h.push('直近で活発に閲覧中。今が連絡の好機なので、早めの架電またはメッセージを。');
  if (s.loan.length) h.push('資金計画の閲覧が多いため、具体的な返済シミュレーションや住宅ローン相談の場を提案する。');
  if (s.vr.length) h.push('VRで見た間取りをもとに、実際のモデルルームでの体感を勧めると来場動機になりやすい。');
  if (!cvs.some((c) => c.kind === 'visit_reserve') && (s.visit.length || s.sessions >= 5)) h.push('来場予約が未取得。具体的な日程候補を2〜3提示してクロージングへ。');
  if (!customer.installed) h.push('ホーム画面未追加。インストール手順の再案内でPush到達率を高める。');
  else if (!customer.pushSub && !s.pushOpen.length) h.push('通知許可が未取得の可能性。アプリ内で通知ONをご案内する。');
  if (!customer.assignee) h.push('担当者が未設定。早めに担当を割り当てる。');
  if (!h.length) h.push('現状の関心領域に沿った情報を継続配信し、反応を見て次の提案を行う。');
  out.hints = { headline: level === '高' ? '今が提案のタイミング' : level === '低' ? '再活性化が課題' : '関心に合わせた情報提供を', points: h };
  return out;
}


  /* =================== shim =================== */
  var EVENT_TYPES = ['login', 'page', 'content', 'push_open', 'install', 'vr', 'library'];
  var CONTENT_TYPES = ['folder', 'vr', 'gallery', 'pdf', 'video', 'link'];
  var FILE_KINDS = ['file', 'link', 'mail'];
  var CONV_KINDS = ['visit_reserve', 'document', 'contract_inquiry'];
  var PLATFORMS = ['ios', 'android', 'pc'];

  function HttpErr(status, msg) { this.status = status; this.msg = msg; }
  var fail = function (status, msg) { throw new HttpErr(status, msg); };
  var str = function (v, max) { return typeof v === 'string' ? v.trim().slice(0, max || 500) : ''; };
  var strArr = function (v) {
    if (!Array.isArray(v)) return null;
    var seen = {}, out = [];
    v.forEach(function (x) { if (typeof x !== 'string') return; x = x.trim().slice(0, 50); if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out.slice(0, 50);
  };
  var matches = function (targetTags, tags) { return !targetTags || !targetTags.length || targetTags.some(function (t) { return (tags || []).indexOf(t) >= 0; }); };
  var isEmail = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); };
  var nowISO = function () { return new Date().toISOString(); };
  var hex = function (n) {
    var a = new Uint8Array(n), s = '';
    if (G.crypto && G.crypto.getRandomValues) G.crypto.getRandomValues(a); else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < n; j++) s += ('0' + a[j].toString(16)).slice(-2);
    return s;
  };
  var newId = function (p) { return p + hex(5); };
  var clean = function (o) { return JSON.parse(JSON.stringify(o)); }; /* Firestore rejects undefined */

  /* ---- SDK / apps ---- */
  var S = null, sdkP = null, roles = {};
  function loadSdk() {
    if (sdkP) return sdkP;
    sdkP = G.__GENTEI_FIREBASE_SDK__ ? Promise.resolve(G.__GENTEI_FIREBASE_SDK__) :
      Promise.all([import(SDK_BASE + 'firebase-app.js'), import(SDK_BASE + 'firebase-auth.js'), import(SDK_BASE + 'firebase-firestore.js')])
        .then(function (m) { return { app: m[0], auth: m[1], fs: m[2] }; });
    return sdkP.then(function (s) { S = s; return s; });
  }
  function role(name) { /* name: "customer" | "admin" */
    return loadSdk().then(function () {
      if (!C.firebase || !C.firebase.projectId) fail(500, 'Firebase が設定されていません');
      if (!roles[name]) {
        var app = S.app.initializeApp(C.firebase, name);
        roles[name] = { name: name, app: app, auth: S.auth.getAuth(app), db: S.fs.getFirestore(app) };
      }
      return roles[name];
    });
  }
  function authReady(r) {
    if (r.auth.authStateReady) return r.auth.authStateReady().then(function () { return r.auth.currentUser; });
    return new Promise(function (res) { var un = S.auth.onAuthStateChanged(r.auth, function (u) { un(); res(u); }); });
  }

  /* ---- Firestore helpers ---- */
  var withId = function (d) { return Object.assign({}, d.data(), { id: d.id }); };
  var allDocs = function (r, col, constraints) {
    var f = S.fs;
    return f.getDocs(constraints && constraints.length ? f.query.apply(null, [f.collection(r.db, col)].concat(constraints)) : f.collection(r.db, col))
      .then(function (snap) { return snap.docs.map(withId); });
  };
  var getOne = function (r, col, id) { return S.fs.getDoc(S.fs.doc(r.db, col, id)).then(function (d) { return d.exists() ? withId(d) : null; }); };
  var setOne = function (r, col, id, data) { return S.fs.setDoc(S.fs.doc(r.db, col, id), clean(data)); };
  var patch = function (r, col, id, data) { return S.fs.updateDoc(S.fs.doc(r.db, col, id), clean(data)); };
  var delOne = function (r, col, id) { return S.fs.deleteDoc(S.fs.doc(r.db, col, id)); };
  function count(r, col, constraints) {
    var f = S.fs, q = constraints && constraints.length ? f.query.apply(null, [f.collection(r.db, col)].concat(constraints)) : f.collection(r.db, col);
    if (f.getCountFromServer) return f.getCountFromServer(q).then(function (s) { return s.data().count; });
    return f.getDocs(q).then(function (s) { return s.size; });
  }
  var W = function (field, op, v) { return S.fs.where(field, op, v); };
  var byDesc = function (k) { return function (a, b) { return String(b[k] || '').localeCompare(String(a[k] || '')); }; };
  async function commitChunks(r, ops) { /* ops: [(batch)=>void] ; <=400 per batch */
    for (var i = 0; i < ops.length; i += 400) {
      var b = S.fs.writeBatch(r.db);
      ops.slice(i, i + 400).forEach(function (op) { op(b); });
      await b.commit();
    }
  }

  /* ---- auth contexts ---- */
  var isAdminEmail = function (e) {
    var l = (C.adminEmails || []).map(function (x) { return String(x).trim().toLowerCase(); }).filter(Boolean);
    return !l.length || l.indexOf(String(e || '').toLowerCase()) >= 0; /* empty list: firestore.rules is the only gate */
  };
  async function adminCtx() {
    var r = await role('admin'), u = await authReady(r);
    if (!u || !u.email || !isAdminEmail(u.email)) fail(401, 'unauthorized');
    return r;
  }
  async function custCtx() {
    var r = await role('customer'), u = await authReady(r);
    if (!u) fail(401, 'unauthorized');
    var c = await getOne(r, 'customers', u.uid);
    if (!c) fail(401, 'unauthorized');
    return { r: r, uid: u.uid, c: c };
  }
  var custView = function (c, uid) { return Object.assign({}, c, { id: uid || c.id, token: uid || c.id }); };
  var pubCustomer = function (c) { return Object.assign({}, c, { token: c.id, hasPush: !!c.pushSub }); };

  /* ---- public / customer ---- */
  async function getProperty(r) {
    var d = await S.fs.getDoc(S.fs.doc(r.db, 'property', 'main'));
    if (!d.exists()) fail(404, 'not found');
    var p = d.data(); /* raw data: the doc id is "main", the UI wants the p0061-style id stored in the field */
    return Object.assign({ id: 'p0061' }, p);
  }

  async function register(body) {
    var name = str(body.name, 100), email = str(body.email, 200).toLowerCase();
    if (!name) fail(400, 'name is required');
    if (!isEmail(email)) fail(400, 'valid email is required');
    var tags = strArr(body.tags) || [];
    var r = await role('customer'), u = await authReady(r);
    if (!u) u = (await S.auth.signInAnonymously(r.auth)).user;
    var c = await getOne(r, 'customers', u.uid), t = nowISO();
    if (c) { /* same browser registering again: update name/email only (tags are admin-controlled) */
      await patch(r, 'customers', u.uid, { name: name, email: email, lastSeenAt: t });
      c = Object.assign(c, { name: name, email: email, lastSeenAt: t });
    } else {
      c = { name: name, email: email, tags: tags.slice(0, 10), status: '新規', assignee: '', memo: '', createdAt: t, lastSeenAt: t, pushSub: null, installed: false, platform: 'pc' };
      await setOne(r, 'customers', u.uid, c);
    }
    try { await S.fs.addDoc(S.fs.collection(r.db, 'events'), { customerId: u.uid, type: 'page', target: '/' + 'register.html', at: nowISO() }); } catch (e) { /* non-fatal */ }
    return { customer: custView(c, u.uid), token: u.uid };
  }

  async function customerRoute(m, p, body) {
    var x = await custCtx(), r = x.r;
    if (m === 'GET' && p === '/me') {
      var t = nowISO();
      try { await patch(r, 'customers', x.uid, { lastSeenAt: t }); x.c.lastSeenAt = t; } catch (e) { /* ignore */ }
      return { customer: custView(x.c, x.uid), property: await getProperty(r) };
    }
    if (m === 'GET' && p === '/contents') {
      var cs = await allDocs(r, 'contents', [W('active', '==', true)]);
      var contents = cs.filter(function (c) { return c.active && matches(c.targetTags, x.c.tags); }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      var personalFiles = await allDocs(r, 'personalFiles', [W('customerId', '==', x.uid)]);
      return { contents: contents, personalFiles: personalFiles };
    }
    if (m === 'GET' && p === '/pushes') {
      var ps = await allDocs(r, 'pushes', [W('status', '==', 'sent')]);
      return ps.filter(function (q) { return matches(q.targetTags, x.c.tags); }).sort(byDesc('createdAt'));
    }
    if (m === 'POST' && p === '/push/subscribe') {
      var sub = body.subscription;
      if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.indexOf('https://') !== 0 || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) fail(400, 'invalid subscription');
      var up = { pushSub: sub, installed: true };
      if (PLATFORMS.indexOf(body.platform) >= 0) up.platform = body.platform;
      await patch(r, 'customers', x.uid, up);
      return { ok: true };
    }
    if (m === 'POST' && p === '/event') {
      if (EVENT_TYPES.indexOf(body.type) < 0) fail(400, 'invalid event type');
      var at = nowISO(), b = S.fs.writeBatch(r.db);
      b.set(S.fs.doc(S.fs.collection(r.db, 'events')), { customerId: x.uid, type: body.type, target: str(body.target, 300), at: at });
      var cu = { lastSeenAt: at }; if (body.type === 'install') cu.installed = true;
      b.update(S.fs.doc(r.db, 'customers', x.uid), cu);
      await b.commit();
      return { ok: true };
    }
    return null;
  }

  /* ---- admin ---- */
  function applyContent(c, b, creating) {
    if (creating || b.title !== undefined) { var t = str(b.title, 200); if (!t) return 'title is required'; c.title = t; }
    if (creating || b.type !== undefined) { if (CONTENT_TYPES.indexOf(b.type) < 0) return 'invalid type'; c.type = b.type; }
    if (b.url !== undefined) c.url = str(b.url, 2000);
    if (b.thumb !== undefined) c.thumb = str(b.thumb, 200000);
    if (b.gallery !== undefined) {
      if (!Array.isArray(b.gallery)) return 'gallery must be array';
      c.gallery = b.gallery.filter(function (g) { return g && typeof g.src === 'string' && g.src.trim(); }).slice(0, 100).map(function (g) { return { title: str(g.title, 200), src: str(g.src, 2000000) }; });
    }
    if (b.targetTags !== undefined) { var a = strArr(b.targetTags); if (!a) return 'targetTags must be array'; c.targetTags = a; }
    if (b.active !== undefined) c.active = !!b.active;
    if (b.order !== undefined) { var n = Number(b.order); if (!isFinite(n)) return 'invalid order'; c.order = n; }
    c.updatedAt = nowISO();
    return null;
  }
  var colorOk = function (v) { return /^#[0-9a-fA-F]{3,8}$/.test(v || ''); };

  async function adminRoute(m, p, body) {
    var mm;
    if (m === 'POST' && p === '/login') {
      var email = str(body.email, 200).toLowerCase(), pw = typeof body.password === 'string' ? body.password : '';
      if (!email || !pw) fail(401, 'メールアドレスとパスワードを入力してください');
      if (!isAdminEmail(email)) fail(401, 'invalid credentials');
      var ra = await role('admin');
      try { var cred = await S.auth.signInWithEmailAndPassword(ra.auth, email, pw); }
      catch (e) { fail(401, 'メールアドレスまたはパスワードが違います'); }
      if (!isAdminEmail(cred.user.email)) { try { await S.auth.signOut(ra.auth); } catch (e) {} fail(401, 'invalid credentials'); }
      return { token: 'firebase', email: cred.user.email };
    }
    var r = await adminCtx();

    /* pushes */
    if (p === '/pushes') {
      if (m === 'GET') return (await allDocs(r, 'pushes')).sort(byDesc('createdAt'));
      if (m === 'POST') {
        var title = str(body.title, 100); if (!title) fail(400, 'title is required');
        var np = { id: newId('ps'), title: title, body: str(body.body, 500), url: str(body.url, 500) || '/', targetTags: strArr(body.targetTags) || [], createdAt: nowISO(), status: 'draft', sentCount: 0 };
        await setOne(r, 'pushes', np.id, np); return [201, np];
      }
    }
    if ((mm = p.match(/^\/pushes\/([^/]+)\/send$/)) && m === 'POST') {
      var sp = await getOne(r, 'pushes', mm[1]); if (!sp) fail(404, 'not found');
      var q = { status: 'queued', queuedAt: nowISO() };
      await patch(r, 'pushes', sp.id, q); Object.assign(sp, q);
      /* Spark plan has no server: a GitHub Actions cron (<=5 min) actually delivers, then sets status "sent" + sentCount */
      return { ok: true, queued: true, sentCount: sp.sentCount || 0, failed: 0, removed: 0, targets: null, push: sp };
    }
    if ((mm = p.match(/^\/pushes\/([^/]+)$/))) {
      var pp = await getOne(r, 'pushes', mm[1]); if (!pp) fail(404, 'not found');
      if (m === 'PUT') {
        var u = {};
        if (body.title !== undefined) { var t = str(body.title, 100); if (!t) fail(400, 'title is required'); u.title = t; }
        if (body.body !== undefined) u.body = str(body.body, 500);
        if (body.url !== undefined) u.url = str(body.url, 500) || '/';
        if (body.targetTags !== undefined) { var a = strArr(body.targetTags); if (!a) fail(400, 'targetTags must be array'); u.targetTags = a; }
        if (Object.keys(u).length) await patch(r, 'pushes', pp.id, u);
        return Object.assign(pp, u);
      }
      if (m === 'DELETE') { await delOne(r, 'pushes', pp.id); return { ok: true }; }
    }

    /* customers */
    if (m === 'GET' && p === '/customers') {
      var cs = await allDocs(r, 'customers');
      var counts = await Promise.all(cs.map(function (c) { return count(r, 'events', [W('customerId', '==', c.id)]).catch(function () { return 0; }); }));
      return cs.map(function (c, i) { return Object.assign(pubCustomer(c), { eventCount: counts[i] }); });
    }
    if ((mm = p.match(/^\/customers\/([^/]+)(?:\/(files|events|summary)(?:\/([^/]+))?)?$/))) {
      var cid = mm[1], sub = mm[2], fid = mm[3];
      var c = await getOne(r, 'customers', cid); if (!c) fail(404, 'not found');
      if (!sub) {
        if (m === 'GET') return pubCustomer(c);
        if (m === 'PUT') {
          var cu = {};
          if (body.tags !== undefined) { var ta = strArr(body.tags); if (!ta) fail(400, 'tags must be array'); cu.tags = ta; }
          if (body.status !== undefined) cu.status = str(body.status, 50);
          if (body.assignee !== undefined) cu.assignee = str(body.assignee, 50);
          if (body.memo !== undefined) cu.memo = str(body.memo, 5000);
          if (Object.keys(cu).length) await patch(r, 'customers', cid, cu);
          return pubCustomer(Object.assign(c, cu));
        }
      }
      if (sub === 'files') {
        if (m === 'GET' && !fid) return allDocs(r, 'personalFiles', [W('customerId', '==', cid)]);
        if (m === 'POST' && !fid) {
          var ft = str(body.title, 200), fu = str(body.url, 1000);
          if (!ft || !fu) fail(400, 'title and url are required');
          var f = { id: newId('pf'), customerId: cid, title: ft, kind: FILE_KINDS.indexOf(body.kind) >= 0 ? body.kind : 'file', url: fu, createdAt: nowISO() };
          await setOne(r, 'personalFiles', f.id, f); return [201, f];
        }
        if (m === 'DELETE' && fid) {
          var ex = await getOne(r, 'personalFiles', fid);
          if (!ex || ex.customerId !== cid) fail(404, 'not found');
          await delOne(r, 'personalFiles', fid); return { ok: true };
        }
      }
      if (sub === 'events' && m === 'GET') return (await allDocs(r, 'events', [W('customerId', '==', cid)])).sort(byDesc('at'));
      if (sub === 'summary' && m === 'GET') {
        var res = await Promise.all([allDocs(r, 'events', [W('customerId', '==', cid)]), allDocs(r, 'contents'), allDocs(r, 'conversions', [W('customerId', '==', cid)])]);
        return ruleSummary(c, res[0], res[1], res[2]);
      }
    }

    /* contents */
    if (p === '/contents') {
      if (m === 'GET') return (await allDocs(r, 'contents')).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      if (m === 'POST') {
        var all = await allDocs(r, 'contents');
        var nc = { id: newId('ct'), title: '', type: 'link', url: '', thumb: '', targetTags: [], active: true, order: all.reduce(function (mx, y) { return Math.max(mx, y.order || 0); }, 0) + 1, updatedAt: nowISO() };
        var err = applyContent(nc, body, true); if (err) fail(400, err);
        await setOne(r, 'contents', nc.id, nc); return [201, nc];
      }
    }
    if ((mm = p.match(/^\/contents\/([^/]+)$/))) {
      var ct = await getOne(r, 'contents', mm[1]); if (!ct) fail(404, 'not found');
      if (m === 'PUT') { var e2 = applyContent(ct, body, false); if (e2) fail(400, e2); await setOne(r, 'contents', ct.id, ct); return ct; }
      if (m === 'DELETE') { await delOne(r, 'contents', ct.id); return { ok: true }; }
    }

    /* tags */
    if (p === '/tags') {
      if (m === 'GET') return allDocs(r, 'tags');
      if (m === 'POST') {
        var nm = str(body.name, 50); if (!nm) fail(400, 'name is required');
        var tg = await allDocs(r, 'tags');
        if (tg.some(function (t) { return t.name === nm; })) fail(409, 'tag already exists');
        var nt = { id: newId('t'), name: nm, color: colorOk(body.color) ? body.color : '#0b3d91' };
        await setOne(r, 'tags', nt.id, nt); return [201, nt];
      }
    }
    if ((mm = p.match(/^\/tags\/([^/]+)$/))) {
      var tag = await getOne(r, 'tags', mm[1]); if (!tag) fail(404, 'not found');
      var rewrite = async function (oldName, newName) { /* rename (newName set) or remove (null) a tag everywhere */
        var ops = [];
        var jobs = [['customers', 'tags'], ['contents', 'targetTags'], ['pushes', 'targetTags']];
        for (var i = 0; i < jobs.length; i++) {
          var docs = await allDocs(r, jobs[i][0], [W(jobs[i][1], 'array-contains', oldName)]);
          docs.forEach(function (d) {
            var arr = (d[jobs[i][1]] || []).map(function (x) { return x === oldName ? newName : x; }).filter(function (x) { return x !== null; });
            var upd = {}; upd[jobs[i][1]] = arr; var col = jobs[i][0];
            ops.push(function (b) { b.update(S.fs.doc(r.db, col, d.id), upd); });
          });
        }
        await commitChunks(r, ops);
      };
      if (m === 'PUT') {
        var tu = {};
        if (body.color !== undefined) { if (!colorOk(body.color)) fail(400, 'invalid color'); tu.color = body.color; }
        if (body.name !== undefined) {
          var n2 = str(body.name, 50); if (!n2) fail(400, 'name is required');
          var others = await allDocs(r, 'tags');
          if (others.some(function (t) { return t.name === n2 && t.id !== tag.id; })) fail(409, 'tag already exists');
          if (n2 !== tag.name) await rewrite(tag.name, n2);
          tu.name = n2;
        }
        if (Object.keys(tu).length) await patch(r, 'tags', tag.id, tu);
        return Object.assign(tag, tu);
      }
      if (m === 'DELETE') { await rewrite(tag.name, null); await delOne(r, 'tags', tag.id); return { ok: true }; }
    }

    /* conversions */
    if (p === '/conversions') {
      if (m === 'GET') return (await allDocs(r, 'conversions')).sort(byDesc('at'));
      if (m === 'POST') {
        if (!(await getOne(r, 'customers', String(body.customerId || '_')))) fail(400, 'unknown customerId');
        if (CONV_KINDS.indexOf(body.kind) < 0) fail(400, 'invalid kind');
        var cv = { id: newId('cv'), customerId: body.customerId, kind: body.kind, at: body.at && !isNaN(Date.parse(body.at)) ? new Date(body.at).toISOString() : nowISO(), note: str(body.note, 500) };
        await setOne(r, 'conversions', cv.id, cv); return [201, cv];
      }
    }

    if (m === 'GET' && p === '/dashboard') {
      var since = new Date(Date.now() - 7 * 86400000).toISOString();
      var d = await Promise.all([count(r, 'customers'), count(r, 'customers', [W('installed', '==', true)]), count(r, 'pushes', [W('status', '==', 'sent')]), count(r, 'events', [W('at', '>=', since)]), count(r, 'conversions')]);
      return { customers: d[0], installed: d[1], pushesSent: d[2], events7d: d[3], conversions: d[4] };
    }

    if (p === '/property') {
      if (m === 'GET') return getProperty(r);
      if (m === 'PUT') {
        var cur = await getProperty(r);
        if (body.name !== undefined) { var pn = str(body.name, 200); if (!pn) fail(400, 'name is required'); cur.name = pn; }
        if (body.tagline !== undefined) cur.tagline = str(body.tagline, 1000);
        if (body.heroImage !== undefined) cur.heroImage = str(body.heroImage, 2000000);
        ['heroImageSp', 'logo', 'clientLogo'].forEach(function (k) { if (body[k] !== undefined) cur[k] = str(body[k], 2000000); });
        if (body.clientName !== undefined) cur.clientName = str(body.clientName, 200);
        if (body.gtmId !== undefined) { var g = str(body.gtmId, 30); if (g && !/^GTM-[A-Z0-9]+$/.test(g)) fail(400, 'invalid gtmId'); cur.gtmId = g; }
        await setOne(r, 'property', 'main', cur);
        return getProperty(r);
      }
    }
    return null;
  }

  /* ---- dispatcher ---- */
  async function route(method, path, body, headers) {
    var p = path.replace(/\/+$/, '') || '/';
    if (method === 'GET' && p === '/property') return getProperty(await role('customer'));
    if (method === 'GET' && p === '/vapid-public-key') {
      var s = await getOne(await role('customer'), 'settings', 'public');
      if (!s || !s.vapidPublicKey) fail(404, 'not found');
      return { key: s.vapidPublicKey };
    }
    if (method === 'POST' && p === '/register') return register(body);
    var out = /^\/admin\//.test(p) ? await adminRoute(method, p.slice(6), body) : await customerRoute(method, p, body);
    if (out === null) fail(404, 'not found');
    return out;
  }

  async function handle(method, path, body, headers) {
    try {
      var out = await route(String(method || 'GET').toUpperCase(), path, body || {}, headers || {});
      if (Array.isArray(out) && typeof out[0] === 'number') return { status: out[0], json: out[1] };
      return { status: 200, json: out };
    } catch (e) {
      if (e instanceof HttpErr) return { status: e.status, json: { error: e.msg } };
      var code = e && e.code ? String(e.code) : '';
      if (code.indexOf('permission-denied') >= 0) return { status: /^\/admin\//.test(path) ? 401 : 403, json: { error: 'permission denied' } };
      if (code.indexOf('unauthenticated') >= 0) return { status: 401, json: { error: 'unauthorized' } };
      if (code.indexOf('unavailable') >= 0 || code.indexOf('network') >= 0) return { status: 503, json: { error: 'offline' } };
      if (G.console) G.console.warn('[firebase-api]', method, path, e);
      return { status: 500, json: { error: (e && e.message) || 'internal error' } };
    }
  }

  function install() {
    if (!G.fetch || G.fetch.__gentei_fb) return;
    var orig = G.fetch.bind(G);
    var f = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (url.indexOf(FB_ROOT) !== 0) return orig(input, init);
      init = init || {};
      var rest = url.slice(FB_ROOT.length), q = rest.indexOf('?');
      var path = q >= 0 ? rest.slice(0, q) : rest;
      var method = init.method || (typeof input !== 'string' && input.method) || 'GET';
      var body = {};
      try { if (init.body) body = JSON.parse(init.body); } catch (e) { return Promise.resolve(new Response('{"error":"invalid JSON"}', { status: 400, headers: { 'content-type': 'application/json' } })); }
      return handle(method, path, body, init.headers).then(function (o) {
        return new Response(JSON.stringify(o.json), { status: o.status, headers: { 'content-type': 'application/json' } });
      });
    };
    f.__gentei_fb = true;
    G.fetch = f;
  }

  function signOutAdmin() {
    return role('admin').then(function (r) { return S.auth.signOut(r.auth); }).catch(function () {});
  }

  G.GenteiFirebaseApi = { signOutAdmin: signOutAdmin, handle: handle, ruleSummary: ruleSummary, install: install, FB_ROOT: FB_ROOT };
  if (C.apiBase === 'firebase') install();
})(typeof self !== 'undefined' ? self : globalThis);
