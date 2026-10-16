/* mod-viewers.js - ページめくりブック / スライドビューア / リンク系モジュール */
(function () {
  const T = window.T, h = T.h;

  function pageEl(kind, i, total) {
    const d = T.CONTENT[kind][i];
    if (!d) return h('div', { class: 'pg blank' });
    const el = h('div', { class: 'pg' + (d.cover ? ' cover' : '') });
    if (d.cover) {
      el.append(h('div', { class: 'im', html: d.img() }), h('div', { class: 't' }, h('i', {}, d.sub), h('b', {}, d.t)));
      return el;
    }
    if (d.img) el.append(h('div', { class: 'im', html: d.img() }));
    const tx = h('div', { class: 'tx' + (d.img ? '' : ' full') }, h('h3', {}, d.t), h('div', { class: 'goldline' }));
    (d.body || []).forEach((b) => tx.append(h('p', {}, b)));
    if (d.kv) tx.append(h('dl', { class: 'kv' }, d.kv.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])));
    el.append(tx, h('div', { class: 'no ' + (i % 2 ? 'l' : 'r') }, String(i + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0')));
    return el;
  }

  /* ---- ページめくりブック: 左ページ=i, 右ページ=i+1 (表紙は i=-1 の右ページ) ---- */
  T.book = function (host, kind) {
    const n = T.CONTENT[kind].length + (T.CONTENT[kind].length % 2);
    const root = h('div', { class: 'bk' });
    const book = h('div', { class: 'book' });
    const L = h('div', { class: 'half l' }), R = h('div', { class: 'half r' });
    book.append(L, R);
    const rng = h('input', { type: 'range', min: 0, max: n / 2, step: 1, value: 0, 'aria-label': 'ページ' });
    const lab = h('span');
    const prev = h('button', { class: 'btn sm', onclick: () => go(-1) }, '‹ 前へ'), next = h('button', { class: 'btn sm', onclick: () => go(1) }, '次へ ›');
    root.append(book, h('div', { class: 'bk-ctl' }, prev, rng, next, lab));
    host.append(root);
    let i = -1, busy = false, pw = 300, ph = 400;
    const page = (k) => (k >= 0 && k < n ? pageEl(kind, k, n) : h('div', { class: 'pg blank' }));
    const fill = (half, k) => { half.innerHTML = ''; half.append(page(k)); half.classList.toggle('empty', k < 0 || k >= n); };
    const sizeAll = () => {
      const aw = host.clientWidth - 40, ah = host.clientHeight - 90;
      ph = Math.max(200, Math.min(ah, (aw / 2) * (4 / 3))); pw = ph * 0.75;
      book.style.cssText = `width:${pw * 2}px;height:${ph}px`;
      L.style.cssText = `width:${pw}px;height:${ph}px`; R.style.cssText = `width:${pw}px;height:${ph}px;left:${pw}px`;
    };
    const sync = () => {
      fill(L, i); fill(R, i + 1);
      rng.value = Math.round((i + 1) / 2);
      lab.textContent = `${T.clamp(i + 2, 1, n)}${i + 3 <= n ? ' - ' + (i + 3) : ''} / ${n}`;
      prev.disabled = i <= -1; next.disabled = i >= n - 1;
    };
    function go(d) {
      if (busy) return;
      const ni = i + d * 2;
      if (ni < -1 || ni > n - 1) return;
      busy = true;
      const f = h('div', { class: 'flip' }, h('div', { class: 'face' }), h('div', { class: 'face back' }));
      f.style.width = pw + 'px'; f.style.height = ph + 'px';
      const front = f.children[0], back = f.children[1];
      if (d > 0) {
        f.style.left = pw + 'px'; f.style.transformOrigin = 'left center';
        front.append(page(i + 1)); back.append(page(i + 2));
        fill(R, i + 3);
      } else {
        f.style.left = '0px'; f.style.transformOrigin = 'right center';
        front.append(page(i)); back.append(page(i - 1));
        fill(L, i - 2);
      }
      book.append(f);
      f.getBoundingClientRect();
      f.style.transform = d > 0 ? 'rotateY(-180deg)' : 'rotateY(180deg)';
      setTimeout(() => { i = ni; f.remove(); sync(); busy = false; }, 880);
    }
    rng.addEventListener('input', () => { if (busy) return; i = T.clamp(rng.value * 2 - 1, -1, n - 1); sync(); });
    const kd = (e) => { if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return; if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', kd);
    let sx = null;
    book.addEventListener('pointerdown', (e) => (sx = e.clientX));
    book.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      if (Math.abs(e.clientX - sx) > 40) go(e.clientX < sx ? 1 : -1);
      else go(e.clientX - book.getBoundingClientRect().left > pw ? 1 : -1);
      sx = null;
    });
    const ro = new ResizeObserver(() => { sizeAll(); if (!busy) sync(); }); ro.observe(host);
    sizeAll(); sync();
    return () => { document.removeEventListener('keydown', kd); ro.disconnect(); };
  };

  /* ---- スライドショー ---- */
  T.slides = function (host, kind) {
    const list = T.CONTENT[kind], root = h('div', { class: 'bk' });
    const stage = h('div', { class: 'slide-stage' });
    const cnt = h('span');
    let cur = 0;
    const els = list.map((d) => {
      const s = h('div', { class: 'slide' });
      s.style.cssText = 'background:#101012;container-type:inline-size;font-family:"Hiragino Mincho ProN","Yu Mincho",serif';
      if (d.cover) {
        s.append(h('div', { style: { position: 'absolute', inset: 0 }, html: d.img() }),
          h('div', { style: { position: 'absolute', left: '6%', bottom: '12%', textShadow: '0 2px 20px #000' } },
            h('div', { style: { fontSize: '1.6cqw', letterSpacing: '.5em', color: '#ecd69a', fontFamily: 'sans-serif' } }, d.sub),
            h('div', { style: { fontSize: '5cqw', letterSpacing: '.14em', color: '#fff' } }, d.t)));
      } else {
        if (d.img) s.append(h('div', { style: { position: 'absolute', left: '50%', right: 0, top: 0, bottom: 0 }, html: d.img() }));
        const tx = h('div', { style: { position: 'absolute', left: '6%', top: '14%', width: d.img ? '40%' : '88%', color: '#ece6d8' } },
          h('div', { style: { fontSize: '3.4cqw', letterSpacing: '.12em', color: '#ecd69a' } }, d.t),
          h('div', { style: { width: '8cqw', height: '2px', background: '#c9a45c', margin: '1.6cqw 0 2.4cqw' } }));
        (d.body || []).forEach((b) => tx.append(h('div', { style: { fontSize: '1.9cqw', lineHeight: 1.9, marginBottom: '.6cqw', fontFamily: 'sans-serif' } }, b)));
        if (d.kv) tx.append(h('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.2cqw 3cqw', fontSize: '2cqw', fontFamily: 'sans-serif' } }, d.kv.map(([k, v]) => [h('span', { style: { color: '#c9a45c' } }, k), h('span', {}, v)])));
        s.append(tx);
      }
      stage.append(s); return s;
    });
    const prev = h('button', { class: 'btn sm', onclick: () => to(cur - 1) }, '‹ 前へ'), next = h('button', { class: 'btn sm', onclick: () => to(cur + 1) }, '次へ ›');
    root.append(stage, h('div', { class: 'bk-ctl' }, prev, cnt, next));
    host.append(root);
    function to(i) {
      i = T.clamp(i, 0, list.length - 1);
      els.forEach((e, k) => { e.classList.toggle('on', k === i); e.classList.toggle('out', k < i); });
      cur = i; cnt.textContent = `${i + 1} / ${list.length}`; prev.disabled = i === 0; next.disabled = i === list.length - 1;
    }
    const size = () => { const aw = host.clientWidth - 40, ah = host.clientHeight - 90, w = Math.max(200, Math.min(aw, ah * 16 / 9)); stage.style.cssText = `width:${w}px;height:${w * 9 / 16}px`; };
    const kd = (e) => { if (e.key === 'ArrowRight' || e.key === ' ') to(cur + 1); if (e.key === 'ArrowLeft') to(cur - 1); };
    document.addEventListener('keydown', kd);
    let sx = null;
    stage.addEventListener('pointerdown', (e) => (sx = e.clientX));
    stage.addEventListener('pointerup', (e) => { if (sx == null) return; if (Math.abs(e.clientX - sx) > 40) to(cur + (e.clientX < sx ? 1 : -1)); else to(cur + 1); sx = null; });
    const ro = new ResizeObserver(size); ro.observe(host); size(); to(0);
    return () => { document.removeEventListener('keydown', kd); ro.disconnect(); };
  };

  const reg = (id, title, key, label, demo) => {
    T.mods[id] = { title, mount(p) { T.linkViewer(p.body, { key, label, demo: (m) => { const c = demo(m); if (c) p.onClose(c); } }); } };
  };
  reg('ppt', 'プレゼンテーション', 'ppt', 'パワーポイント(Boxリンク)', (m) => T.slides(m, 'slides'));
  reg('brochure', 'パンフレット', 'brochure', 'デジタルブック(PDF)', (m) => T.book(m, 'brochure'));
  reg('qbook', 'クオリティブック', 'qbook', 'クオリティブック(PDF)', (m) => T.book(m, 'qbook'));
  reg('hp', '物件公式HP', 'hp', '物件公式HP', (m) => m.append(h('div', { class: 'pad mut' }, '物件公式HPのURLを設定してください。')));
  T.pageEl = pageEl;
})();
