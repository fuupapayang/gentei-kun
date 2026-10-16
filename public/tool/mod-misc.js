/* mod-misc.js - 住宅ローン / 周辺マップ・ハザード / 資料集 / メーカー資料・在庫 */
(function () {
  const T = window.T, h = T.h;
  const NS = 'http://www.w3.org/2000/svg';

  /* =============== 住宅ローンシミュレーター =============== */
  function calcLoan(i) {
    const loan = Math.max(0, (i.price - i.down) * 10000);
    const n = i.years * 12, nb = i.years * 2, rm = i.rate / 1200, rb = i.rate / 200;
    const Lb = loan * (i.bonus / 100), Lm = loan - Lb, eq = i.method === 'equal';
    const pm = eq ? (rm ? (Lm * rm) / (1 - Math.pow(1 + rm, -n)) : Lm / n) : 0;
    const pb = eq ? (rb ? (Lb * rb) / (1 - Math.pow(1 + rb, -nb)) : Lb / nb) : 0;
    let balM = Lm, balB = Lb; const years = []; let totPay = 0, totInt = 0, first = 0, last = 0, bonusPay = 0;
    for (let y = 0; y < i.years; y++) years.push({ y: y + 1, pay: 0, prin: 0, int: 0, bal: 0 });
    for (let t = 1; t <= n; t++) {
      const Y = years[Math.floor((t - 1) / 12)];
      let im = balM * rm, prm = eq ? pm - im : Lm / n; if (t === n) prm = balM;
      balM -= prm; let pay = im + prm, ib = 0, prb = 0;
      if (nb && t % 6 === 0 && Lb > 0) { ib = balB * rb; prb = eq ? pb - ib : Lb / nb; if (t === n) prb = balB; balB -= prb; bonusPay = eq ? pb : prb + ib; }
      Y.pay += pay + ib + prb; Y.prin += prm + prb; Y.int += im + ib; Y.bal = Math.max(0, balM + balB);
      totPay += pay + ib + prb; totInt += im + ib;
      if (t === 1) first = pay; if (t === n) last = pay;
    }
    return { loan, monthly: first, monthlyLast: last, bonusPay, totPay, totInt, years, eq };
  }
  function loanView(host) {
    const defIn = { price: T.store.get('loanPrice', 7980), down: 1600, rate: 1.2, years: 35, bonus: 0, method: 'equal' };
    const inp = Object.assign(defIn, T.store.get('loanIn', {}));
    if (T.store.get('loanPrice')) { inp.price = T.store.get('loanPrice'); T.store.set('loanPrice', null); }
    let scen = T.store.get('loanScen', [null, null, null]);
    const aside = h('aside', { class: 'scroll' }), main = h('main');
    host.append(h('div', { class: 'loan', style: { position: 'absolute', inset: 0 } }, aside, main));
    const FIELDS = [['price', '物件価格', 'min:1000,max:30000,step:10', '万円'], ['down', '頭金', 'min:0,max:15000,step:10', '万円'], ['rate', '金利(年)', 'min:0,max:5,step:0.01', '%'], ['years', '返済期間', 'min:5,max:50,step:1', '年'], ['bonus', 'ボーナス払い(借入比率)', 'min:0,max:50,step:5', '%']];
    FIELDS.forEach(([k, label, rg, unit]) => {
      const o = Object.fromEntries(rg.split(',').map((s) => s.split(':')));
      const num = h('input', { class: 'inp', type: 'number', min: o.min, max: o.max, step: o.step, value: inp[k], inputmode: 'decimal' });
      const sl = h('input', { type: 'range', min: o.min, max: o.max, step: o.step, value: inp[k], 'aria-label': label });
      const set = (v) => { inp[k] = +v; num.value = v; sl.value = v; update(); };
      sl.addEventListener('input', () => set(sl.value)); num.addEventListener('input', () => { if (num.value !== '') { inp[k] = +num.value; sl.value = num.value; update(); } });
      aside.append(h('div', { class: 'fld' }, h('div', { class: 'top' }, h('label', { class: 'f' }, label), h('div', { class: 'v' }, num, h('span', { class: 'hint' }, unit))), sl));
    });
    const seg = h('div', { class: 'seg', style: { marginBottom: '16px' } }, [['equal', '元利均等'], ['principal', '元金均等']].map(([k, l]) => h('button', { class: inp.method === k ? 'on' : '', onclick: (e) => { inp.method = k; T.$$('button', seg).forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); update(); } }, l)));
    aside.append(h('label', { class: 'f' }, '返済方式'), seg);
    const slotBox = h('div', { class: 'row', style: { gap: '6px' } });
    ['A', 'B', 'C'].forEach((n, i) => slotBox.append(h('button', { class: 'btn sm', onclick: () => { scen[i] = { in: Object.assign({}, inp), r: slim(calcLoan(inp)) }; T.store.set('loanScen', scen); T.toast(`シナリオ${n}に保存しました`); update(); } }, `${n}に保存`)));
    aside.append(h('label', { class: 'f' }, 'シナリオ保存(3件まで比較)'), slotBox, h('p', { class: 'hint' }, '※概算です。諸費用・団信・固定資産税等は含みません。実際の条件は金融機関にご確認ください。'));
    const slim = (r) => ({ loan: r.loan, monthly: r.monthly, monthlyLast: r.monthlyLast, bonusPay: r.bonusPay, totPay: r.totPay, totInt: r.totInt });
    function update() {
      T.store.set('loanIn', inp);
      const r = calcLoan(inp), man = (v) => T.fmt.man(v);
      main.innerHTML = '';
      const stat = (a, b, u) => h('div', { class: 'card' }, h('small', {}, a), h('b', {}, b, h('em', {}, u || '')));
      main.append(h('div', { class: 'big' },
        stat('借入額', T.fmt.n(r.loan / 10000), '万円'),
        stat(r.eq ? '毎月返済額' : '初回月額返済額', T.fmt.n(r.monthly), '円'),
        r.eq ? null : stat('最終月額返済額', T.fmt.n(r.monthlyLast), '円'),
        inp.bonus > 0 ? stat('ボーナス時加算(年2回)', T.fmt.n(r.bonusPay), '円') : null,
        stat('総返済額', T.fmt.n(r.totPay / 10000), '万円'), stat('うち利息', T.fmt.n(r.totInt / 10000), '万円')));
      main.append(chart(r), h('h4', { class: 'gold', style: { fontWeight: 500, letterSpacing: '.1em', margin: '16px 0 6px' } }, '年別返済表'),
        h('div', { class: 'card', style: { maxHeight: '260px', overflow: 'auto' } }, h('table', { class: 'tb' }, h('thead', {}, h('tr', {}, ['年', '返済額', '元金', '利息', '年末残高'].map((x) => h('th', {}, x)))),
          h('tbody', {}, r.years.map((y) => h('tr', {}, h('td', {}, y.y + '年目'), h('td', {}, T.fmt.n(y.pay)), h('td', {}, T.fmt.n(y.prin)), h('td', {}, T.fmt.n(y.int)), h('td', {}, T.fmt.n(y.bal))))))));
      if (scen.some(Boolean)) {
        const rows = [['物件価格', (s) => T.fmt.n(s.in.price) + '万円'], ['頭金', (s) => T.fmt.n(s.in.down) + '万円'], ['金利/期間', (s) => `${s.in.rate}% / ${s.in.years}年`], ['方式', (s) => (s.in.method === 'equal' ? '元利均等' : '元金均等') + (s.in.bonus ? ` +ボーナス${s.in.bonus}%` : '')], ['月額(初回)', (s) => T.fmt.n(s.r.monthly) + '円'], ['総返済額', (s) => T.fmt.man(s.r.totPay)], ['利息総額', (s) => T.fmt.man(s.r.totInt)]];
        main.append(h('h4', { class: 'gold', style: { fontWeight: 500, letterSpacing: '.1em', margin: '18px 0 6px' } }, 'シナリオ比較'),
          h('div', { class: 'card' }, h('table', { class: 'tb' }, h('thead', {}, h('tr', {}, h('th', {}, ''), ['A', 'B', 'C'].map((n, i) => h('th', {}, n, scen[i] ? h('button', { class: 'btn sm', style: { marginLeft: '8px', padding: '1px 8px' }, onclick: () => { scen[i] = null; T.store.set('loanScen', scen); update(); } }, '×') : null)))),
            h('tbody', {}, rows.map(([k, f]) => h('tr', {}, h('td', {}, k), [0, 1, 2].map((i) => h('td', {}, scen[i] ? f(scen[i]) : '—'))))))));
      }
    }
    function chart(r) {
      const W = 900, H = 260, L = 56, B = 28, T0 = 12, n = r.years.length, bw = (W - L - 16) / n;
      const max = Math.max(...r.years.map((y) => y.pay)) || 1, maxBal = r.loan || 1;
      let s = `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}" style="width:100%;font-family:sans-serif" role="img" aria-label="返済推移グラフ">`;
      for (let k = 0; k <= 4; k++) { const y = T0 + ((H - B - T0) * k) / 4; s += `<line x1="${L}" x2="${W - 8}" y1="${y}" y2="${y}" stroke="#2c2a26"/><text x="${L - 6}" y="${y + 4}" font-size="10" fill="#9a9486" text-anchor="end">${T.fmt.n((max * (4 - k)) / 4 / 10000)}万</text>`; }
      r.years.forEach((y, i) => {
        const x = L + i * bw + 1, ih = ((H - B - T0) * y.int) / max, ph = ((H - B - T0) * y.prin) / max, base = H - B;
        s += `<rect x="${x}" y="${base - ph}" width="${Math.max(1, bw - 2)}" height="${ph}" fill="#c9a45c"/><rect x="${x}" y="${base - ph - ih}" width="${Math.max(1, bw - 2)}" height="${ih}" fill="#6a5a3a"/>`;
        if (n <= 20 || i % 5 === 4) s += `<text x="${x + bw / 2}" y="${H - 10}" font-size="10" fill="#9a9486" text-anchor="middle">${y.y}</text>`;
      });
      const pts = r.years.map((y, i) => `${L + i * bw + bw / 2},${T0 + (H - B - T0) * (1 - y.bal / maxBal)}`).join(' ');
      s += `<polyline points="${pts}" fill="none" stroke="#e8e0cc" stroke-width="2"/><g font-size="11" fill="#cdbf9a"><rect x="${L + 6}" y="${T0 + 2}" width="10" height="10" fill="#c9a45c"/><text x="${L + 20}" y="${T0 + 11}">元金</text><rect x="${L + 60}" y="${T0 + 2}" width="10" height="10" fill="#6a5a3a"/><text x="${L + 74}" y="${T0 + 11}">利息</text><line x1="${L + 114}" x2="${L + 130}" y1="${T0 + 7}" y2="${T0 + 7}" stroke="#e8e0cc" stroke-width="2"/><text x="${L + 134}" y="${T0 + 11}">残高</text></g></svg>`;
      return h('div', { class: 'card', style: { padding: '10px' }, html: s });
    }
    update();
  }

  /* =============== 周辺マップ / ハザード =============== */
  const CATS = { sta: ['駅・バス', '#6fb4dc'], shop: ['買い物', '#e0b050'], edu: ['教育', '#8fcf8a'], med: ['医療', '#e07a7a'], park: ['公園・海', '#4fbf9f'], food: ['飲食', '#c58ae0'] };
  const FAC = [
    ['逗子駅(JR横須賀線)', 'sta', 250, 150], ['葉山バス停', 'sta', 470, 335], ['スーパーマーケット', 'shop', 520, 265], ['ドラッグストア', 'shop', 395, 262], ['コンビニ', 'shop', 430, 305],
    ['葉山小学校', 'edu', 355, 330], ['葉山中学校', 'edu', 610, 210], ['こども園', 'edu', 505, 385], ['総合病院', 'med', 660, 330], ['クリニック', 'med', 395, 365], ['一色海岸', 'park', 575, 470], ['海浜公園', 'park', 300, 440],
    ['カフェ&ベーカリー', 'food', 560, 320], ['レストラン', 'food', 330, 280],
  ].map(([n, c, x, y]) => ({ n, c, x, y }));
  const P0 = { x: 450, y: 290 }, MPP = 3.2;
  const dist = (f) => Math.round((Math.hypot(f.x - P0.x, f.y - P0.y) * MPP) / 10) * 10;
  function mapSvg(opts) {
    let s = `<defs><pattern id="mg" width="45" height="45" patternUnits="userSpaceOnUse"><path d="M45 0H0V45" fill="none" stroke="#1d1c19" stroke-width="1"/></pattern></defs>
<rect width="900" height="560" fill="#121214"/><rect width="900" height="560" fill="url(#mg)"/>
<path d="M0 445 C150 420 260 490 420 470 S720 440 900 480 L900 560 L0 560Z" fill="#0f2233"/><text x="780" y="530" fill="#3b6a8c" font-size="14" font-family="sans-serif" letter-spacing="6">相模湾</text>
<path d="M0 90 C180 120 300 60 520 100 S800 80 900 40 L900 0 L0 0Z" fill="#14201a"/><text x="60" y="40" fill="#3a5a45" font-size="12" font-family="sans-serif" letter-spacing="4">山地</text>
<path d="M120 0 C140 120 230 190 300 250 S380 380 330 470" fill="none" stroke="#1f3c52" stroke-width="12" opacity=".9"/><text x="150" y="110" fill="#4a7a9a" font-size="10" font-family="sans-serif">葉山川</text>
<g stroke="#3a352b" fill="none" stroke-width="5"><path d="M0 290 H900"/><path d="M450 0 V560"/><path d="M200 120 L720 440"/><path d="M0 200 H380 L450 290"/></g>
<g stroke="#262319" fill="none" stroke-width="3"><path d="M0 340 H450 M450 340 H900 M0 400 H900 M600 0 V290 M300 290 V560 M0 230 H900"/></g>
<path d="M0 135 H900" stroke="#6a6a70" stroke-width="3" stroke-dasharray="14 6" fill="none"/><text x="700" y="125" fill="#7a7a82" font-size="10" font-family="sans-serif">JR横須賀線</text>
<g fill="#16241b"><rect x="500" y="400" width="90" height="40" rx="6"/><rect x="250" y="410" width="90" height="36" rx="6"/></g>`;
    if (opts.hazard) {
      const H = opts.hazard;
      if (H.flood) s += `<path d="M95 0 C120 120 215 200 285 255 S350 385 305 470 L350 470 C400 380 340 250 270 180 S160 110 145 0Z" fill="#2b79c9" opacity=".45"/><path d="M0 470 C150 445 260 515 420 495 S720 465 900 505 L900 560 L0 560 L0 470Z" fill="#2b79c9" opacity=".22"/>`;
      if (H.tsunami) s += `<path d="M0 410 C150 385 260 455 420 435 S720 405 900 445 L900 560 L0 560Z" fill="#e0a02b" opacity=".4"/>`;
      if (H.slide) s += `<path d="M0 0 H900 V60 C800 100 650 110 520 130 S210 160 0 120Z" fill="#c9423b" opacity=".42"/><path d="M640 130 l60 40 l-20 40 l-60 -30z" fill="#c9423b" opacity=".45"/>`;
    }
    s += `<g fill="none" stroke="#c9a45c" stroke-width="1" opacity=".5"><circle cx="${P0.x}" cy="${P0.y}" r="${500 / MPP}" stroke-dasharray="4 4"/><circle cx="${P0.x}" cy="${P0.y}" r="${1000 / MPP}" stroke-dasharray="4 4"/></g><text x="${P0.x + 500 / MPP * 0.72}" y="${P0.y - 500 / MPP * 0.72 - 3}" fill="#c9a45c" font-size="11" font-family="sans-serif">500m</text><text x="${P0.x + 1000 / MPP * 0.72}" y="${P0.y - 1000 / MPP * 0.72 - 3}" fill="#c9a45c" font-size="11" font-family="sans-serif">1km</text>`;
    if (opts.fac) opts.fac.forEach((f) => { const on = opts.sel === f.n, col = CATS[f.c][1]; s += `<g class="mk" data-n="${f.n}" style="cursor:pointer"><line x1="${P0.x}" y1="${P0.y}" x2="${f.x}" y2="${f.y}" stroke="${col}" stroke-width="${on ? 2 : 0.8}" opacity="${on ? 0.95 : 0.3}" stroke-dasharray="${on ? '' : '3 3'}"/><circle cx="${f.x}" cy="${f.y}" r="${on ? 11 : 7}" fill="${col}" stroke="#000" stroke-width="2"/>${on ? `<text x="${f.x}" y="${f.y - 16}" fill="#fff" font-size="13" font-family="sans-serif" text-anchor="middle" style="paint-order:stroke" stroke="#000" stroke-width="4">${f.n} ${dist(f)}m</text>` : ''}</g>`; });
    s += `<g transform="translate(${P0.x} ${P0.y})"><circle r="26" fill="#c9a45c" opacity=".25"><animate attributeName="r" values="18;34;18" dur="2.4s" repeatCount="indefinite"/></circle><path d="M0 -24 C-14 -24 -20 -12 -20 -6 C-20 8 0 24 0 24 S20 8 20 -6 C20 -12 14 -24 0 -24Z" fill="#c9a45c" stroke="#000" stroke-width="2"/><circle cy="-8" r="6" fill="#000"/></g><text x="${P0.x}" y="${P0.y + 44}" fill="#ecd69a" font-size="14" font-family="sans-serif" text-anchor="middle" style="paint-order:stroke" stroke="#000" stroke-width="4">${T.prop.name}</text>`;
    s += `<g transform="translate(850 40)" fill="#ecd69a" font-family="sans-serif" font-size="12" text-anchor="middle"><circle r="16" fill="none" stroke="#c9a45c"/><path d="M0 -12 L5 4 L0 0 L-5 4Z" fill="#c9a45c"/><text y="-20">N</text></g>`;
    return s;
  }
  function mapView(host, p, initialTab) {
    const OSM = 'https://www.openstreetmap.org/?mlat=35.2733&mlon=139.5805#map=15/35.2733/139.5805';
    const aside = h('aside', { class: 'scroll' }), mv = h('div', { class: 'mv' });
    host.append(h('div', { class: 'mapw', style: { position: 'absolute', inset: 0 } }, aside, mv));
    let cat = 'all', sel = null, mode = initialTab || 'fac', hz = { flood: true, tsunami: true, slide: true };
    function draw() {
      const list = FAC.filter((f) => cat === 'all' || f.c === cat);
      mv.innerHTML = `<svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice" xmlns="${NS}">${mapSvg(mode === 'fac' ? { fac: list, sel } : { hazard: hz, fac: [] })}</svg>`;
      T.$$('.mk', mv).forEach((g) => g.addEventListener('click', () => { sel = g.dataset.n; draw(); side(); }));
    }
    function side() {
      aside.innerHTML = '';
      aside.append(h('div', { class: 'row', style: { marginBottom: '10px' } }, h('div', { class: 'seg' }, [['fac', '周辺施設'], ['hz', 'ハザード']].map(([k, l]) => h('button', { class: mode === k ? 'on' : '', onclick: () => { mode = k; draw(); side(); } }, l)))));
      if (mode === 'fac') {
        aside.append(h('div', { class: 'row', style: { gap: '6px', marginBottom: '8px' } }, [['all', 'すべて'], ...Object.entries(CATS).map(([k, v]) => [k, v[0]])].map(([k, l]) => h('button', { class: 'chip' + (cat === k ? ' on' : ''), onclick: () => { cat = k; draw(); side(); } }, l))));
        FAC.filter((f) => cat === 'all' || f.c === cat).sort((a, b) => dist(a) - dist(b)).forEach((f) => aside.append(h('button', { class: 'fac' + (sel === f.n ? ' on' : ''), onclick: () => { sel = f.n; draw(); side(); } }, h('span', { class: 'dot', style: { background: CATS[f.c][1] } }), h('span', {}, f.n, h('br'), h('small', { class: 'mut' }, CATS[f.c][0])), h('span', { class: 'd' }, dist(f) + 'm', h('small', {}, `徒歩約${Math.ceil(dist(f) / 80)}分`)))));
      } else {
        [['flood', '洪水浸水想定', '#2b79c9'], ['tsunami', '津波浸水想定', '#e0a02b'], ['slide', '土砂災害警戒区域', '#c9423b']].forEach(([k, l, c]) => aside.append(h('label', { class: 'fac', style: { cursor: 'pointer' } }, h('input', { type: 'checkbox', checked: hz[k], onchange: (e) => { hz[k] = e.target.checked; draw(); } }), h('span', { class: 'dot', style: { background: c } }), l)));
        aside.append(h('div', { class: 'card pad', style: { margin: '12px 0', padding: '12px' } }, h('div', { class: 'gold sans', style: { font: '13px sans-serif', marginBottom: '6px' } }, '本物件の想定(サンプル)'), h('div', { class: 'hint' }, '洪水: 想定区域外 / 津波: 想定区域外(海抜約28m) / 土砂災害: 区域外。')));
        aside.append(h('div', { class: 'hint' }, '※ 図はデモ用の概略図です。必ず公式ハザードマップでご確認ください。'));
        aside.append(h('a', { class: 'btn sm', href: 'https://disaportal.gsi.go.jp/', target: '_blank', rel: 'noopener', style: { marginTop: '8px' } }, 'ハザードマップポータル ↗'));
      }
      aside.append(h('div', { style: { marginTop: '14px' } }, h('a', { class: 'btn sm', href: OSM, target: '_blank', rel: 'noopener' }, 'OpenStreetMapで開く ↗')), h('p', { class: 'hint' }, '距離は直線距離からの概算(徒歩80m/分)。施設名・位置はサンプルです。'));
    }
    side(); draw();
  }

  /* =============== 資料集 / メーカー資料 / 在庫 =============== */
  function parseList(txt, def) {
    const l = (txt || '').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => { const [t, ...u] = s.split('|'); return { t: t.trim(), u: u.join('|').trim() }; });
    return l.length ? l : def;
  }
  function openDoc(d) {
    const p = T.panel(d.t);
    T.linkViewer(p.body, { url: d.u, label: d.t, demo: (m) => p.onClose(T.book(m, 'docs')) });
  }
  function docGrid(host, list, ic) {
    const g = h('div', { class: 'launch scroll', style: { position: 'absolute', inset: 0, alignContent: 'start' } });
    list.forEach((d) => g.append(h('button', { class: 'tile', onclick: () => openDoc(d) }, h('span', { html: T.icon(ic) }), h('b', {}, d.t), h('small', {}, d.u ? 'リンク登録済' : 'サンプル(設定でURL登録)'))));
    host.append(g);
  }
  T.mods.docs = {
    title: '資料集',
    mount(p) { docGrid(p.body, parseList(T.settings.get('docsList'), ['重要事項説明書', '価格表', '間取図集', '管理規約(案)', '設備仕様書', '周辺環境資料'].map((t) => ({ t, u: '' }))), 'docs'); },
  };
  const STAT = ['空き', '商談中', '申込', '成約'];
  function stockView(host) {
    const st = T.store.get('stock', {});
    const units = [];
    T.PLANS.forEach((pl, i) => [0, 1].forEach((k) => units.push({ id: `${pl.floor}${String(i * 2 + k + 1).padStart(2, '0')}`, pl, st: (i * 3 + k * 2) % 4 })));
    let ft = 'all', fs = 'all';
    const body = h('tbody'), bar = h('div', { class: 'row', style: { padding: '12px 22px' } });
    const draw = () => {
      body.innerHTML = '';
      units.filter((u) => (ft === 'all' || u.pl.type === ft) && (fs === 'all' || STAT[st[u.id] != null ? st[u.id] : u.st] === fs)).forEach((u) => {
        const s = st[u.id] != null ? st[u.id] : u.st;
        body.append(h('tr', {}, h('td', {}, u.id + '号室'), h('td', {}, u.pl.type), h('td', {}, u.pl.name), h('td', {}, u.pl.floor + 'F'), h('td', {}, u.pl.area + '㎡'), h('td', {}, u.pl.dir), h('td', {}, T.fmt.n(u.pl.price) + '万円'),
          h('td', {}, h('button', { class: 'chip on', style: { background: ['#4a8a63', '#c9a45c', '#d98a4a', '#6a6a70'][s], borderColor: 'transparent', color: '#000' }, onclick: () => { st[u.id] = (s + 1) % 4; T.store.set('stock', st); draw(); } }, STAT[s]))));
      });
    };
    const chips = (items, cb) => { const w = h('div', { class: 'row', style: { gap: '6px' } }); items.forEach((x, i) => w.append(h('button', { class: 'chip' + (i ? '' : ' on'), onclick: (e) => { T.$$('.chip', w).forEach((c) => c.classList.remove('on')); e.target.classList.add('on'); cb(x); draw(); } }, x === 'all' ? 'すべて' : x))); return w; };
    bar.append(chips(['all', '1LDK', '2LDK', '3LDK', '4LDK'], (x) => (ft = x)), chips(['all', ...STAT], (x) => (fs = x)), h('span', { class: 'hint' }, '※状況ボタンをタップで切替(この端末に保存)'));
    host.append(bar, h('div', { class: 'scroll pad card', style: { position: 'absolute', inset: '60px 22px 20px', padding: 0 } }, h('table', { class: 'tb' }, h('thead', {}, h('tr', {}, ['住戸', 'タイプ', 'プラン', '階', '面積', '向き', '価格', '状況'].map((x) => h('th', {}, x)))), body)));
    draw();
  }
  T.mods.maker = {
    title: 'メーカー資料・在庫リスト',
    mount(p) {
      p.tabs([
        { id: 'mk', label: 'メーカー資料', render: (el) => docGrid(el, parseList(T.settings.get('makerList'), ['キッチン(サンプル社)', 'バスルーム(サンプル社)', 'フローリング', '建具・収納', '照明・スイッチ', '水栓・衛生機器'].map((t) => ({ t, u: '' }))), 'maker') },
        { id: 'st', label: '在庫リスト', render: (el) => stockView(el) },
      ]);
    },
  };
  T.mods.loan = { title: '住宅ローンシミュレーション', mount(p) { loanView(p.body); } };
  T.mods.hazard = { title: 'ハザードマップ', mount(p) { mapView(p.body, p, 'hz'); } };
  T.mods.map = { title: '周辺マップ', mount(p) { mapView(p.body, p, 'fac'); } };
  T.calcLoan = calcLoan;
})();
