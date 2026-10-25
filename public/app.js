/* プライムサイト customer PWA — shared script (home / register / install) */
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

  /* ---------- in-app browsers (LINE, Instagram...) cannot add to the home screen ---------- */
  function detectInApp() {
    var m = ua.match(/Line\/|Instagram|FBAN|FBAV|FB_IAB|Twitter|MicroMessenger|KAKAOTALK|Snapchat|musical_ly|BytedanceWebview|NAVER\(|Pinterest|GSA\//);
    if (!m) return '';
    var map = { 'Line/': 'LINE', Instagram: 'Instagram', FBAN: 'Facebook', FBAV: 'Facebook', FB_IAB: 'Facebook', Twitter: 'X(Twitter)', MicroMessenger: 'WeChat', KAKAOTALK: 'KakaoTalk', Snapchat: 'Snapchat', musical_ly: 'TikTok', BytedanceWebview: 'TikTok', 'NAVER(': 'NAVER', Pinterest: 'Pinterest', 'GSA/': 'Googleアプリ' };
    return map[m[0]] || 'アプリ内ブラウザ';
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) { try { var a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); res(); } catch (e) { rej(e); } });
  }
  // strong = install page (cannot continue), otherwise a gentle hint on the register page
  function showInAppBanner(strong) {
    var name = detectInApp(); var wrap = $('.wrap'); if (!name || !wrap || $('.inapp')) return;
    var how = isIOS ? '画面の右下または右上の「…」・共有マークから<b style="display:inline;font-size:inherit;color:inherit">「Safariで開く」</b>を選んでください。' : 'メニュー（︙）から<b style="display:inline;font-size:inherit;color:inherit">「ブラウザで開く」「Chromeで開く」</b>を選んでください。';
    var el = document.createElement('div'); el.className = 'inapp'; el.setAttribute('role', 'alert');
    el.innerHTML = '<b>' + (strong ? 'このブラウザでは、ホーム画面に追加できません' : 'ご登録のあと、ホーム画面への追加はできません') + '</b>'
      + '<p>いま、' + esc(name) + 'の中で開いています。' + (strong ? '' : 'このまま登録もできますが、') + 'ホーム画面に追加するには、' + (isIOS ? 'Safari' : 'Chrome') + 'で開き直す必要があります。<br>' + how + '<br>うまくいかないときは、下のボタンでURLをコピーして、' + (isIOS ? 'Safari' : 'Chrome') + 'に貼り付けてください。</p>'
      + '<button type="button">このページのURLをコピー</button>';
    el.querySelector('button').addEventListener('click', function () {
      var b = this; copyText(location.href).then(function () { b.textContent = 'コピーしました。' + (isIOS ? 'Safari' : 'Chrome') + 'に貼り付けてください'; }).catch(function () { b.textContent = 'コピーできませんでした。アドレスを長押ししてコピーしてください'; });
    });
    wrap.insertBefore(el, wrap.querySelector('.card') || wrap.firstChild);
  }

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
    document.title = document.title.replace(/｜エスコン プライムサイト$/, '') + '｜' + p.name;
  }
  propertyP.then(applyProperty);

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register(gUrl('/sw.js'), { scope: gUrl('/') }).catch(function () {}); });
  }

  var page = document.body.dataset.page;

  /* =================================================================
     引き継ぎコード (claim code): lets the home-screen app (separate storage on iPhone) take over a registration
  ================================================================= */
  var CLAIM_KEY = 'aplika.claimCode';
  function normCode(v) { return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }
  function fmtCode(v) { v = normCode(v); return v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v; }
  function copyCode(text) {
    return new Promise(function (res, rej) {
      try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(res, rej); } catch (e) {}
      try {
        var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, 99); var ok = document.execCommand('copy'); ta.remove();
        return ok ? res() : rej(new Error('copy'));
      } catch (e) { rej(e); }
    });
  }
  function claimCardEl(code) {
    var el = document.createElement('div'); el.className = 'claim-card'; el.id = 'claimCard';
    el.innerHTML = '<div class="claim-h">引き継ぎコード</div><div class="claim-code">' + esc(fmtCode(code)) + '</div>'
      + '<button type="button" class="btn btn-blue btn-sm claim-copy">コードをコピー</button>'
      + '<p>ホーム画面のアプリを初めて開いたときに、このコードを入力すると、登録が引き継がれます。メモやスクリーンショットで控えておくと安心です。</p>';
    $('.claim-copy', el).addEventListener('click', function () { copyCode(fmtCode(code)).then(function () { toast('コードをコピーしました'); }).catch(function () { toast('コピーできませんでした。コードを長押ししてコピーしてください'); }); });
    return el;
  }
  /* places the card in `host` (an existing element), replacing a previous one */
  function showClaimCard(host, code) {
    code = normCode(code); if (!host || code.length !== 8) return;
    var old = $('#claimCard'); if (old) old.remove();
    host.appendChild(claimCardEl(code));
  }
  function claimSheet() { /* standalone app without a registration in this storage: enter the code (or register) */
    var sh = $('#claimSheet'); if (sh) { sh.hidden = false; return; }
    sh = document.createElement('div'); sh.id = 'claimSheet'; sh.className = 'claim-sheet';
    sh.innerHTML = '<div class="cs-box" role="dialog" aria-modal="true"><div class="cs-t">ご登録の引き継ぎ</div>'
      + '<p class="cs-d">Safariでご登録のときに表示された「引き継ぎコード」を入力してください。</p>'
      + '<input type="text" id="csCode" inputmode="text" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="9" placeholder="XXXX-XXXX" aria-label="引き継ぎコード">'
      + '<div class="cs-err" id="csErr" role="alert"></div>'
      + '<button type="button" class="btn btn-red btn-block" id="csGo">引き継ぐ</button>'
      + '<a class="cs-link" href="' + esc(gUrl('/register.html')) + '">コードがない・初めての方は会員登録</a>'
      + '<button type="button" class="cs-later" id="csLater">あとで</button></div>';
    document.body.appendChild(sh);
    var inp = $('#csCode', sh), err = $('#csErr', sh), go = $('#csGo', sh);
    inp.addEventListener('input', function () { inp.value = fmtCode(inp.value); err.textContent = ''; });
    function submit() {
      var code = normCode(inp.value);
      if (code.length !== 8) { err.textContent = '8文字のコードをご入力ください。'; return; }
      go.disabled = true; go.textContent = '確認中…'; err.textContent = '';
      api('/claim', { method: 'POST', body: { code: code } }).then(function (r) {
        lsSet(TOKEN_KEY, r.token); lsSet(CLAIM_KEY, normCode(r.claimCode) || code);
        go.textContent = '引き継ぎました'; location.reload();
      }).catch(function (e) {
        go.disabled = false; go.textContent = '引き継ぐ';
        err.textContent = e.status === 404 ? 'コードが見つかりません。もう一度ご確認ください。' : e.status === 409 ? 'この端末はすでに登録済みです。' : '通信に失敗しました。電波の良い場所でもう一度お試しください。';
      });
    }
    go.addEventListener('click', submit);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    $('#csLater', sh).addEventListener('click', function () { sh.hidden = true; });
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 300);
  }

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
      var fab0 = $('#fab'); fab0.classList.add('on'); fab0.firstChild.textContent = '引き継ぎコードを入力 ';
      fab0.addEventListener('click', claimSheet);
      claimSheet();
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
    }).catch(function (e) { if (e.status === 401) { toast('ログイン情報が無効です。引き継ぎコードを入力するか、再度ご登録ください。'); claimSheet(); } });

    // first launch: ask for notifications right away (browsers require the user's own tap, so this is a one-tap sheet)
    loadP.then(function () {
      if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return;
      var force = qs.get('np') === '1'; // ?np=1 shows the sheet again (for checking the screen)
      if (Notification.permission === 'granted') { ensurePushSaved(); if (!force) return; }
      else if (Notification.permission !== 'default' && !force) return;
      var later = parseInt(lsGet('aplika.notifLater') || '0', 10);
      if (!force && later && Date.now() - later < 7 * 86400000) return;
      var sh = document.createElement('div');
      sh.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center';
      sh.innerHTML = '<div style="background:#fff;color:#222;width:100%;max-width:520px;border-radius:18px 18px 0 0;padding:26px 22px calc(26px + env(safe-area-inset-bottom));text-align:center;font-family:inherit">'
        + '<div style="display:inline-block;margin-bottom:10px;padding:4px 12px;border-radius:999px;background:#fdecec;color:#c00000;font-size:12px;font-weight:700">最後のステップ　3 / 3</div>'
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
          return reg.showNotification('プライムサイト テスト通知', { body: 'この端末の通知表示は正常です', icon: gUrl('/icons/icon-192.png'), tag: 'gentei-test-' + Date.now() });
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
        if (r.claimCode) { lsSet(CLAIM_KEY, normCode(r.claimCode)); var cnt = $('#cd'); showClaimCard($('#s3'), r.claimCode); var cc = $('#claimCard'); if (cc && cnt && cnt.parentNode) cnt.parentNode.parentNode.insertBefore(cc, cnt.parentNode); }
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
    /* ---- step illustrations: simplified screens with the thing to tap circled in red ---- */
    var ICON = gUrl('/icons/icon-192.png');
    function art(inner) { return '<svg class="step-art" viewBox="0 0 320 150" role="img" aria-hidden="true">' + inner + '</svg>'; }
    function hl(x, y, w, h, r) { return '<rect class="hl" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (r || 10) + '" fill="rgba(192,0,0,.08)" stroke="#c00000" stroke-width="3"/>'; }
    function tx(x, y, t, o) { o = o || {}; return '<text x="' + x + '" y="' + y + '" font-size="' + (o.s || 12) + '" fill="' + (o.c || '#333') + '" text-anchor="' + (o.a || 'start') + '" font-weight="' + (o.w || 400) + '" font-family="-apple-system,Hiragino Sans,sans-serif">' + t + '</text>'; }
    function shareSvg(x, y, c) { return '<g transform="translate(' + x + ',' + y + ')" fill="none" stroke="' + (c || '#0b3d91') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M0-9v14M-5-5l5-5 5 5M-8 0h-2v12h20V0h-2"/></g>'; }
    function homeGrid(label) {
      var cols = ['#9db4d9', '#c9a4a4', '#a9c8b0', '#d6c58f', '#b3a8d1', '#8fb8c4'], o = '<rect x="0" y="0" width="320" height="150" fill="#cfd9ea"/>';
      for (var i = 0; i < 4; i++) { o += '<rect x="' + (30 + i * 68) + '" y="16" width="46" height="46" rx="11" fill="' + cols[i] + '"/>'; }
      for (var j = 0; j < 2; j++) { o += '<rect x="' + (30 + j * 68) + '" y="84" width="46" height="46" rx="11" fill="' + cols[4 + j] + '"/>'; }
      o += '<image href="' + ICON + '" x="166" y="84" width="46" height="46"/>' + hl(160, 78, 58, 74, 14) + tx(189, 146, label, { s: 10, a: 'middle', w: 700, c: '#c00000' });
      return art(o);
    }
    var ART = {
      ios1: art('<rect width="320" height="150" fill="#eef1f8"/>' + tx(160, 40, 'いま開いているページ', { a: 'middle', c: '#8a94ab' }) + '<rect x="0" y="92" width="320" height="58" fill="#fff"/><path d="M0 92h320" stroke="#d6dbe8"/>' + tx(40, 128, '‹', { s: 26, a: 'middle', c: '#9aa3b8' }) + tx(100, 128, '›', { s: 26, a: 'middle', c: '#9aa3b8' }) + shareSvg(160, 120) + '<rect x="210" y="112" width="18" height="18" rx="3" fill="none" stroke="#9aa3b8" stroke-width="2"/><rect x="262" y="112" width="18" height="18" rx="3" fill="none" stroke="#9aa3b8" stroke-width="2"/>' + hl(138, 98, 44, 46, 12) + tx(160, 82, '↓ 画面の一番下', { a: 'middle', w: 700, c: '#c00000' })),
      ios2: art('<rect width="320" height="150" fill="#cfd5e3"/><rect x="30" y="14" width="260" height="150" rx="16" fill="#f7f8fb"/>' + tx(46, 38, 'コピー', { s: 13 }) + '<path d="M46 48h228" stroke="#e1e5ef"/>' + tx(46, 72, 'ブックマークを追加', { s: 13, c: '#999' }) + '<path d="M46 82h228" stroke="#e1e5ef"/>' + '<rect x="44" y="92" width="232" height="32" rx="8" fill="#fff"/>' + tx(58, 113, 'ホーム画面に追加', { s: 14, w: 700 }) + '<g transform="translate(252,108)" fill="none" stroke="#0b3d91" stroke-width="2" stroke-linecap="round"><rect x="-9" y="-9" width="18" height="18" rx="4"/><path d="M0-4v8M-4 0h8"/></g>' + hl(40, 89, 240, 38, 10) + tx(160, 144, '↑ 上にスクロールして探します', { s: 10, a: 'middle', c: '#c00000', w: 700 })),
      ios3: art('<rect width="320" height="150" fill="#cfd5e3"/><rect x="20" y="10" width="280" height="150" rx="16" fill="#f7f8fb"/>' + tx(40, 36, 'キャンセル', { s: 12, c: '#0b3d91' }) + tx(160, 36, 'ホーム画面に追加', { s: 12, a: 'middle', w: 700 }) + tx(270, 36, '追加', { s: 14, a: 'middle', w: 700, c: '#0b3d91' }) + hl(244, 18, 54, 26, 8) + '<path d="M20 50h280" stroke="#e1e5ef"/><image href="' + ICON + '" x="40" y="62" width="50" height="50"/><rect x="104" y="66" width="170" height="40" rx="8" fill="#fff" stroke="#e1e5ef"/>' + tx(118, 92, 'プライムサイト', { s: 14, w: 700 }) + tx(160, 134, '名前はそのままでOK', { s: 10, a: 'middle', c: '#8a94ab' })),
      ios4: homeGrid('プライムサイト'),
      and1: art('<rect width="320" height="150" fill="#eef1f8"/><rect x="0" y="0" width="320" height="44" fill="#fff"/><rect x="14" y="8" width="230" height="28" rx="14" fill="#eef1f8"/>' + tx(30, 27, 'fuupapayang.github.io', { s: 11, c: '#555' }) + '<g fill="#555"><circle cx="290" cy="14" r="3"/><circle cx="290" cy="22" r="3"/><circle cx="290" cy="30" r="3"/></g>' + hl(270, 4, 40, 36, 18) + tx(160, 100, 'ここ（画面の右上）をタップ', { a: 'middle', w: 700, c: '#c00000', s: 13 }) + tx(160, 124, '「ワンタップで追加」が出ていれば、それを押すだけでOK', { a: 'middle', s: 10, c: '#8a94ab' })),
      and2: art('<rect width="320" height="150" fill="#cfd5e3"/><rect x="110" y="6" width="200" height="140" rx="12" fill="#fff"/>' + tx(124, 30, '新しいタブ', { s: 12 }) + tx(124, 56, '履歴', { s: 12, c: '#999' }) + '<rect x="116" y="68" width="188" height="30" rx="6" fill="#fff"/>' + tx(124, 88, 'アプリをインストール', { s: 13, w: 700 }) + hl(114, 66, 192, 34, 8) + tx(124, 122, '※「ホーム画面に追加」と表示される場合もあります', { s: 8, c: '#8a94ab' })),
      and3: art('<rect width="320" height="150" fill="#cfd5e3"/><rect x="40" y="20" width="240" height="116" rx="16" fill="#fff"/><image href="' + ICON + '" x="58" y="36" width="40" height="40"/>' + tx(108, 54, 'アプリをインストール', { s: 13, w: 700 }) + tx(108, 72, 'プライムサイト', { s: 11, c: '#777' }) + tx(180, 118, 'キャンセル', { s: 12, a: 'middle', c: '#777' }) + '<rect x="212" y="98" width="62" height="28" rx="14" fill="#0b3d91"/>' + tx(243, 117, 'インストール', { s: 11, a: 'middle', c: '#fff', w: 700 }) + hl(206, 92, 74, 40, 20)),
      pc1: art('<rect width="320" height="150" fill="#eef1f8"/><rect x="0" y="0" width="320" height="44" fill="#dde3f0"/><rect x="40" y="8" width="210" height="28" rx="14" fill="#fff"/>' + tx(58, 27, 'fuupapayang.github.io', { s: 11, c: '#555' }) + '<g transform="translate(230,22)" fill="none" stroke="#0b3d91" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="-8" y="-7" width="16" height="11" rx="2"/><path d="M0-3v5M-3 0l3 3 3-3M-4 7h8"/></g>' + hl(210, 6, 40, 32, 16) + tx(160, 100, 'アドレスバーの右端のアイコン', { a: 'middle', w: 700, c: '#c00000', s: 13 }) + tx(160, 124, 'Chrome / Edge で表示されます', { a: 'middle', s: 10, c: '#8a94ab' })),
      pc2: art('<rect width="320" height="150" fill="#cfd5e3"/><rect x="60" y="14" width="200" height="122" rx="12" fill="#fff"/><image href="' + ICON + '" x="76" y="28" width="38" height="38"/>' + tx(124, 46, 'プライムサイトをインストール', { s: 12, w: 700 }) + tx(124, 62, 'fuupapayang.github.io', { s: 9, c: '#777' }) + tx(150, 118, 'キャンセル', { s: 11, a: 'middle', c: '#777' }) + '<rect x="188" y="98" width="62" height="28" rx="6" fill="#0b3d91"/>' + tx(219, 117, 'インストール', { s: 11, a: 'middle', c: '#fff', w: 700 }) + hl(182, 92, 74, 40, 10))
    };
    var STEPS = {
      ios: [
        ['画面の一番下の「共有」ボタンをタップ', '<b>Safari</b>で、画面下の真ん中にある ' + shareIco + '（四角から矢印が出ているマーク）を押します。', ART.ios1],
        ['「ホーム画面に追加」をタップ', 'メニューを<b>上にスクロール</b>して、' + addIco + ' 「ホーム画面に追加」を探して押します。', ART.ios2],
        ['右上の「追加」をタップ', '名前は「プライムサイト」のままで、画面の<b>右上の「追加」</b>を押します。', ART.ios3],
        ['完成！ホーム画面のアイコンから開く', 'ホーム画面にできた「プライムサイト」のアイコンを押すと、限定情報をご覧いただけます。<b>次回からは、このページを開く必要はありません。</b>', ART.ios4]
      ],
      android: [
        ['右上の「︙」をタップ', '画面右上の<b>「︙」</b>を押します。（「ワンタップでホーム画面に追加」のボタンが出ている場合は、それを押すだけです）', ART.and1],
        ['「アプリをインストール」をタップ', 'メニューの中の<b>「アプリをインストール」</b>（または「ホーム画面に追加」）を押します。', ART.and2],
        ['「インストール」をタップ', '確認の画面で、<b>「インストール」</b>を押します。数秒で、ホーム画面にアイコンが追加されます。', ART.and3],
        ['完成！ホーム画面のアイコンから開く', 'ホーム画面にできた「プライムサイト」のアイコンを押すと、限定情報をご覧いただけます。', ART.ios4]
      ],
      pc: [
        ['アドレスバー右端のアイコンをクリック', 'Chrome / Edge の<b>アドレスバーの右端</b>にあるインストールのアイコン（モニターに下矢印）を押します。', ART.pc1],
        ['「インストール」をクリック', '表示された小さな画面で<b>「インストール」</b>を押します。', ART.pc2],
        ['アプリが起動します', '専用のウィンドウでアプリが開きます。デスクトップや Dock にもアイコンが追加されます。'],
        ['完成！いつでも限定情報へ', '次回からは、アイコンを押すだけで限定情報をご覧いただけます。']
      ]
    };
    var LABEL = { ios: 'iPhone / iPad', android: 'Android', pc: 'パソコン' };
    function draw() {
      $('#envLabel').textContent = LABEL[platform] + (platform === 'ios' ? (isSafari ? '（Safari）' : '') : '');
      $$('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.env === env); });
      var SUM = { ios: ['共有ボタン', 'ホーム画面に追加', '追加'], android: ['右上の︙', 'アプリをインストール', 'インストール'], pc: ['アドレスバーのアイコン', 'インストール', '完成'] }[env];
      $('#sumLine').innerHTML = '<span class="sum-h">この3回タップするだけ</span>' + SUM.map(function (t, i) { return '<span class="sum-i"><b>' + (i + 1) + '</b>' + t + '</span>'; }).join('<span class="sum-a">›</span>');
      $('#steps').innerHTML = STEPS[env].map(function (s, i) { return '<div class="step-card"><div class="step-no">0' + (i + 1) + '</div><div class="step-body"><h3>' + s[0] + '</h3><p>' + s[1] + '</p>' + (s[2] || '') + '</div></div>'; }).join('');
      var al = $('#envAlert'); al.classList.remove('on');
      var inApp = /Line\/|FBAN|FBAV|Instagram|MicroMessenger|Twitter|KAKAOTALK|NAVER\(inapp|; wv\)/.test(ua);
      if (inApp) { al.innerHTML = '<b>いま、アプリ内のブラウザで開いています。</b>この画面では、ホーム画面に追加できません。右上や右下の「…」から<b>「' + (isIOS ? 'Safariで開く' : '他のブラウザで開く') + '」</b>を選んで、開き直してください。<br><button type="button" class="btn btn-sm" id="copyUrl" style="margin-top:8px">このページのURLをコピー</button>'; al.classList.add('on'); var cu = $('#copyUrl'); if (cu) cu.addEventListener('click', function () { try { navigator.clipboard.writeText(location.href).then(function () { toast('URLをコピーしました'); }); } catch (e) { toast('コピーできませんでした'); } }); }
      else if (env === 'ios' && isIOS && !isSafari) { al.innerHTML = '<b>Safariで開いてください。</b>iPhoneではSafari以外のブラウザからホーム画面に追加できない場合があります。このページのURLをSafariで開き直してください。'; al.classList.add('on'); }
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
    /* 引き継ぎコード card: right below the headline; customers registered before codes existed get one minted on demand */
    (function () {
      var anchor = $('#tabs'); if (!anchor || !token() || isApp) return;
      var put = function (c) { c = normCode(c); if (c.length !== 8) return; var tmp = document.createElement('div'); showClaimCard(tmp, c); var el = tmp.firstChild; if (el && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor); };
      var have = normCode(lsGet(CLAIM_KEY));
      if (have.length === 8) put(have);
      else api('/claim-code', { method: 'POST', body: {} }).then(function (r) { if (r && r.claimCode) { lsSet(CLAIM_KEY, normCode(r.claimCode)); put(r.claimCode); } }).catch(function () {});
    })();
  }

  function boot() {
    if (page === 'home') initHome();
    else if (page === 'register') { showInAppBanner(false); initRegister(); }
    else if (page === 'install') { showInAppBanner(true); initInstall(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
