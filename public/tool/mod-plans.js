/* mod-plans.js - ルームプラン / 家具配置 / カラーセレクト */
(function () {
  const T = window.T, h = T.h;

  const TPL = {
    '1LDK': { W: 80, H: 50, r: [[0, 0, 46, 50, 'LDK', 'l'], [46, 0, 24, 26, '洋室', 'r'], [70, 0, 10, 16, '浴室', 'w'], [70, 16, 10, 12, '洗面', 'w'], [46, 26, 12, 14, 'WIC', 's'], [46, 40, 12, 10, 'WC', 'w'], [58, 28, 22, 22, '玄関', 's']], bal: [0, 46] },
    '2LDK': { W: 92, H: 52, r: [[0, 0, 48, 52, 'LDK', 'l'], [48, 0, 24, 26, '洋室1', 'r'], [48, 26, 24, 26, '洋室2', 'r'], [72, 0, 10, 16, '浴室', 'w'], [82, 0, 10, 16, '洗面', 'w'], [72, 16, 20, 12, '納戸', 's'], [72, 28, 20, 24, '玄関', 's']], bal: [0, 48] },
    '3LDK': { W: 104, H: 56, r: [[0, 0, 52, 56, 'LDK', 'l'], [52, 0, 28, 26, '主寝室', 'r'], [52, 26, 14, 30, '洋室2', 'r'], [66, 26, 14, 30, '洋室3', 'r'], [80, 0, 12, 18, '浴室', 'w'], [92, 0, 12, 18, '洗面', 'w'], [80, 18, 24, 12, 'WIC', 's'], [80, 30, 24, 26, '玄関', 's']], bal: [0, 80] },
    '4LDK': { W: 120, H: 60, r: [[0, 0, 56, 60, 'LDK', 'l'], [56, 0, 32, 28, '主寝室', 'r'], [56, 28, 16, 32, '洋室2', 'r'], [72, 28, 16, 32, '洋室3', 'r'], [88, 0, 16, 14, '書斎', 'r'], [88, 14, 16, 16, '洗面', 'w'], [104, 0, 16, 18, '浴室', 'w'], [104, 18, 16, 12, 'WC', 'w'], [88, 30, 16, 30, '洋室4', 'r'], [104, 30, 16, 30, '玄関', 's']], bal: [0, 88] },
  };
  const PLANS = [
    { id: 'A', type: '1LDK', area: 48.6, floor: 1, price: 5480, dir: '南', bal: 7.2 },
    { id: 'B', type: '1LDK', area: 52.3, floor: 2, price: 5980, dir: '東南', bal: 8.4, mirror: true },
    { id: 'C', type: '2LDK', area: 64.8, floor: 1, price: 6980, dir: '南', bal: 9.6 },
    { id: 'D', type: '2LDK', area: 70.2, floor: 2, price: 7680, dir: '南西', bal: 10.2, mirror: true },
    { id: 'E', type: '3LDK', area: 82.4, floor: 2, price: 8980, dir: '南', bal: 12.4 },
    { id: 'F', type: '3LDK', area: 95.6, floor: 3, price: 10800, dir: '南東', bal: 14.0, mirror: true },
    { id: 'G', type: '4LDK', area: 112.0, floor: 3, price: 13800, dir: '南', bal: 18.6 },
    { id: 'H', type: '4LDK', area: 132.4, floor: 3, price: 16800, dir: '南西', bal: 22.0, mirror: true },
  ];
  PLANS.forEach((p) => (p.name = p.id + 'タイプ'));
  T.PLANS = PLANS;
  const FILL = { l: '#2b2418', r: '#1d1d22', w: '#182632', s: '#1b1b1f' };

  function planSvg(p, big) {
    const t = TPL[p.type], pad = 6, W = t.W + pad * 2, H = t.H + 10 + pad * 2;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" font-family="Hiragino Sans,sans-serif">`;
    const mx = (x, w) => (p.mirror ? t.W - x - w : x);
    t.r.forEach(([x, y, w, hh, l, k]) => {
      const X = mx(x, w) + pad, Y = y + pad;
      s += `<rect x="${X}" y="${Y}" width="${w}" height="${hh}" fill="${FILL[k]}" stroke="#c9a45c" stroke-width=".7"/><text x="${X + w / 2}" y="${Y + hh / 2 + 1.5}" font-size="${Math.min(4.2, w / 3.2)}" fill="${k === 'l' ? '#ecd69a' : '#bdb59f'}" text-anchor="middle">${l}</text>`;
    });
    const [bx, bw] = t.bal;
    s += `<rect x="${mx(bx, bw) + pad}" y="${t.H + pad}" width="${bw}" height="8" fill="none" stroke="#c9a45c" stroke-width=".6" stroke-dasharray="2 1.4"/><text x="${mx(bx, bw) + pad + bw / 2}" y="${t.H + pad + 5.4}" font-size="3.4" fill="#9a9486" text-anchor="middle">バルコニー</text>`;
    s += `<g fill="none" stroke="#6fa8c8" stroke-width=".9">${[bx + 4, bx + bw - 14].map((x) => `<line x1="${mx(x, 10) + pad}" y1="${t.H + pad}" x2="${mx(x, 10) + pad + 10}" y2="${t.H + pad}"/>`).join('')}</g>`;
    if (big) s += `<text x="${W - 3}" y="${H - 1.5}" font-size="3" fill="#7d7769" text-anchor="end">N ↑ / 図は概略です</text>`;
    return s + '</svg>';
  }
  T.planSvg = planSvg;
  const priceTxt = (p) => (p.price >= 10000 ? (p.price / 10000).toFixed(2).replace(/0$/, '') + '億円' : T.fmt.n(p.price) + '万円');

  /* ---------- プラン一覧 ---------- */
  function planList(host, p) {
    let type = 'all', maxPrice = 20000, floor = 'all'; const cmp = new Set();
    const bar = h('div', { class: 'row', style: { padding: '12px 22px', borderBottom: '1px solid var(--line)' } });
    const grid = h('div', { class: 'plan-grid' });
    const sc = h('div', { class: 'scroll pad', style: { position: 'absolute', inset: '0 0 0 0', top: '57px' } }, grid);
    const cbar = h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 22px', background: 'rgba(0,0,0,.92)', borderTop: '1px solid var(--gold)', display: 'none', gap: '12px', alignItems: 'center' } });
    host.append(bar, sc, cbar);
    const chips = (items, cur, cb) => { const w = h('div', { class: 'row', style: { gap: '6px' } }); items.forEach(([k, l]) => w.append(h('button', { class: 'chip' + (k === cur ? ' on' : ''), onclick: (e) => { T.$$('.chip', w).forEach((c) => c.classList.remove('on')); e.target.classList.add('on'); cb(k); render(); } }, l))); return w; };
    const pv = h('b', { class: 'gold sans' }, '上限なし');
    const pr = h('input', { type: 'range', min: 5000, max: 20000, step: 500, value: 20000, style: { width: '180px' } });
    pr.addEventListener('input', () => { maxPrice = +pr.value; pv.textContent = maxPrice >= 20000 ? '上限なし' : (maxPrice / 10000).toFixed(2) + '億円以下'; render(); });
    bar.append(chips([['all', 'すべて'], ['1LDK', '1LDK'], ['2LDK', '2LDK'], ['3LDK', '3LDK'], ['4LDK', '4LDK']], 'all', (k) => (type = k)),
      chips([['all', '全階'], [1, '1F'], [2, '2F'], [3, '3F']], 'all', (k) => (floor = k)),
      h('span', { class: 'hint' }, '価格'), pr, pv);
    function render() {
      grid.innerHTML = '';
      const list = PLANS.filter((x) => (type === 'all' || x.type === type) && (floor === 'all' || x.floor === floor) && x.price <= maxPrice);
      if (!list.length) grid.append(h('div', { class: 'mut pad' }, '条件に合うプランがありません'));
      list.forEach((x) => {
        const c = h('div', { class: 'card hov plan-card', tabindex: 0, role: 'button', onclick: () => detail(x), onkeydown: (e) => { if (e.key === 'Enter') detail(x); } },
          h('button', { class: 'cmp' + (cmp.has(x.id) ? ' on' : ''), onclick: (e) => { e.stopPropagation(); if (cmp.has(x.id)) cmp.delete(x.id); else if (cmp.size >= 3) return T.toast('比較は3件までです'); else cmp.add(x.id); render(); } }, cmp.has(x.id) ? '✓ 比較中' : '+ 比較'),
          h('div', { class: 'svgw', html: planSvg(x) }),
          h('h4', {}, `${x.name}  ${x.type}`), h('div', { class: 'meta' }, `${x.area}㎡ / ${x.floor}F / ${x.dir}向き / バルコニー${x.bal}㎡`), h('div', { class: 'price' }, priceTxt(x)));
        grid.append(c);
      });
      cbar.style.display = cmp.size ? 'flex' : 'none';
      cbar.innerHTML = '';
      cbar.append(h('span', { class: 'gold sans' }, `比較: ${[...cmp].join(' / ')}`), h('button', { class: 'btn pri sm', disabled: cmp.size < 2, onclick: compare }, `比較する(${cmp.size})`), h('button', { class: 'btn sm', onclick: () => { cmp.clear(); render(); } }, 'クリア'));
      sc.style.bottom = cmp.size ? '58px' : '0';
    }
    function modal(content) {
      const m = h('div', { class: 'lb', style: { zIndex: 90, overflow: 'auto', alignItems: 'flex-start', padding: '30px 20px' } }, content, h('button', { class: 'x', onclick: close, style: { position: 'fixed' } }, '×'));
      function close() { const k = T.esc.indexOf(close); if (k >= 0) T.esc.splice(k, 1); m.classList.remove('on'); setTimeout(() => m.remove(), 300); }
      T.esc.push(close); document.body.append(m); requestAnimationFrame(() => m.classList.add('on')); return close;
    }
    function detail(x) {
      let close;
      const row = (k, v) => h('tr', {}, h('td', { class: 'mut' }, k), h('td', { style: { textAlign: 'right' } }, v));
      close = modal(h('div', { class: 'card', style: { width: 'min(980px,96vw)', display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', margin: 'auto' } },
        h('div', { html: planSvg(x, true), style: { padding: '24px', background: '#0e0e11', minHeight: '320px' } }),
        h('div', { style: { padding: '24px' } }, h('h3', { style: { margin: '0 0 4px', fontWeight: 500, letterSpacing: '.1em', color: 'var(--gold2)', fontSize: '22px' } }, `${x.name}  ${x.type}`),
          h('div', { class: 'price sans', style: { font: '600 26px sans-serif', color: 'var(--gold2)', margin: '6px 0 14px' } }, priceTxt(x)),
          h('table', { class: 'tb' }, row('専有面積', x.area + '㎡'), row('階数', x.floor + 'F'), row('向き', x.dir), row('バルコニー', x.bal + '㎡'), row('坪単価', T.fmt.n(x.price / (x.area / 3.30579)) + '万円')),
          h('div', { class: 'row', style: { marginTop: '20px' } },
            h('button', { class: 'btn pri', onclick: () => { close(); T.store.set('loanPrice', x.price); p.close(); setTimeout(() => T.open('loan'), 200); } }, 'ローンを試算'),
            h('button', { class: 'btn', onclick: () => { close(); p.close(); setTimeout(() => T.open('furniture'), 200); } }, '家具を配置'),
            h('button', { class: 'btn', onclick: () => { close(); p.close(); setTimeout(() => T.open('color'), 200); } }, 'カラーを選ぶ')))));
    }
    function compare() {
      const L = [...cmp].map((id) => PLANS.find((x) => x.id === id));
      const rows = [['タイプ', (x) => x.type], ['専有面積', (x) => x.area + '㎡'], ['階', (x) => x.floor + 'F'], ['向き', (x) => x.dir], ['バルコニー', (x) => x.bal + '㎡'], ['価格', priceTxt], ['㎡単価', (x) => (x.price / x.area).toFixed(1) + '万円/㎡']];
      modal(h('div', { class: 'card', style: { width: 'min(1100px,96vw)', padding: '22px', margin: 'auto' } },
        h('h3', { style: { margin: '0 0 12px', fontWeight: 500, color: 'var(--gold2)', letterSpacing: '.1em' } }, 'プラン比較'),
        h('div', { style: { display: 'grid', gridTemplateColumns: `110px repeat(${L.length},1fr)`, gap: '10px', alignItems: 'start' } },
          h('div'), L.map((x) => h('div', { class: 'svgw', html: planSvg(x), style: { background: '#0e0e11', borderRadius: '8px', padding: '6px' } })),
          rows.map(([k, f]) => [h('div', { class: 'mut sans', style: { padding: '8px 0', font: '13px sans-serif', borderBottom: '1px solid var(--line)' } }, k), L.map((x) => h('div', { style: { padding: '8px 0', font: '14px sans-serif', borderBottom: '1px solid var(--line)', textAlign: 'center' } }, f(x)))]))));
    }
    render();
  }

  /* ---------- 家具配置 ---------- */
  const ROOMS = { ldk: { n: 'LDK', w: 7.2, h: 4.8, win: [0.6, 6.6, 'b'], door: [0.2, 'l'] }, master: { n: '主寝室', w: 4.8, h: 3.9, win: [0.5, 4.3, 'b'], door: [0.3, 'l'] }, room: { n: '洋室', w: 3.6, h: 3.0, win: [0.4, 3.2, 'b'], door: [0.2, 'r'] } };
  const FURN = [
    ['sofa', 'ソファ(3人)', 2.1, 0.9, '#7a6a52'], ['dining', 'ダイニングテーブル', 1.6, 0.9, '#8a6a42'], ['chair', 'チェア', 0.5, 0.5, '#6b5a40'], ['tv', 'TVボード', 1.8, 0.45, '#4a4036'], ['bed', 'ダブルベッド', 2.0, 1.5, '#5d6a7a'],
    ['bedS', 'シングルベッド', 2.0, 1.0, '#5d6a7a'], ['desk', 'デスク', 1.2, 0.6, '#7a5a3a'], ['ward', 'ワードローブ', 1.8, 0.6, '#4d4540'], ['round', 'ラウンドテーブル', 0.9, 0.9, '#8a6a42', true], ['rug', 'ラグ', 2.4, 1.6, '#3a3550'], ['shelf', '本棚', 0.9, 0.3, '#5a4630'], ['plant', '観葉植物', 0.5, 0.5, '#3d6b45', true],
  ];
  function furnitureView(host) {
    let roomKey = T.store.get('furnRoom', 'ldk'), snap = true, sel = null, items = [];
    const slot = () => 'furn.' + roomKey;
    const load = () => (items = T.store.get(slot(), []));
    load();
    const PX = 90; // px / m
    const aside = h('aside'), stage = h('div', { class: 'fstage' });
    const bar = h('div', { class: 'fbar' }), cvw = h('div', { class: 'fcanvas' });
    stage.append(bar, cvw);
    host.append(h('div', { class: 'fur' }, aside, stage));
    const svgNS = 'http://www.w3.org/2000/svg';
    let svg;
    function build() {
      const R = ROOMS[roomKey], m = 0.5, vw = (R.w + m * 2) * PX, vh = (R.h + m * 2) * PX;
      svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`); svg.style.width = '100%'; svg.style.aspectRatio = vw / vh;
      let g = `<defs><pattern id="gp" width="${PX / 2}" height="${PX / 2}" patternUnits="userSpaceOnUse"><path d="M${PX / 2} 0H0V${PX / 2}" fill="none" stroke="#3a362c" stroke-width="1"/></pattern></defs>
<rect x="${m * PX}" y="${m * PX}" width="${R.w * PX}" height="${R.h * PX}" fill="#15130f"/><rect x="${m * PX}" y="${m * PX}" width="${R.w * PX}" height="${R.h * PX}" fill="url(#gp)"/>
<rect x="${m * PX - 6}" y="${m * PX - 6}" width="${R.w * PX + 12}" height="${R.h * PX + 12}" fill="none" stroke="#c9a45c" stroke-width="6"/>`;
      const wy = (m + R.h) * PX - 3;
      g += `<line x1="${(m + R.win[0]) * PX}" y1="${wy}" x2="${(m + R.win[1]) * PX}" y2="${wy}" stroke="#6fb4dc" stroke-width="7"/><text x="${(m + R.win[1]) * PX}" y="${wy + 26}" fill="#6fb4dc" font-size="12" text-anchor="end" font-family="sans-serif">窓(バルコニー側)</text>`;
      const dx = R.door[1] === 'l' ? m * PX : (m + R.w) * PX, dy = (m + R.door[0]) * PX;
      g += `<path d="M${dx} ${dy} L${dx} ${dy + 0.9 * PX}" stroke="#15130f" stroke-width="8"/><path d="M${dx} ${dy} q${(R.door[1] === 'l' ? 1 : -1) * 0.9 * PX} 0 ${(R.door[1] === 'l' ? 1 : -1) * 0.9 * PX} ${0.9 * PX}" fill="none" stroke="#9a9486" stroke-dasharray="4 3"/><text x="${dx + (R.door[1] === 'l' ? 8 : -8)}" y="${dy - 6}" fill="#9a9486" font-size="12" font-family="sans-serif" text-anchor="${R.door[1] === 'l' ? 'start' : 'end'}">ドア</text>`;
      g += `<text x="${vw - 10}" y="${vh - 8}" fill="#7d7769" font-size="12" text-anchor="end" font-family="sans-serif">${R.n} ${R.w}m × ${R.h}m  (1マス=0.5m)</text><g id="items"></g>`;
      svg.innerHTML = g; cvw.innerHTML = ''; cvw.append(svg);
      svg.addEventListener('pointerdown', (e) => { if (e.target === svg || e.target.tagName === 'rect' && !e.target.closest('.fu')) { sel = null; paint(); } });
      paint();
    }
    function paint() {
      const gI = svg.querySelector('#items'), m = 0.5; gI.innerHTML = '';
      items.map((it, idx) => [it, idx]).sort((a, b) => (a[0].k === 'rug' ? 0 : 1) - (b[0].k === 'rug' ? 0 : 1)).forEach(([it, idx]) => {
        const f = FURN.find((x) => x[0] === it.k), w = f[2] * PX, hh = f[3] * PX;
        const g = document.createElementNS(svgNS, 'g'); g.setAttribute('class', 'fu' + (sel === idx ? ' sel' : '')); g.setAttribute('transform', `translate(${(m + it.x) * PX} ${(m + it.y) * PX}) rotate(${it.r})`);
        g.innerHTML = f[5] ? `<ellipse class="b" cx="0" cy="0" rx="${w / 2}" ry="${hh / 2}" fill="${f[4]}" stroke="#c9a45c" stroke-width="1.2"/>` : `<rect class="b" x="${-w / 2}" y="${-hh / 2}" width="${w}" height="${hh}" rx="4" fill="${f[4]}" stroke="#c9a45c" stroke-width="1.2"/><rect x="${-w / 2 + 3}" y="${-hh / 2 + 3}" width="${w - 6}" height="${Math.min(10, hh / 4)}" rx="3" fill="#fff" opacity=".14"/>`;
        g.innerHTML += `<text y="4" fill="#fff" font-size="${Math.min(12, w / 5)}" text-anchor="middle" font-family="sans-serif" pointer-events="none">${f[1].replace(/\(.*\)/, '')}</text>`;
        g.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); sel = idx; g.setPointerCapture(e.pointerId);
          const pt = toRoom(e), off = { x: it.x - pt.x, y: it.y - pt.y };
          g._mv = (ev) => { const q = toRoom(ev); it.x = q.x + off.x; it.y = q.y + off.y; place(it, f); g.setAttribute('transform', `translate(${(m + it.x) * PX} ${(m + it.y) * PX}) rotate(${it.r})`); };
          g.addEventListener('pointermove', g._mv);
          g.addEventListener('pointerup', () => { g.removeEventListener('pointermove', g._mv); persist(); paint(); }, { once: true });
          g.classList.add('sel');
        });
        g.addEventListener('dblclick', () => rot(90));
        gI.append(g);
      });
    }
    function toRoom(e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()); return { x: q.x / PX - 0.5, y: q.y / PX - 0.5 }; }
    function place(it, f) {
      const R = ROOMS[roomKey], rad = (it.r * Math.PI) / 180, ex = Math.abs(Math.cos(rad)) * f[2] / 2 + Math.abs(Math.sin(rad)) * f[3] / 2, ey = Math.abs(Math.sin(rad)) * f[2] / 2 + Math.abs(Math.cos(rad)) * f[3] / 2;
      if (snap) { it.x = Math.round(it.x / 0.1) * 0.1; it.y = Math.round(it.y / 0.1) * 0.1; const sn = (v, lo, hi) => (Math.abs(v - lo) < 0.12 ? lo : Math.abs(v - hi) < 0.12 ? hi : v); it.x = sn(it.x, ex, R.w - ex); it.y = sn(it.y, ey, R.h - ey); }
      it.x = T.clamp(it.x, ex, R.w - ex); it.y = T.clamp(it.y, ey, R.h - ey);
    }
    function persist() { T.store.set(slot(), items); }
    function add(k) { const f = FURN.find((x) => x[0] === k), R = ROOMS[roomKey]; const it = { k, x: R.w / 2 + (items.length % 5) * 0.3 - 0.6, y: R.h / 2 + (items.length % 4) * 0.3 - 0.4, r: 0 }; items.push(it); sel = items.length - 1; place(it, f); persist(); paint(); }
    function rot(d) { if (sel == null) return T.toast('家具を選択してください'); const it = items[sel]; it.r = (it.r + d + 360) % 360; place(it, FURN.find((x) => x[0] === it.k)); persist(); paint(); }
    function del() { if (sel == null) return; items.splice(sel, 1); sel = null; persist(); paint(); }
    FURN.forEach((f) => aside.append(h('button', { class: 'fi', onclick: () => add(f[0]), draggable: true, ondragstart: (e) => e.dataTransfer.setData('text/plain', f[0]) }, h('i', { style: { width: Math.max(12, f[2] * 12) + 'px', height: Math.max(8, f[3] * 12) + 'px', background: f[4], borderRadius: f[5] ? '50%' : '3px' } }), h('span', {}, f[1], h('br'), h('small', { class: 'mut' }, `${f[2]}×${f[3]}m`)))));
    aside.prepend(h('div', { class: 'hint', style: { marginBottom: '10px' } }, 'クリックで追加 / ドラッグ&ドロップで配置。家具をドラッグで移動、ダブルクリックまたは R キーで回転、Delete で削除。'));
    cvw.addEventListener('dragover', (e) => e.preventDefault());
    cvw.addEventListener('drop', (e) => { e.preventDefault(); const k = e.dataTransfer.getData('text/plain'); if (!FURN.find((x) => x[0] === k)) return; const q = toRoom(e); add(k); const it = items[items.length - 1]; it.x = q.x; it.y = q.y; place(it, FURN.find((x) => x[0] === k)); persist(); paint(); });
    const roomSeg = h('div', { class: 'seg' }, Object.keys(ROOMS).map((k) => h('button', { class: k === roomKey ? 'on' : '', onclick: (e) => { roomKey = k; T.store.set('furnRoom', k); T.$$('button', roomSeg).forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); sel = null; load(); build(); } }, ROOMS[k].n)));
    const snapBtn = h('button', { class: 'btn sm pri', onclick: () => { snap = !snap; snapBtn.classList.toggle('pri', snap); snapBtn.textContent = snap ? 'スナップ ON' : 'スナップ OFF'; } }, 'スナップ ON');
    bar.append(roomSeg, snapBtn, h('button', { class: 'btn sm', onclick: () => rot(-15) }, '⟲ 15°'), h('button', { class: 'btn sm', onclick: () => rot(15) }, '⟳ 15°'), h('button', { class: 'btn sm', onclick: () => rot(90) }, '90°回転'), h('button', { class: 'btn sm', onclick: del }, '削除'),
      h('button', { class: 'btn sm', onclick: () => { items = []; sel = null; persist(); paint(); } }, 'クリア'), h('button', { class: 'btn sm pri', onclick: () => { persist(); T.toast('レイアウトを保存しました(この端末)'); } }, '保存'));
    const kd = (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === 'r' || e.key === 'R') rot(90); if (e.key === 'Delete' || e.key === 'Backspace') del(); };
    document.addEventListener('keydown', kd);
    build();
    return () => document.removeEventListener('keydown', kd);
  }

  /* ---------- カラーセレクト ---------- */
  const PRESETS = {
    'ナチュラル': { wall: 0, floor: 0, accent: 0, door: 3, sofa: 0 }, 'モダン': { wall: 1, floor: 3, accent: 1, door: 2, sofa: 1 },
    'ラグジュアリー': { wall: 4, floor: 4, accent: 0, door: 2, sofa: 3 }, 'ボタニカル': { wall: 3, floor: 2, accent: 3, door: 1, sofa: 2 },
  };
  const PARTS = { wall: '壁', floor: '床', accent: 'アクセントウォール', door: '建具', sofa: 'ソファ' };
  function colorView(host) {
    const F = T.art.FINISH, sel = T.store.get('colorSel', { wall: 0, floor: 0, accent: 0, door: 3, sofa: 0 });
    const view = h('div', { class: 'view' }), aside = h('aside');
    host.append(h('div', { class: 'color-wrap' }, view, aside));
    const draw = () => { const f = {}; Object.keys(PARTS).forEach((k) => (f[k] = F[k][sel[k]][1])); view.innerHTML = T.art.roomGen(f); };
    function side() {
      aside.innerHTML = '';
      aside.append(h('div', { class: 'hint', style: { marginBottom: '8px' } }, 'プリセット'), h('div', { class: 'row', style: { gap: '6px', marginBottom: '16px' } }, Object.keys(PRESETS).map((k) => h('button', { class: 'chip', onclick: () => { Object.assign(sel, PRESETS[k]); T.store.set('colorSel', sel); side(); draw(); } }, k))));
      Object.keys(PARTS).forEach((part) => {
        const nm = h('span', { class: 'sw-name' }, F[part][sel[part]][0]);
        aside.append(h('div', { class: 'gold sans', style: { font: '13px sans-serif' } }, PARTS[part], nm), h('div', { class: 'sw' }, F[part].map(([n, c], i) => h('button', { class: i === sel[part] ? 'on' : '', title: n, 'aria-label': n, style: { background: c }, onclick: (e) => { sel[part] = i; T.store.set('colorSel', sel); T.$$('button', e.target.parentNode).forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); nm.textContent = n; draw(); } }))));
      });
      aside.append(h('div', { class: 'hint' }, '選択内容はこの端末に保存されます。'));
    }
    side(); draw();
  }

  function siteView(host) {
    host.append(h('div', { class: 'scroll', style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', gap: '12px', background: '#16171a' } },
      h('img', { src: gUrl('/assets/img/top_plan_1.png'), alt: '公式サイト掲載プラン', style: { maxWidth: 'min(760px,100%)', maxHeight: 'calc(100% - 60px)', objectFit: 'contain', background: '#2b2e2c', borderRadius: '8px', padding: '12px' } }),
      h('div', { class: 'hint gold' }, '公式サイト掲載のプラン図(参考)。仕様・寸法は図面・重要事項説明書をご確認ください。')));
  }
  T.mods.plan = {
    title: 'プラン',
    mount(p) {
      p.tabs([
        { id: 'list', label: 'ルームプラン一覧', render: (el) => planList(el, p) },
        { id: 'fur', label: '家具配置', render: (el) => p.tabCleanup(furnitureView(el)) },
        { id: 'col', label: 'カラーセレクト', render: (el) => colorView(el) },
        { id: 'site', label: '公式プラン図', render: (el) => siteView(el) },
      ]);
    },
  };
  T.mods.furniture = { title: '家具配置シミュレーション', mount(p) { p.onClose(furnitureView(p.body)); } };
  T.mods.color = { title: 'カラーセレクト', mount(p) { colorView(p.body); } };
})();
