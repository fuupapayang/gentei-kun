/* tool.js - コア: ユーティリティ / 設定 / パネル / ビューア共通 */
(function () {
  const T = (window.T = window.T || {});
  T.mods = {};
  const SVGNS = 'http://www.w3.org/2000/svg';

  T.h = function h(tag, attrs, ...kids) {
    const svg = tag.startsWith('svg:');
    const el = svg ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.append(c.nodeType ? c : document.createTextNode(c));
    };
    kids.forEach(add);
    return el;
  };
  const h = T.h;
  T.$ = (s, r) => (r || document).querySelector(s);
  T.$$ = (s, r) => [...(r || document).querySelectorAll(s)];
  T.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  T.fmt = {
    n: (v) => Math.round(v).toLocaleString('ja-JP'),
    yen: (v) => Math.round(v).toLocaleString('ja-JP') + '円',
    man: (v) => (Math.round(v / 1000) / 10).toLocaleString('ja-JP') + '万円',
  };

  /* ---- storage (try/catch) ---- */
  const KEY = 'genteikun.tool.';
  T.store = {
    get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };
  const DEF = { hp: gUrl('/'), ppt: '', brochure: '', qbook: '', docs: '', maker: '', video: '', docsList: '', makerList: '', staff: '' };
  T.settings = {
    all() { return Object.assign({}, DEF, T.store.get('settings', {})); },
    get(k) { return this.all()[k]; },
    save(o) { T.store.set('settings', Object.assign(this.all(), o)); },
  };
  T.prop = { name: 'グランレ・ジェイド葉山', tagline: 'RESIDENCE & GALLERY' };

  T.toast = function (msg) {
    const t = T.$('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(T.toast._t); T.toast._t = setTimeout(() => t.classList.remove('on'), 2200);
  };

  /* ---- Esc / back stack ---- */
  T.esc = [];
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && T.esc.length) { e.preventDefault(); T.esc[T.esc.length - 1](); }
  });

  /* ---- icons ---- */
  const IC = {
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
    hp: '<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.6" ry="8.5"/><path d="M3.5 12h17M5 7.5h14M5 16.5h14"/>',
    vr: '<rect x="2.5" y="7" width="19" height="10" rx="3.5"/><path d="M9.5 17c.8-2 4.2-2 5 0M7 12h.01M17 12h.01"/>',
    present: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M10.5 8.2v3.6l3.2-1.8z"/>',
    book: '<path d="M12 6c-2-1.6-5-2-8-1.5v13c3-.5 6-.1 8 1.5 2-1.6 5-2 8-1.5v-13c-3-.5-6-.1-8 1.5zM12 6v13"/>',
    quality: '<circle cx="12" cy="9" r="5.5"/><path d="M9.2 13.6 7.5 21l4.5-2.4 4.5 2.4-1.7-7.4M10 9l1.5 1.5L14.3 7.6"/>',
    plan: '<rect x="3.5" y="4" width="17" height="16" rx="1"/><path d="M3.5 11h8M11.5 4v9M11.5 16v4M16 11h4.5M16 11v9"/>',
    gallery: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m3.5 17 5-4.5 3.5 3 3-2.5 5.5 4.5"/>',
    view: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.2"/>',
    hazard: '<path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    docs: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2.5h7.5A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>',
    video: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="m10 9.2 5 2.8-5 2.8z"/>',
    loan: '<circle cx="12" cy="12" r="9"/><path d="m8.5 7.5 3.5 5 3.5-5M8.5 12.5h7M8.5 15.5h7M12 12.5v5.5"/>',
    maker: '<path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9zM12 12l8.5-4.5M12 12 3.5 7.5M12 12v9"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    furn: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v1.5h10V13a2 2 0 0 1 4 0v5H3zM6 18v2M18 18v2"/>',
    color: '<path d="M12 3.5c-5 0-8.5 3.4-8.5 8 0 4 3 6.5 5.5 6.5 1.6 0 2-1 1.6-2.2-.4-1.2.3-2.3 1.7-2.3H17c2.2 0 3.5-1.2 3.5-3.2C20.5 6.7 17 3.5 12 3.5z"/><path d="M7.8 11h.01M11 7.8h.01M15.2 8.8h.01"/>',
    ai: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    map: '<path d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 19 9.8C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.6"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  };
  T.icon = (n, cls) => `<svg viewBox="0 0 24 24" class="${cls || ''}">${IC[n] || ''}</svg>`;
  T.iconNames = Object.keys(IC);
  document.addEventListener('DOMContentLoaded', () => {
    const d = T.$('#icons');
    d.innerHTML = Object.keys(IC).map((k) => `<symbol id="i-${k}" viewBox="0 0 24 24">${IC[k]}</symbol>`).join('');
  });

  /* ---- panel ---- */
  T.panels = [];
  T.panel = function (title, opts) {
    opts = opts || {};
    const tabsEl = h('div', { class: 'p-tabs' });
    const body = h('div', { class: 'p-body' });
    const titleEl = h('h2', {}, title);
    const closeBtn = h('button', { class: 'x', 'aria-label': '閉じる', onclick: () => p.close() }, '×');
    const root = h('section', { class: 'panel', role: 'dialog', 'aria-label': title }, h('div', { class: 'p-head' }, titleEl, tabsEl, closeBtn), body);
    document.body.append(root);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('on')));
    const p = {
      root, body, tabsEl, titleEl, cleanups: [], closed: false,
      onClose(fn) { p.cleanups.push(fn); },
      close() {
        if (p.closed) return; p.closed = true;
        p.cleanups.forEach((f) => { try { f(); } catch (e) {} });
        const i = T.esc.indexOf(p.close); if (i >= 0) T.esc.splice(i, 1);
        T.panels = T.panels.filter((x) => x !== p);
        root.classList.remove('on'); setTimeout(() => root.remove(), 350);
      },
      tabs(list, initial) {
        tabsEl.innerHTML = '';
        const btns = {};
        const show = (id) => {
          Object.keys(btns).forEach((k) => btns[k].classList.toggle('on', k === id));
          p.cleanups.filter((f) => f._tab).forEach((f) => { try { f(); } catch (e) {} });
          p.cleanups = p.cleanups.filter((f) => !f._tab);
          body.innerHTML = '';
          const t = list.find((x) => x.id === id);
          const wrap = h('div', { style: { position: 'absolute', inset: 0 } });
          body.append(wrap);
          p.tabCleanup = (fn) => { fn._tab = true; p.cleanups.push(fn); };
          t.render(wrap, p);
          p.cur = id;
        };
        list.forEach((t) => { btns[t.id] = h('button', { type: 'button', onclick: () => show(t.id) }, t.label); tabsEl.append(btns[t.id]); });
        show(initial || list[0].id);
        return show;
      },
    };
    T.esc.push(p.close);
    T.panels.push(p);
    return p;
  };
  T.open = function (id, arg) {
    const m = T.mods[id];
    if (!m) return T.toast('準備中です');
    const p = T.panel(m.title);
    m.mount(p, arg);
    return p;
  };

  /* ---- ライトボックス ---- */
  T.lightbox = function (items, i) {
    let idx = i || 0;
    const img = h('div', { class: 'img' }), cap = h('div', { class: 'cap' });
    const go = (d) => { idx = (idx + d + items.length) % items.length; draw(); };
    const draw = () => { img.innerHTML = items[idx].svg(); cap.textContent = `${items[idx].title}  (${idx + 1}/${items.length})`; };
    const root = h('div', { class: 'lb' }, img, cap,
      h('button', { class: 'nav p', onclick: () => go(-1), 'aria-label': '前へ' }, '‹'),
      h('button', { class: 'nav n', onclick: () => go(1), 'aria-label': '次へ' }, '›'),
      h('button', { class: 'x', onclick: close, 'aria-label': '閉じる' }, '×'));
    function key(e) { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); }
    function close() { document.removeEventListener('keydown', key); const k = T.esc.indexOf(close); if (k >= 0) T.esc.splice(k, 1); root.classList.remove('on'); setTimeout(() => root.remove(), 300); }
    let sx = null;
    root.addEventListener('pointerdown', (e) => (sx = e.clientX));
    root.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 60) go(e.clientX < sx ? 1 : -1); sx = null; });
    document.addEventListener('keydown', key); T.esc.push(close);
    draw(); document.body.append(root); requestAnimationFrame(() => root.classList.add('on'));
  };

  /* ---- リンクビューア (Box / PDF / URL 埋め込み + デモ) ---- */
  T.embedUrl = function (u) {
    u = (u || '').trim();
    let m;
    if ((m = u.match(/^https?:\/\/([\w.-]+\.)?box\.com\/s\/([\w-]+)/i))) return 'https://app.box.com/embed/s/' + m[2];
    if ((m = u.match(/youtu\.be\/([\w-]+)|youtube\.com\/watch\?v=([\w-]+)/i))) return 'https://www.youtube.com/embed/' + (m[1] || m[2]);
    if ((m = u.match(/vimeo\.com\/(\d+)/i))) return 'https://player.vimeo.com/video/' + m[1];
    if ((m = u.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/i))) return 'https://docs.google.com/presentation/d/' + m[1] + '/embed';
    if ((m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/i))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    return gUrl(u);
  };
  T.linkViewer = function (el, o) {
    // o: {key, url, label, demo(container)}
    const url = (o.url != null ? o.url : T.settings.get(o.key)) || '';
    const wrap = h('div', { class: 'lv' });
    const main = h('div', { class: 'lv-main' });
    let demo = !url;
    const bar = h('div', { class: 'lv-bar' });
    const draw = () => {
      main.innerHTML = '';
      if (demo) { o.demo(main); } else {
        const src = T.embedUrl(url);
        const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(src);
        main.append(isVideo ? h('video', { src, controls: true, style: { width: '100%', height: '100%', background: '#000' } }) : h('iframe', { src, allow: 'fullscreen; autoplay', allowfullscreen: true, referrerpolicy: 'no-referrer', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } }));
      }
      bar.innerHTML = '';
      bar.append(...[
        h('span', { class: 'badge ' + (url ? 'ok' : '') }, url ? 'リンク設定済' : '未設定'),
        h('span', { class: 'url' }, url ? url : `${o.label}のURL(Boxリンク / PDF など)は「設定」から登録できます。現在は標準コンテンツを表示中です。`),
        url ? h('button', { class: 'btn sm', onclick: () => { demo = !demo; draw(); } }, demo ? '登録リンクを表示' : 'デモ資料を表示') : null,
        url ? h('a', { class: 'btn sm', href: url, target: '_blank', rel: 'noopener' }, '新規タブで開く ↗') : null,
        h('button', { class: 'btn sm', onclick: () => T.open('settings') }, '設定')].filter(Boolean));
    };
    wrap.append(bar, main); el.append(wrap); draw();
  };

  /* ---- fullscreen ---- */
  T.toggleFull = function () {
    const d = document, e = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else if (e.requestFullscreen || e.webkitRequestFullscreen) (e.requestFullscreen || e.webkitRequestFullscreen).call(e).catch(() => T.toast('このブラウザは全画面に対応していません。ホーム画面に追加してお使いください'));
    else T.toast('iPadではホーム画面に追加すると全画面で起動できます');
  };
})();
