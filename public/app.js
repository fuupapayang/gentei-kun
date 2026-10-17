/* 限定くん customer PWA — shared script (home / register / install) */
(function () {
  'use strict';
  var TOKEN_KEY = 'aplika.token';
  var qs = new URLSearchParams(location.search);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var token = function () { return lsGet(TOKEN_KEY) || ''; };

  function api(path, opt) {
    opt = opt || {};
    var h = { 'content-type': 'application/json' };
    if (token()) h['x-customer-token'] = token();
    return fetch(gApi(path), { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; } return j; }); });
  }
  function logEvent(type, target) {
    if (!token()) return Promise.resolve();
    return api('/event', { method: 'POST', body: { type: type, target: target == null ? '' : String(target) } }).catch(function () {});
  }

  var isApp = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true || qs.get('app') === '1';
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var platform = isIOS ? 'ios' : isAndroid ? 'android' : 'pc';
  if (isApp) document.documentElement.classList.add('is-app'), document.addEventListener('DOMContentLoaded', function () { document.body.classList.add('is-app'); });
  if (document.body && isApp) document.body.classList.add('is-app');

  function toast(msg) {
    var t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2800);
  }
  function toURL(v) { v = v || ''; if (/^\s*<svg/i.test(v)) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(v); return v; }
  function svgURL(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function fmtDate(t) { if (!t) return ''; var d = new Date(t); if (isNaN(d)) return ''; return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); }

  /* ---------- property info (all pages) ---------- */
  var propertyP = fetch(gApi('/property')).then(function (r) { return r.json(); }).catch(function () { return null; });
  var S_CLIENT = { name: '株式会社エスコン', logo: gUrl('/assets/img/common_escon.svg') };
  function applyProperty(p) {
    if (!p) return;
    $$('.pname').forEach(function (e) { e.textContent = p.name; });
    var m = { logoName: p.name, footName: p.name, propName: p.name, propTag: p.tagline, spName: p.name, spTag: p.tagline };
    Object.keys(m).forEach(function (id) { var e = document.getElementById(id); if (e) e.textContent = m[id] || ''; });
    var real = function (u) { return u && !/^data:|^\s*<svg/i.test(u) ? gUrl(u) : ''; };
    if (real(p.heroImage) && $('#heroImg')) $('#heroImg').src = gUrl(p.heroImage);
    if (real(p.heroImageSp) && $('#heroSp')) $('#heroSp').srcset = gUrl(p.heroImageSp);
    if (real(p.logo) && $('#propLogo')) $('#propLogo').src = gUrl(p.logo);
    S_CLIENT.name = p.clientName || S_CLIENT.name; S_CLIENT.logo = real(p.clientLogo) || S_CLIENT.logo;
    $$('img.escon-logo').forEach(function (i) { i.src = S_CLIENT.logo; });
    if (p.gtmId && !window.__gtm) {
      window.__gtm = 1; window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(p.gtmId); document.head.appendChild(s);
    }
    document.title = document.title.replace(/｜限定くん$/, '') + '｜' + p.name;
  }
  propertyP.then(applyProperty);

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register(gUrl('/sw.js'), { scope: gUrl('/') }).catch(function () {}); });
  }

  var page = document.body.dataset.page;

  /* =================================================================
     HOME
  ================================================================= */
  function initHome() {
    var head = $('#head');
    var onScroll = function () { head.classList.toggle('solid', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    if (token()) $$('.head-cta,#ctaHero').forEach(function (a) { a.textContent = 'ご登録情報の再送・更新'; });

    if (!isApp) return;
    if (!token()) {
      // installed but no token (e.g. iOS separate storage): allow re-identification via register
      var fab0 = $('#fab'); fab0.classList.add('on'); fab0.firstChild.textContent = '会員登録をする ';
      fab0.addEventListener('click', function () { location.href = gUrl('/register.html'); });
      return;
    }

    var fab = $('#fab'); fab.classList.add('on');
    document.body.style.paddingBottom = '90px';

    // events
    if (!sessionStorage.getItem('aplika.login')) { try { sessionStorage.setItem('aplika.login', '1'); } catch (e) {} logEvent('login', platform); }
    if (!lsGet('aplika.installLogged')) { lsSet('aplika.installLogged', '1'); logEvent('install', platform); }
    var pushId = qs.get('push');
    if (pushId) { logEvent('push_open', pushId); }

    var S = { me: null, contents: [], personal: [], pushes: [] };
    var loadP = Promise.all([api('/me'), api('/contents'), api('/pushes')]).then(function (r) {
      S.me = r[0].customer; S.contents = (r[1] && r[1].contents) || []; S.personal = (r[1] && r[1].personalFiles) || [];
      S.pushes = Array.isArray(r[2]) ? r[2] : (r[2] && r[2].pushes) || [];
      updateBadge();
    }).catch(function (e) { if (e.status === 401) { toast('ログイン情報が無効です。再度ご登録ください。'); } });

    // first launch: ask for notifications right away (browsers require the user's own tap, so this is a one-tap sheet)
    loadP.then(function () {
      if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return;
      if (Notification.permission === 'granted') { ensurePushSaved(); return; }
      if (Notification.permission !== 'default') return;
      var later = parseInt(lsGet('aplika.notifLater') || '0', 10);
      if (later && Date.now() - later < 7 * 86400000) return;
      var sh = document.createElement('div');
      sh.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center';
      sh.innerHTML = '<div style="background:#fff;color:#222;width:100%;max-width:520px;border-radius:18px 18px 0 0;padding:26px 22px calc(26px + env(safe-area-inset-bottom));text-align:center;font-family:inherit">'
        + '<div style="font-size:19px;font-weight:700;margin-bottom:8px">新着の限定情報を受け取る</div>'
        + '<p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#555">モデルルームのご案内や限定コンテンツの更新を、通知でお知らせします。次の画面で「許可」を選んでください。</p>'
        + '<button type="button" id="npOn" style="display:block;width:100%;padding:15px;border:0;border-radius:999px;background:#c00000;color:#fff;font-size:16px;font-weight:700;margin-bottom:10px">通知をオンにする</button>'
        + '<button type="button" id="npLater" style="display:block;width:100%;padding:12px;border:0;background:none;color:#888;font-size:14px">あとで</button></div>';
      document.body.appendChild(sh);
      sh.querySelector('#npOn').addEventListener('click', function () { sh.remove(); enablePush(); });
      sh.querySelector('#npLater').addEventListener('click', function () { lsSet('aplika.notifLater', String(Date.now())); sh.remove(); });
    });

    function seen() { try { return JSON.parse(lsGet('aplika.seen') || '[]'); } catch (e) { return []; } }
    function unreadList() { var s = seen(); return S.pushes.filter(function (p) { return s.indexOf(p.id) < 0; }); }
    function updateBadge() {
      var n = unreadList().length, b = $('#fabBadge');
      b.textContent = n; b.hidden = !n;
      if ('setAppBadge' in navigator) { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(function () {}); }
    }
    function markSeen() { lsSet('aplika.seen', JSON.stringify(S.pushes.map(function (p) { return p.id; }))); updateBadge(); }

    var modal;
    function buildModal() {
      modal = document.createElement('div'); modal.className = 'modal';
      modal.innerHTML = '<div class="win" role="dialog" aria-modal="true"><div class="win-head"><img class="win-brand" src="' + S_CLIENT.logo + '" alt="ES CON"><div class="eyebrow">MEMBERS ONLY</div><h2 id="mName">&nbsp;</h2></div><div class="win-body" id="mBody"></div><div class="win-foot"><button class="btn btn-blue btn-block" id="mClose">CLOSE</button><div class="prov">提供 ' + esc(S_CLIENT.name) + '</div></div></div>';
      document.body.appendChild(modal);
      $('#mClose', modal).addEventListener('click', closeModal);
      modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    }
    function openModal() {
      if (!modal) buildModal();
      modal.classList.add('on'); document.body.style.overflow = 'hidden';
      $('#mBody').innerHTML = '<div class="empty">読み込み中…</div>';
      loadP.then(function () { render(); });
    }
    function closeModal() { if (!modal) return; modal.classList.remove('on'); document.body.style.overflow = ''; markSeen(); }
    $$('[data-open]').forEach(function (b) { b.addEventListener('click', openModal); });
    fab.addEventListener('click', openModal);

    function isNew(t) { if (!t) return false; var d = new Date(t).getTime(); return d && Date.now() - d < 7 * 86400000; }
    var ICON = {
      folder: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
      gallery: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/></svg>',
      vr: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M2 8h20v8a2 2 0 0 1-2 2h-4l-2-3h-4l-2 3H4a2 2 0 0 1-2-2z"/></svg>',
      pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 14h6M9 17h6"/></svg>',
      video: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>',
      link: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
      person: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>'
    };
    var TYPE_LABEL = { folder: 'FOLDER', gallery: 'CG GALLERY', vr: 'VR', pdf: 'PDF', video: 'VIDEO', link: 'LINK' };
    var GRAD = { folder: ['#0b3d91', '#3b6fc4'], gallery: ['#8f0000', '#d4503f'], vr: ['#061946', '#2a6fdb'], pdf: ['#5a1a1a', '#c00000'], video: ['#1a2a55', '#c00000'], link: ['#0b3d91', '#061946'] };
    var IMG = gUrl('/assets/img/');
    var THUMB_FB = { folder: IMG + 'top_concept.jpg', gallery: IMG + 'top_entry_merit_3.jpg', vr: IMG + 'top_entry_merit_2.jpg', pdf: IMG + 'top_plan_1.png', video: IMG + 'top_entry_merit_6.jpg', link: IMG + 'top_loca_1.jpg' };
    function thumbStyle(c) {
      var t = c.thumb && !/^data:image\/svg|^\s*<svg/i.test(c.thumb) ? gUrl(c.thumb) : THUMB_FB[c.type];
      if (t) return "background-image:url('" + esc(t) + "')" + (c.type === 'pdf' && !c.thumb ? ';background-color:#0b2a6a;background-size:contain;background-repeat:no-repeat' : '');
      if (c.thumb) return "background-image:url('" + esc(toURL(c.thumb)) + "')";
      var g = GRAD[c.type] || GRAD.folder;
      return 'background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')';
    }

    function render() {
      var me = S.me || {};
      $('#mName').innerHTML = esc(me.name || 'お客') + '<small>様</small>';
      var latest = S.pushes[0];
      var un = unreadList();
      var h = '<div class="limit-card"><span class="tag">お客様限定情報</span><h3>' + esc(latest ? latest.title : 'ご登録ありがとうございます') + '</h3><p>' +
        esc(latest ? latest.body : 'ご登録者様だけの限定情報をお届けします。通知を許可いただくと、新着情報をいち早くお知らせします。') + '</p>' +
        '<button class="btn btn-red btn-sm" id="notifBtn">通知を許可</button> <button class="btn btn-sm" id="notifTest" type="button" style="margin-left:6px">テスト通知を表示</button><div class="notif-state" id="notifState"></div></div>';

      h += '<div class="sec-title">CONTENTS</div><div class="grid">';
      if (S.personal.length) {
        var nPers = S.personal.some(function (f) { return isNew(f.createdAt); });
        h += '<button class="tile personal" data-personal>' + (nPers ? '<span class="new">NEW</span>' : '') + '<div class="th">' + ICON.person + '</div><div class="nm"><b>' + esc(me.name || '') + '様 専用</b><small>PERSONAL FOLDER・' + S.personal.length + '件</small></div></button>';
      }
      S.contents.forEach(function (c, i) {
        h += '<button class="tile" data-c="' + i + '">' + (isNew(c.updatedAt) ? '<span class="new">NEW</span>' : '') +
          '<div class="th" style="' + thumbStyle(c) + '">' + (ICON[c.type] || ICON.link) + '</div><div class="nm"><b>' + esc(c.title) + '</b><small>' + (TYPE_LABEL[c.type] || '') + '</small></div></button>';
      });
      if (!S.contents.length && !S.personal.length) h += '<div class="empty" style="grid-column:1/-1">現在公開中のコンテンツはありません。</div>';
      h += '</div>';

      h += '<div class="sec-title">NOTIFICATION' + (un.length ? ' <span class="badge-n" style="background:var(--red);color:#fff">' + un.length + '</span>' : '') + '</div><div class="hist">';
      if (S.pushes.length) {
        var s = seen();
        S.pushes.slice(0, 20).forEach(function (p) {
          h += '<button class="it ' + (s.indexOf(p.id) < 0 ? 'unread' : '') + '" data-push="' + esc(p.id) + '"><i class="dot"></i><div><b>' + esc(p.title) + '</b><span>' + esc(p.body) + '</span><time>' + fmtDate(p.createdAt) + '</time></div></button>';
        });
      } else h += '<div class="empty">お知らせはまだありません。</div>';
      h += '</div><div style="height:10px"></div>';
      $('#mBody').innerHTML = h;
      refreshNotifState();
      $('#notifBtn').addEventListener('click', enablePush);
      $('#notifTest').addEventListener('click', function () {
        var st = $('#notifState');
        if (!('serviceWorker' in navigator) || !('Notification' in window)) return toast('通知に対応していない環境です');
        if (Notification.permission !== 'granted') { st.textContent = '通知が許可されていません(状態: ' + Notification.permission + ')'; return; }
        navigator.serviceWorker.ready.then(function (reg) {
          return reg.showNotification('限定くん テスト通知', { body: 'この端末の通知表示は正常です', icon: gUrl('/icons/icon-192.png'), tag: 'gentei-test-' + Date.now() });
        }).then(function () { st.textContent = 'テスト通知を送りました。表示されない場合は、端末の通知設定(集中モードなど)を確認してください。'; })
          .catch(function (e) { st.textContent = 'テスト通知に失敗: ' + (e && e.message || e); });
      });
      $$('[data-c]', modal).forEach(function (b) { b.addEventListener('click', function () { openContent(S.contents[+b.dataset.c]); }); });
      var pb = $('[data-personal]', modal); if (pb) pb.addEventListener('click', renderPersonal);
      $$('[data-push]', modal).forEach(function (b) {
        b.addEventListener('click', function () {
          var p = S.pushes.filter(function (x) { return x.id === b.dataset.push; })[0];
          logEvent('push_open', p.id);
          if (p && p.url && p.url !== '/') { window.open(gUrl(p.url), '_blank'); } else toast(p.title);
        });
      });
    }

    function renderPersonal() {
      var me = S.me || {};
      var h = '<button class="btn btn-line btn-sm" id="pBack" style="margin-bottom:14px">← 戻る</button><div class="sec-title">' + esc(me.name) + '様 専用フォルダ</div><div class="hist">';
      S.personal.forEach(function (f, i) {
        var k = { file: 'FILE', link: 'LINK', mail: 'MAIL' }[f.kind] || 'FILE';
        h += '<button class="it ' + (isNew(f.createdAt) ? 'unread' : '') + '" data-f="' + i + '"><i class="dot"></i><div><b>' + esc(f.title) + '</b><span>' + k + '</span><time>' + fmtDate(f.createdAt) + '</time></div></button>';
      });
      h += '</div>';
      $('#mBody').innerHTML = h; $('#mBody').scrollTop = 0;
      $('#pBack').addEventListener('click', render);
      $$('[data-f]', modal).forEach(function (b) {
        b.addEventListener('click', function () {
          var f = S.personal[+b.dataset.f]; logEvent('content', f.id);
          if (/\.pdf(\?|#|$)/i.test(f.url || '')) openFrame(f.title, gUrl(f.url)); else if (f.url) window.open(gUrl(f.url), '_blank'); else toast('準備中です');
        });
      });
    }

    /* ---- push ---- */
    function refreshNotifState() {
      var st = $('#notifState'), btn = $('#notifBtn'); if (!st) return;
      if (!('Notification' in window) || !('PushManager' in window)) { st.textContent = 'お使いの環境ではプッシュ通知に対応していません（iPhoneはホーム画面から起動してください）。'; btn.disabled = true; return; }
      if (Notification.permission === 'granted') { st.innerHTML = '<span class="notif-on">通知はオンです</span>'; btn.textContent = '通知を再登録'; ensurePushSaved(); }
      else if (Notification.permission === 'denied') { st.textContent = '通知がブロックされています。端末の設定からお許しください。'; }
    }
    function b64(v) { var p = '='.repeat((4 - v.length % 4) % 4); var r = atob((v + p).replace(/-/g, '+').replace(/_/g, '/')); var o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
    function withTimeout(pr, ms, msg) { return Promise.race([pr, new Promise(function (_, rej) { setTimeout(function () { rej(new Error(msg)); }, ms); })]); }
    // subscribe (or reuse the subscription) and save it to the customer record; verifies the save
    function savePushSub() {
      return Promise.all([
        withTimeout(navigator.serviceWorker.ready, 10000, 'Service Workerが起動していません。アプリを一度閉じて開き直してください'),
        api('/vapid-public-key')
      ]).then(function (r) {
        var reg = r[0], key = r[1].key;
        if (!key) throw new Error('通知用の鍵が取得できません');
        return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }); });
      }).then(function (sub) {
        return api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON ? sub.toJSON() : sub, platform: platform } });
      });
    }
    var pushEnsured = false;
    // permission already granted (e.g. earlier attempt) but the subscription may never have been saved: re-save silently once per launch
    function ensurePushSaved() {
      if (pushEnsured || !('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return;
      pushEnsured = true;
      savePushSub().catch(function (e) { console.warn('push resave failed', e); var st = $('#notifState'); if (st) st.textContent = '通知の登録に失敗しました: ' + (e && e.message || e); });
    }
    function enablePush() {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) return toast('通知に対応していない環境です');
      Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') { refreshNotifState(); return toast('通知は許可されませんでした'); }
        return savePushSub().then(function () { toast('通知をオンにしました'); refreshNotifState(); });
      }).catch(function (e) { var m = '通知の設定に失敗しました: ' + (e && e.message || e); toast(m); var st = $('#notifState'); if (st) st.textContent = m; console.warn(e); });
    }

    /* ---- content viewers ---- */
    function openContent(c) {
      if (!c) return;
      logEvent(c.type === 'vr' ? 'vr' : 'content', c.id);
      var u = gUrl(c.url || '');
      if (c.type === 'vr') return openVR(c);
      if (c.type === 'gallery') return openGallery(c);
      if (c.type === 'video') return openVideo(c);
      if (c.type === 'pdf') return u ? openFrame(c.title, u) : toast('資料は準備中です');
      if (u) return window.open(u, '_blank');
      toast('準備中です');
    }
    function viewerShell(title) {
      var v = document.createElement('div'); v.className = 'viewer on';
      v.innerHTML = '<div class="v-bar"><b>' + esc(title) + '</b><button class="v-x">CLOSE</button></div>';
      document.body.appendChild(v);
      v._close = function () { if (v._cleanup) v._cleanup(); v.remove(); };
      $('.v-x', v).addEventListener('click', v._close);
      return v;
    }
    function openFrame(title, url) {
      var v = viewerShell(title);
      v.insertAdjacentHTML('beforeend', '<iframe class="v-frame" src="' + esc(url) + '"></iframe>');
    }
    function openVideo(c) {
      var v = viewerShell(c.title), u = gUrl(c.url || '');
      if (!/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u) && !/youtu/.test(u) && (!u || /example\.com|^#|^cg:/.test(u))) u = gUrl('/assets/video/top_sp.mp4');
      var yt = u.match(/(?:youtu\.be\/|v=)([\w-]{6,})/);
      if (yt) v.insertAdjacentHTML('beforeend', '<iframe class="v-frame" allow="autoplay; fullscreen" allowfullscreen src="https://www.youtube.com/embed/' + yt[1] + '?autoplay=1&playsinline=1"></iframe>');
      else if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) v.insertAdjacentHTML('beforeend', '<video class="v-video" src="' + esc(u) + '" poster="' + esc(gUrl(c.poster || '/assets/img/top_mv_sp.jpg')) + '" controls autoplay muted playsinline preload="metadata"></video>');
      else if (u) v.insertAdjacentHTML('beforeend', '<iframe class="v-frame" allowfullscreen src="' + esc(u) + '"></iframe>');
      else v.insertAdjacentHTML('beforeend', '<div class="v-ph"><div><h3>' + esc(c.title) + '</h3><p style="opacity:.7;font-size:13px">動画は準備中です。</p></div></div>');
    }

    /* generated scenes (used when no real image url) */
    var SCENES = [
      ['リビング', '#f2e7d5', '#c9a97a', '#0b3d91'], ['ダイニング', '#efe9e4', '#9a7f64', '#8f0000'], ['エントランス', '#e5e9f3', '#7a8cb3', '#061946'],
      ['ベッドルーム', '#f0e4e4', '#b38a8a', '#c00000'], ['ラウンジ', '#dfe7f5', '#5d7fb8', '#0b3d91'], ['外観', '#cfe0f7', '#2b4f8f', '#061946']
    ];
    function sceneSVG(i) {
      var s = SCENES[i % SCENES.length], W = 1600, H = 1000;
      var lamp = '<g><line x1="800" y1="0" x2="800" y2="190" stroke="#222" stroke-width="3"/><path d="M730 190 Q800 120 870 190 Z" fill="' + s[3] + '"/><ellipse cx="800" cy="200" rx="60" ry="14" fill="#fff6c7" opacity=".9"/></g>';
      var win = '<g><rect x="1020" y="150" width="400" height="460" fill="url(#sky)"/><path d="M1020 540 L1120 430 L1210 520 L1300 400 L1420 530 L1420 610 L1020 610 Z" fill="' + s[3] + '" opacity=".35"/>' +
        '<g stroke="#fff" stroke-width="10" fill="none"><rect x="1020" y="150" width="400" height="460"/><line x1="1220" y1="150" x2="1220" y2="610"/><line x1="1020" y1="380" x2="1420" y2="380"/></g></g>';
      var sofa = '<g><rect x="160" y="640" width="640" height="150" rx="30" fill="' + s[3] + '"/><rect x="190" y="580" width="580" height="110" rx="26" fill="' + s[3] + '" opacity=".85"/><rect x="190" y="780" width="30" height="40" fill="#222"/><rect x="740" y="780" width="30" height="40" fill="#222"/>' +
        '<rect x="260" y="610" width="120" height="100" rx="14" fill="' + s[1] + '"/><rect x="590" y="610" width="120" height="100" rx="14" fill="#c00000"/></g>';
      var table = '<g><ellipse cx="1000" cy="870" rx="210" ry="38" fill="#2a2018"/><rect x="990" y="820" width="20" height="50" fill="#2a2018"/><ellipse cx="1000" cy="818" rx="200" ry="30" fill="' + s[2] + '"/></g>';
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"><defs>' +
        '<linearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + s[1] + '"/><stop offset="1" stop-color="' + s[2] + '"/></linearGradient>' +
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb7ee"/><stop offset="1" stop-color="#fbeedc"/></linearGradient>' +
        '<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + s[2] + '"/><stop offset="1" stop-color="#3b2d22"/></linearGradient></defs>' +
        '<rect width="' + W + '" height="' + H + '" fill="url(#wall)"/><rect y="760" width="' + W + '" height="240" fill="url(#fl)"/>' +
        '<g opacity=".18" stroke="#000"><line x1="0" y1="760" x2="1600" y2="760"/></g>' + win + lamp + sofa + table +
        '<text x="60" y="940" font-family="serif" font-size="46" fill="#fff" opacity=".9" letter-spacing="10">' + s[0] + '</text></svg>';
    }
    function panoSVG() {
      var W = 2048, H = 1024, o = '';
      o += '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1f55"/><stop offset=".45" stop-color="#3b6fc4"/><stop offset=".62" stop-color="#f6c9a0"/></linearGradient><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a5ca8"/><stop offset="1" stop-color="#061946"/></linearGradient></defs>';
      o += '<rect width="' + W + '" height="' + H + '" fill="url(#s)"/>';
      for (var i = 0; i < 120; i++) { var sx = (i * 977) % W, sy = (i * 331) % 300; o += '<circle cx="' + sx + '" cy="' + sy + '" r="' + (1 + i % 3 * .6) + '" fill="#fff" opacity="' + (0.3 + (i % 5) * .12) + '"/>'; }
      o += '<circle cx="1536" cy="560" r="64" fill="#ffe3b0" opacity=".95"/><circle cx="1536" cy="560" r="130" fill="#ffd9a0" opacity=".25"/>';
      // periodic mountains
      var pts = 'M0 ' + H * .6; for (var x = 0; x <= W; x += 16) pts += ' L' + x + ' ' + (560 - (60 + 40 * Math.sin(x / W * Math.PI * 6) + 25 * Math.sin(x / W * Math.PI * 14 + 1)));
      pts += ' L' + W + ' ' + H * .6 + ' Z'; o += '<path d="' + pts + '" fill="#1d3b78" opacity=".8"/>';
      // skyline
      var bx = 0, k = 0; while (bx < W) { var bw = 50 + (k * 37) % 70, bh = 60 + (k * 53) % 200; if (bx + bw > W) bw = W - bx; var by = 600 - bh; o += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" fill="#0a1a44"/>'; for (var wy = by + 10; wy < 590; wy += 18) for (var wx = bx + 8; wx < bx + bw - 8; wx += 14) if (((wx * 7 + wy * 13) % 5) < 2) o += '<rect x="' + wx + '" y="' + wy + '" width="5" height="8" fill="#ffd98a" opacity=".85"/>'; bx += bw + 6; k++; }
      o += '<rect y="600" width="' + W + '" height="' + (H - 600) + '" fill="url(#w)"/>';
      for (var j = 0; j < 40; j++) { var ly = 610 + j * j * .25; o += '<line x1="0" y1="' + ly + '" x2="' + W + '" y2="' + ly + '" stroke="#9cc0ff" stroke-width="' + (1 + j / 14) + '" opacity=".08"/>'; }
      o += '<path d="M1480 610 L1592 610 L1640 900 L1432 900 Z" fill="#ffd9a0" opacity=".25"/>';
      // rooftop terrace railing / floor at bottom (nadir)
      o += '<rect y="900" width="' + W + '" height="124" fill="#14100c"/><g stroke="#3a2f26">'; for (var t = 0; t < W; t += 64) o += '<line x1="' + t + '" y1="900" x2="' + t + '" y2="' + H + '"/>'; o += '</g>';
      o += '<text x="512" y="480" font-family="serif" font-size="44" fill="#fff" opacity=".85" text-anchor="middle" letter-spacing="8">PENTHOUSE VIEW</text>';
      o += '<text x="1536" y="480" font-family="serif" font-size="36" fill="#fff" opacity=".7" text-anchor="middle" letter-spacing="8">SEA SIDE</text>';
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + o + '</svg>';
    }

    function isImg(u) { return /\.(png|jpe?g|webp|gif|svg|avif)(\?|#|$)/i.test(u || '') || /^data:image\//.test(u || ''); }

    function openGallery(c) {
      var v = viewerShell(c.title), slides = [], caps = [];
      var G = Array.isArray(c.gallery) ? c.gallery.filter(function (g) { return g && g.src; }) : [];
      if (G.length) G.forEach(function (g) { slides.push(gUrl(g.src)); caps.push(g.title || c.title); });
      else {
        if (isImg(c.url)) { slides.push(gUrl(c.url)); caps.push(c.title); }
        [['top_concept.jpg', '外観'], ['top_design_2.png', 'エントランス外観'], ['top_design_1.png', 'エントランスホール'], ['top_entry_merit_2.jpg', 'リビング'], ['top_entry_merit_6.jpg', 'キッチン'], ['top_entry_merit_4.jpg', 'アプローチ']]
          .forEach(function (g) { slides.push(gUrl('/assets/img/') + g[0]); caps.push(g[1]); });
      }
      var idx = 0;
      v.insertAdjacentHTML('beforeend', '<div class="v-stage"><div class="gal-track">' + slides.map(function (s) { return '<div class="sl"><img draggable="false" src="' + esc(s) + '" alt=""></div>'; }).join('') + '</div>' +
        '<button class="gal-nav l">‹</button><button class="gal-nav r">›</button><div class="gal-cap"></div><div class="gal-dots">' + slides.map(function () { return '<i></i>'; }).join('') + '</div></div>');
      var track = $('.gal-track', v), dots = $$('.gal-dots i', v), cap = $('.gal-cap', v), stage = $('.v-stage', v);
      function go(n) { idx = Math.max(0, Math.min(slides.length - 1, n)); track.style.transition = ''; track.style.transform = 'translateX(' + (-idx * 100) + '%)'; dots.forEach(function (d, i) { d.classList.toggle('on', i === idx); }); cap.textContent = caps[idx] + '  ' + (idx + 1) + ' / ' + slides.length; }
      go(0);
      $('.gal-nav.l', v).addEventListener('click', function () { go(idx - 1); });
      $('.gal-nav.r', v).addEventListener('click', function () { go(idx + 1); });
      var sx = null, dx = 0;
      stage.addEventListener('pointerdown', function (e) { sx = e.clientX; dx = 0; stage.setPointerCapture(e.pointerId); track.style.transition = 'none'; });
      stage.addEventListener('pointermove', function (e) { if (sx == null) return; dx = e.clientX - sx; track.style.transform = 'translateX(calc(' + (-idx * 100) + '% + ' + dx + 'px))'; });
      var end = function () { if (sx == null) return; sx = null; if (dx < -50) go(idx + 1); else if (dx > 50) go(idx - 1); else go(idx); };
      stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
      var key = function (e) { if (e.key === 'ArrowLeft') go(idx - 1); if (e.key === 'ArrowRight') go(idx + 1); if (e.key === 'Escape') v._close(); };
      document.addEventListener('keydown', key); v._cleanup = function () { document.removeEventListener('keydown', key); };
    }

    function openVR(c) {
      var u = gUrl(c.url || '');
      if (u && !isImg(u) && !/example\.com|^#/.test(u)) return openFrame(c.title, u); // external 360 tour
      if (!isImg(u)) u = gUrl('/assets/img/top_mv.jpg'); // fallback: wide real image wrapped in the drag viewer
      var v = viewerShell(c.title);
      v.insertAdjacentHTML('beforeend', '<div class="v-stage"><canvas></canvas><div class="v-hint">ドラッグして360°見渡せます</div></div><div class="v-ctrl"><button data-z="-1">－</button><button data-z="1">＋</button><button data-auto class="on">自動</button></div>');
      var cv = $('canvas', v), ctx = cv.getContext('2d'), stage = $('.v-stage', v);
      var img = new Image(), src, sw = 0, sh = 0, sd;
      var yaw = 0, pitch = 0.12, fov = 90 * Math.PI / 180, auto = true, drag = null, vel = 0, raf = 0, dead = false;
      var OW = 0, OH = 0, out;
      function size() {
        var r = stage.getBoundingClientRect(), sc = Math.min(1, 560 / Math.max(r.width, r.height));
        cv.width = OW = Math.max(120, Math.round(r.width * sc)); cv.height = OH = Math.max(120, Math.round(r.height * sc));
        out = ctx.createImageData(OW, OH);
      }
      function draw() {
        if (!sd) return;
        var f = (OH / 2) / Math.tan(fov / 2) * 1; // vertical fov
        var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), d = out.data, i = 0;
        for (var y = 0; y < OH; y++) {
          var py = -(y - OH / 2);
          for (var x = 0; x < OW; x++, i += 4) {
            var px = x - OW / 2;
            // ray in camera space (x right, y up, z forward)
            var rx = px, ry = py, rz = f;
            // pitch
            var y1 = ry * cp + rz * sp, z1 = -ry * sp + rz * cp;
            // yaw
            var x2 = rx * cy + z1 * sy, z2 = -rx * sy + z1 * cy;
            var lon = Math.atan2(x2, z2), lat = Math.atan2(y1, Math.sqrt(x2 * x2 + z2 * z2));
            var u = ((lon / (2 * Math.PI) + .5) * sw) | 0, vv = ((.5 - lat / Math.PI) * sh) | 0;
            if (u >= sw) u = sw - 1; if (u < 0) u = 0; if (vv >= sh) vv = sh - 1; if (vv < 0) vv = 0;
            var s = (vv * sw + u) * 4;
            d[i] = sd[s]; d[i + 1] = sd[s + 1]; d[i + 2] = sd[s + 2]; d[i + 3] = 255;
          }
        }
        ctx.putImageData(out, 0, 0);
      }
      function loop() {
        if (dead) return;
        if (drag == null) { if (auto) yaw += .0035; else { yaw += vel; vel *= .94; } }
        draw(); raf = requestAnimationFrame(loop);
      }
      img.onload = function () {
        sw = Math.min(img.naturalWidth || 2048, 2048); sh = Math.min(img.naturalHeight || 1024, 1024);
        if (sh * 2 !== sw) { sh = Math.round(sw / 2); } // stretch non-2:1 images to equirect
        var oc = document.createElement('canvas'); oc.width = sw; oc.height = sh;
        var octx = oc.getContext('2d'); octx.drawImage(img, 0, 0, sw, sh);
        try { sd = octx.getImageData(0, 0, sw, sh).data; } catch (e) { toast('画像を読み込めませんでした'); return; }
        size(); loop();
      };
      img.onerror = function () { toast('VR画像を読み込めませんでした'); };
      if (isImg(u)) { img.crossOrigin = 'anonymous'; img.src = u; } else img.src = u;
      stage.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; vel = 0; stage.setPointerCapture(e.pointerId); var h = $('.v-hint', v); if (h) h.style.opacity = 0; });
      stage.addEventListener('pointermove', function (e) {
        if (!drag) return; var k = fov / stage.clientHeight;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
        yaw -= dx * k; vel = -dx * k; pitch = Math.max(-1.35, Math.min(1.35, pitch + dy * k));
      });
      var up = function () { drag = null; if (Math.abs(vel) > .0005) auto = false, $('[data-auto]', v).classList.remove('on'); };
      stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
      stage.addEventListener('wheel', function (e) { e.preventDefault(); fov = Math.max(.7, Math.min(2.0, fov + e.deltaY * .001)); }, { passive: false });
      $$('[data-z]', v).forEach(function (b) { b.addEventListener('click', function () { fov = Math.max(.7, Math.min(2.0, fov - (+b.dataset.z) * .25)); }); });
      $('[data-auto]', v).addEventListener('click', function (e) { auto = !auto; vel = 0; e.currentTarget.classList.toggle('on', auto); });
      var onRes = function () { if (sd) size(); }; window.addEventListener('resize', onRes);
      v._cleanup = function () { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onRes); };
    }

    if (qs.get('open') === '1' || pushId) { setTimeout(openModal, 400); }
    if (pushId || qs.get('open')) { try { history.replaceState(null, '', location.pathname); } catch (e) {} }
  }

  /* =================================================================
     REGISTER
  ================================================================= */
  function initRegister() {
    var data = {};
    var steps = $$('#stepsBar .s');
    function show(n) {
      ['s1', 's2', 's3'].forEach(function (id, i) { document.getElementById(id).hidden = i !== n; });
      steps.forEach(function (s, i) { s.classList.toggle('on', i === n); s.classList.toggle('done', i < n); });
      window.scrollTo(0, 0);
    }
    var token0 = qs.get('tag');
    var form = $('#form');
    function validate() {
      var n = $('#name').value.trim(), m = $('#email').value.trim(), ok = true;
      $('#f-name').classList.toggle('bad', !n); if (!n) ok = false;
      var okm = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m); $('#f-email').classList.toggle('bad', !okm); if (!okm) ok = false;
      data = { name: n, email: m }; return ok;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      $('#c-name').textContent = data.name; $('#c-email').textContent = data.email; show(1);
    });
    $('#back').addEventListener('click', function () { show(0); });
    $('#submit').addEventListener('click', function () {
      var b = $('#submit'); b.disabled = true; b.textContent = '送信中…'; $('#errBox2').classList.remove('on');
      var body = { name: data.name, email: data.email }; if (token0) body.tags = token0.split(',');
      api('/register', { method: 'POST', body: body }).then(function (r) {
        lsSet(TOKEN_KEY, r.token);
        $('#d-name').textContent = (r.customer && r.customer.name) || data.name;
        show(2);
        var bar = $('#bar'); requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = '100%'; }); });
        var n = 3, cd = $('#cd'), t = setInterval(function () { n--; cd.textContent = Math.max(n, 0); if (n <= 0) { clearInterval(t); location.href = gUrl('/install.html'); } }, 1000);
      }).catch(function (e) {
        b.disabled = false; b.textContent = '登録する';
        var box = $('#errBox2'); box.textContent = '登録に失敗しました。通信状況をご確認のうえ、もう一度お試しください。'; box.classList.add('on');
      });
    });
  }

  /* =================================================================
     INSTALL
  ================================================================= */
  function initInstall() {
    var deferred = null, env = platform;
    var isSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
    var shareIco = '<span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#0b3d91" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg></span>';
    var addIco = '<span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#0b3d91" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg></span>';
    var STEPS = {
      ios: [
        ['画面下の共有ボタンをタップ', 'Safariの下にある ' + shareIco + ' 共有ボタン（四角から矢印が出ているマーク）をタップします。'],
        ['「ホーム画面に追加」を選択', 'メニューを上にスクロールして、' + addIco + ' 「ホーム画面に追加」をタップします。'],
        ['右上の「追加」をタップ', 'アイコンと名前を確認して、画面右上の「追加」を押します。'],
        ['完成！アイコンから起動', 'ホーム画面に「限定くん」アイコンができました。そこから起動すると限定情報をご覧いただけます。']
      ],
      android: [
        ['下のボタンをタップ', '「ワンタップでホーム画面に追加」を押します。出ない場合は、ブラウザ右上のメニュー（︙）を開きます。'],
        ['「インストール」を選択', '確認画面が出たら「インストール」（または「ホーム画面に追加」）をタップします。'],
        ['ホーム画面にアイコンが追加', '数秒でホーム画面にアイコンが追加されます。'],
        ['完成！アイコンから起動', 'アイコンから起動すると、限定情報をご覧いただけます。']
      ],
      pc: [
        ['アドレスバー右のアイコンをクリック', 'Chrome / Edge のアドレスバー右端にあるインストールアイコン（モニターに下矢印）をクリックします。'],
        ['「インストール」をクリック', '表示されたポップアップで「インストール」を押します。'],
        ['アプリが起動', '専用ウィンドウでアプリが開きます。デスクトップやDockにも追加されます。'],
        ['完成！いつでも限定情報へ', '次回からはアイコンをクリックするだけで限定情報をご覧いただけます。']
      ]
    };
    var LABEL = { ios: 'iPhone / iPad', android: 'Android', pc: 'パソコン' };
    function draw() {
      $('#envLabel').textContent = LABEL[platform] + (platform === 'ios' ? (isSafari ? '（Safari）' : '') : '');
      $$('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.env === env); });
      $('#steps').innerHTML = STEPS[env].map(function (s, i) { return '<div class="step-card"><div class="step-no">0' + (i + 1) + '</div><div><h3>' + s[0] + '</h3><p>' + s[1] + '</p></div></div>'; }).join('');
      var al = $('#envAlert'); al.classList.remove('on');
      if (env === 'ios' && isIOS && !isSafari) { al.innerHTML = '<b>Safariで開いてください。</b>iPhoneではSafari以外のブラウザからホーム画面に追加できない場合があります。このページのURLをSafariで開き直してください。'; al.classList.add('on'); }
      else if (env === 'ios' && !isIOS) { al.textContent = 'この手順はiPhone / iPad用です。お手持ちのiPhoneのSafariでこのページを開いてください。'; al.classList.add('on'); }
      $('#installBtn').hidden = !(deferred && env !== 'ios');
    }
    $$('#tabs button').forEach(function (b) { b.addEventListener('click', function () { env = b.dataset.env; draw(); }); });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; draw(); });
    $('#installBtn').addEventListener('click', function () {
      if (!deferred) return; deferred.prompt();
      deferred.userChoice.then(function (c) { if (c.outcome === 'accepted') { logEvent('install', platform); toast('ホーム画面に追加しました'); } deferred = null; draw(); });
    });
    window.addEventListener('appinstalled', function () { lsSet('aplika.installLogged', '1'); logEvent('install', platform); });
    if (isApp) { $('#doneCard').hidden = false; $('#steps').hidden = true; $('#tabs').hidden = true; }
    draw();
    if (token()) api('/me').then(function (r) { $('#who').textContent = r.customer.name + '様、'; }).catch(function () {});
  }

  function boot() {
    if (page === 'home') initHome();
    else if (page === 'register') initRegister();
    else if (page === 'install') initInstall();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
