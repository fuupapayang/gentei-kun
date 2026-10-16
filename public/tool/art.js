/* art.js - 生成アート (建築パース / 眺望 / 室内) すべてインラインSVG */
(function () {
  const T = (window.T = window.T || {});
  T.art = {};
  let uid = 0;
  const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const SKY = {
    day: ['#4a8fd0', '#9ccbe8', '#f3e8cf'],
    dusk: ['#121c42', '#7b4a7e', '#f6a86a'],
    night: ['#03060f', '#0a1430', '#1e2c54'],
  };
  T.art.SKY = SKY;
  const skyDef = (id, t) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY[t][0]}"/><stop offset=".55" stop-color="${SKY[t][1]}"/><stop offset="1" stop-color="${SKY[t][2]}"/></linearGradient>`;
  const NS = 'xmlns="http://www.w3.org/2000/svg"';

  function stars(r, n, maxY) {
    let s = '';
    for (let i = 0; i < n; i++)
      s += `<circle cx="${(r() * 1600) | 0}" cy="${(r() * maxY) | 0}" r="${(0.6 + r() * 1.4).toFixed(1)}" fill="#fff" opacity="${(0.3 + r() * 0.7).toFixed(2)}"/>`;
    return s;
  }

  /* ---------------- 建築ファサード ---------------- */
  T.art.facade = function (time, o) {
    o = o || {};
    const u = 'f' + ++uid, r = rng(7 + (o.seed || 0));
    const lit = time !== 'day';
    const col = {
      fac: { day: '#e4ded0', dusk: '#a89b8c', night: '#48464d' }[time],
      fac2: { day: '#cfc8b8', dusk: '#8f8274', night: '#3a3940' }[time],
      base: { day: '#5c554d', dusk: '#2f2b2b', night: '#1d1c21' }[time],
      hill1: { day: '#86a590', dusk: '#40405f', night: '#0b1428' }[time],
      hill2: { day: '#5f8468', dusk: '#2b2c47', night: '#070e1d' }[time],
      t1: { day: '#3f7048', dusk: '#1e3340', night: '#0a1b1d' }[time],
      t2: { day: '#58905e', dusk: '#2c4553', night: '#10272b' }[time],
      g1: { day: '#9a9d92', dusk: '#322e39', night: '#0d0e15' }[time],
      g2: { day: '#6d7268', dusk: '#17151d', night: '#050508' }[time],
    };
    const wins = [];
    const win = (x, y, w, h) => {
      const on = !lit || r() > 0.2;
      wins.push([x, y, w, h, on]);
    };
    for (let i = 0; i < 5; i++) win(449 + i * 146, 322, 118, 100); // 3F
    for (let i = 0; i < 6; i++) win(399 + i * 138, 464, 112, 104); // 2F
    for (let i = 0; i < 3; i++) { win(395 + i * 124, 614, 100, 96); win(857 + i * 124, 614, 100, 96); } // 1F

    let s = `<svg ${NS} viewBox="0 0 1600 900" preserveAspectRatio="${o.par || 'xMidYMid slice'}"><defs>${skyDef(u + 's', time)}
<linearGradient id="${u}gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a9cde2"/><stop offset="1" stop-color="#4a7a99"/></linearGradient>
<linearGradient id="${u}wm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6b0"/><stop offset="1" stop-color="#f0a448"/></linearGradient>
<linearGradient id="${u}gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col.g1}"/><stop offset="1" stop-color="${col.g2}"/></linearGradient>
<radialGradient id="${u}sun"><stop offset="0" stop-color="${time === 'day' ? '#fffbe0' : time === 'dusk' ? '#ffd9a0' : '#f4f6ff'}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}vg" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
<filter id="${u}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="${u}b2"><feGaussianBlur stdDeviation="3"/></filter></defs>
<g transform="${o.t || ''}">
<rect width="1600" height="900" fill="url(#${u}s)"/>`;
    if (time !== 'day') s += stars(r, time === 'night' ? 110 : 26, time === 'night' ? 420 : 200);
    if (time === 'day') s += `<circle cx="1250" cy="150" r="190" fill="url(#${u}sun)"/><circle cx="1250" cy="150" r="34" fill="#fffbe6"/>`;
    if (time === 'dusk') s += `<circle cx="250" cy="600" r="520" fill="url(#${u}sun)" opacity=".8"/><circle cx="250" cy="600" r="46" fill="#ffe2b4"/>`;
    if (time === 'night') s += `<circle cx="1290" cy="140" r="130" fill="url(#${u}sun)" opacity=".45"/><circle cx="1290" cy="140" r="30" fill="#f1f3ff"/>`;
    if (time === 'day') s += `<g fill="#fff" opacity=".75"><ellipse cx="380" cy="150" rx="150" ry="22"/><ellipse cx="470" cy="132" rx="90" ry="20"/><ellipse cx="980" cy="230" rx="170" ry="20"/></g>`;
    s += `<path d="M0 650 C200 560 380 610 560 590 S900 540 1100 580 S1450 560 1600 610 L1600 900 L0 900Z" fill="${col.hill1}"/>
<path d="M0 690 C260 630 460 670 700 650 S1150 620 1350 660 S1520 650 1600 670 L1600 900 L0 900Z" fill="${col.hill2}"/>
<rect y="700" width="1600" height="200" fill="url(#${u}gr)"/>`;
    // 池 + 反射
    s += `<rect x="300" y="742" width="1000" height="56" rx="6" fill="${time === 'day' ? '#7fa9c4' : '#0b1220'}" opacity=".9"/>`;
    if (lit) wins.forEach((w) => { if (w[4] && w[1] > 590) s += `<rect x="${w[0]}" y="748" width="${w[2]}" height="40" fill="#ffb85c" opacity=".22" filter="url(#${u}b2)"/>`; });
    // 建物
    s += `<rect x="360" y="580" width="880" height="140" fill="${col.base}"/>
<rect x="340" y="440" width="920" height="146" fill="${col.fac}"/>
<rect x="420" y="302" width="760" height="140" fill="${col.fac2}"/>
<rect x="400" y="284" width="800" height="20" fill="${time === 'day' ? '#3b3733' : '#15141a'}"/><rect x="400" y="302" width="800" height="3" fill="#c9a45c"/>
<rect x="326" y="430" width="948" height="16" fill="${time === 'day' ? '#4a4540' : '#121116'}"/><rect x="326" y="445" width="948" height="3" fill="#c9a45c" opacity=".8"/>
<rect x="346" y="578" width="908" height="12" fill="${time === 'day' ? '#4a4540' : '#121116'}"/>
<rect x="420" y="302" width="29" height="140" fill="#7b5a3a"/><rect x="1151" y="302" width="29" height="140" fill="#7b5a3a"/>
<g stroke="#00000033" stroke-width="2">${Array.from({ length: 6 }, (_, i) => `<line x1="${426 + i * 4.5}" y1="302" x2="${426 + i * 4.5}" y2="442"/><line x1="${1157 + i * 4.5}" y1="302" x2="${1157 + i * 4.5}" y2="442"/>`).join('')}</g>`;
    // テラス手すり
    s += `<g fill="${time === 'day' ? '#bfe0ee' : '#7fb3d4'}" fill-opacity=".28" stroke="#d9e6ee" stroke-opacity=".6" stroke-width="2"><rect x="344" y="396" width="74" height="34"/><rect x="1182" y="396" width="74" height="34"/></g>`;
    // 窓グロー
    if (lit) wins.forEach((w) => { if (w[4]) s += `<rect x="${w[0] - 10}" y="${w[1] - 8}" width="${w[2] + 20}" height="${w[3] + 16}" fill="#ffae4a" opacity=".5" filter="url(#${u}b)"/>`; });
    wins.forEach((w) => {
      const [x, y, ww, h, on] = w;
      const fill = lit ? (on ? `url(#${u}wm)` : '#16223c') : `url(#${u}gl)`;
      s += `<rect x="${x}" y="${y}" width="${ww}" height="${h}" fill="${fill}"/>`;
      if (lit && on) s += `<rect x="${x + ww * 0.15}" y="${y}" width="${ww * 0.12}" height="${h}" fill="#fff6dc" opacity=".35"/><ellipse cx="${x + ww * 0.7}" cy="${y + 28}" rx="10" ry="6" fill="#fff" opacity=".55"/>`;
      if (!lit) s += `<path d="M${x} ${y + h} L${x + ww} ${y} L${x + ww} ${y + 22} L${x + 22} ${y + h}Z" fill="#fff" opacity=".18"/>`;
      s += `<rect x="${x}" y="${y}" width="${ww}" height="${h}" fill="none" stroke="#22201e" stroke-width="4"/><line x1="${x + ww / 2}" y1="${y}" x2="${x + ww / 2}" y2="${y + h}" stroke="#22201e" stroke-width="3"/>`;
    });
    // エントランス
    s += `<rect x="760" y="602" width="82" height="118" fill="${lit ? '#ffcf86' : '#3a342d'}"/>
<rect x="760" y="602" width="82" height="118" fill="none" stroke="#c9a45c" stroke-width="4"/><line x1="801" y1="602" x2="801" y2="720" stroke="#c9a45c" stroke-width="3"/>
<rect x="730" y="590" width="142" height="12" fill="#c9a45c"/>
${lit ? `<ellipse cx="801" cy="722" rx="120" ry="14" fill="#ffc46a" opacity=".45" filter="url(#${u}b2)"/>` : ''}`;
    // アプローチ
    s += `<path d="M770 720 L832 720 L1000 900 L560 900Z" fill="${time === 'day' ? '#c9c2b2' : lit ? '#2a2825' : '#222'}"/>
<g stroke="${lit ? '#4a463f' : '#00000022'}" stroke-width="2">${[760, 790, 830, 880].map((y) => `<line x1="${770 - (y - 720) * 0.35}" y1="${y}" x2="${832 + (y - 720) * 0.35}" y2="${y}"/>`).join('')}</g>`;
    if (lit) for (let i = 0; i < 6; i++) { const y = 760 + i * 24, d = (y - 720) * 0.4; s += `<circle cx="${764 - d}" cy="${y}" r="4" fill="#ffd28a"/><circle cx="${838 + d}" cy="${y}" r="4" fill="#ffd28a"/><circle cx="${764 - d}" cy="${y}" r="18" fill="#ffc15f" opacity=".35" filter="url(#${u}b2)"/><circle cx="${838 + d}" cy="${y}" r="18" fill="#ffc15f" opacity=".35" filter="url(#${u}b2)"/>`; }
    // 樹木
    const tree = (cx, by, sz, cyp) => {
      let t = `<rect x="${cx - 5 * sz}" y="${by - 90 * sz}" width="${10 * sz}" height="${90 * sz}" fill="#2a1f17"/>`;
      if (cyp) return t + `<ellipse cx="${cx}" cy="${by - 150 * sz}" rx="${34 * sz}" ry="${130 * sz}" fill="${col.t1}"/><ellipse cx="${cx + 8 * sz}" cy="${by - 160 * sz}" rx="${22 * sz}" ry="${110 * sz}" fill="${col.t2}"/>`;
      return t + `<ellipse cx="${cx}" cy="${by - 150 * sz}" rx="${95 * sz}" ry="${80 * sz}" fill="${col.t1}"/><ellipse cx="${cx - 40 * sz}" cy="${by - 120 * sz}" rx="${60 * sz}" ry="${50 * sz}" fill="${col.t2}"/><ellipse cx="${cx + 42 * sz}" cy="${by - 175 * sz}" rx="${56 * sz}" ry="${46 * sz}" fill="${col.t2}"/>`;
    };
    s += tree(190, 760, 1.5) + tree(310, 740, 1.0, true) + tree(1390, 770, 1.6) + tree(1280, 745, 1.0, true) + tree(95, 790, 1.2, true) + tree(1510, 790, 1.2, true);
    if (lit) [[190, 770], [1390, 780], [310, 745], [1280, 750]].forEach((p) => (s += `<ellipse cx="${p[0]}" cy="${p[1]}" rx="60" ry="12" fill="#ffb95e" opacity=".5" filter="url(#${u}b)"/>`));
    // 生垣
    s += `<rect y="836" width="1600" height="64" fill="${time === 'day' ? '#355a3d' : '#0a1612'}"/>${Array.from({ length: 22 }, (_, i) => `<ellipse cx="${i * 76 + 20}" cy="838" rx="50" ry="22" fill="${time === 'day' ? '#3f6b48' : '#0d1c17'}"/>`).join('')}`;
    s += `</g><rect width="1600" height="900" fill="url(#${u}vg)"/></svg>`;
    return s;
  };

  /* ---------------- 眺望 ---------------- */
  T.art.view = function (dir, time, floor) {
    const u = 'v' + ++uid, r = rng(dir.charCodeAt(0) * 13 + floor * 7);
    const hz = Math.round(620 - floor * 64);
    const lit = time !== 'day';
    const sc = 1.3 - floor * 0.18; // 手前の景色は低層ほど大きく
    let s = `<svg ${NS} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs>${skyDef(u + 's', time)}
<radialGradient id="${u}sun"><stop offset="0" stop-color="${time === 'dusk' ? '#ffcf8f' : '#fff7d6'}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="${u}sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${{ day: '#4d8fb8', dusk: '#6a5a8a', night: '#0a1630' }[time]}"/><stop offset="1" stop-color="${{ day: '#17507c', dusk: '#1c2650', night: '#02050d' }[time]}"/></linearGradient>
<filter id="${u}b"><feGaussianBlur stdDeviation="6"/></filter></defs>
<rect width="1600" height="${hz + 2}" fill="url(#${u}s)"/>`;
    if (time !== 'day') s += stars(r, time === 'night' ? 90 : 20, hz - 80);
    const sunX = { S: 700, W: 880, E: 1200, N: 500 }[dir];
    if (time === 'day') s += `<circle cx="${sunX}" cy="${hz - 330}" r="200" fill="url(#${u}sun)"/><circle cx="${sunX}" cy="${hz - 330}" r="32" fill="#fffbe8"/>`;
    if (time === 'dusk' && dir === 'W') s += `<circle cx="${sunX}" cy="${hz - 40}" r="360" fill="url(#${u}sun)"/><circle cx="${sunX}" cy="${hz - 40}" r="50" fill="#ffe0b0"/>`;
    if (time === 'dusk' && dir !== 'W') s += `<rect y="${hz - 140}" width="1600" height="140" fill="#ff9a5a" opacity=".22" filter="url(#${u}b)"/>`;
    if (time === 'night') s += `<circle cx="${sunX + 250}" cy="${hz - 360}" r="26" fill="#eef1ff"/><circle cx="${sunX + 250}" cy="${hz - 360}" r="120" fill="url(#${u}sun)" opacity=".3"/>`;
    const dark = { day: 0, dusk: 1, night: 2 }[time];
    if (dir === 'S' || dir === 'N') {
      s += `<rect y="${hz}" width="1600" height="${900 - hz}" fill="url(#${u}sea)"/>`;
      for (let i = 0; i < 90; i++) {
        const y = hz + 4 + Math.pow(r(), 1.6) * (900 - hz), x = r() * 1600, w = 20 + (y - hz) * 0.5 * r();
        s += `<rect x="${x | 0}" y="${y | 0}" width="${w | 0}" height="2" fill="${time === 'day' ? '#cfe9f5' : time === 'dusk' ? '#ffc58a' : '#6f86bf'}" opacity="${(0.15 + r() * 0.35).toFixed(2)}"/>`;
      }
      if (time === 'dusk') s += `<path d="M${sunX - 30} ${hz} L${sunX + 30} ${hz} L${sunX + 160} 900 L${sunX - 160} 900Z" fill="#ffc07a" opacity=".22"/>`;
      if (dir === 'S') {
        s += `<path d="M980 ${hz} C1010 ${hz - 40} 1060 ${hz - 52} 1110 ${hz - 34} S1170 ${hz - 6} 1180 ${hz}Z" fill="${['#58779a', '#3b3a62', '#0a1328'][dark]}"/><rect x="1095" y="${hz - 82}" width="4" height="50" fill="${['#58779a', '#3b3a62', '#0a1328'][dark]}"/>${lit ? `<circle cx="1097" cy="${hz - 84}" r="5" fill="#ffd98a"/>` : ''}`;
        s += `<path d="M420 ${hz + 120} l70 0 l-12 -26 l-58 0z" fill="${['#f3f3ee', '#cfa88a', '#202a46'][dark]}"/><path d="M455 ${hz + 94} L455 ${hz + 20} L498 ${hz + 94}Z" fill="${['#fff', '#ffd3a4', '#39466d'][dark]}"/>`;
      } else {
        s += `<path d="M0 ${hz} L1600 ${hz} L1600 ${hz - 70} C1400 ${hz - 120} 1200 ${hz - 40} 900 ${hz - 90} S400 ${hz - 40} 0 ${hz - 110}Z" fill="${['#6d8f78', '#34385a', '#0a1328'][dark]}"/>`;
      }
    } else if (dir === 'W') {
      const F = ['#6177a0', '#2e2c52', '#0a1230'][dark], SN = ['#f4f7fc', '#f1b9a2', '#4b5c86'][dark];
      s += `<path d="M300 ${hz} C560 ${hz - 6} 700 ${hz - 170} 800 ${hz - 250} L890 ${hz - 250} C990 ${hz - 170} 1150 ${hz - 8} 1420 ${hz}Z" fill="${F}"/>
<path d="M800 ${hz - 250} L890 ${hz - 250} C940 ${hz - 205} 960 ${hz - 175} 990 ${hz - 150} L940 ${hz - 170} L905 ${hz - 130} L870 ${hz - 165} L835 ${hz - 120} L800 ${hz - 160} L760 ${hz - 150} C780 ${hz - 190} 790 ${hz - 220} 800 ${hz - 250}Z" fill="${SN}"/>
<path d="M0 ${hz} L1600 ${hz} L1600 ${hz + 40} L0 ${hz + 40}Z" fill="${['#8aa28e', '#3e3a55', '#0b1426'][dark]}"/>`;
      s += `<rect y="${hz + 20}" width="1600" height="${900 - hz}" fill="${['#6f8d6b', '#262b3c', '#0a121a'][dark]}"/>`;
      for (let i = 0; i < 110; i++) {
        const x = r() * 1560, y = hz + 24 + Math.pow(r(), 1.3) * (880 - hz) * 0.8, w = (18 + r() * 22) * sc * (0.6 + (y - hz) / 400), h = w * 0.7;
        s += `<rect x="${x | 0}" y="${y | 0}" width="${w | 0}" height="${h | 0}" fill="${['#e7e1d6', '#6b5b66', '#171b2a'][dark]}"/><path d="M${x | 0} ${y | 0} l${w / 2} -${h * 0.5} l${w / 2} ${h * 0.5}z" fill="${['#b25b48', '#4a3a4d', '#10131f'][dark]}"/>${lit && r() > 0.45 ? `<rect x="${(x + w * 0.3) | 0}" y="${(y + h * 0.35) | 0}" width="${w * 0.25}" height="${h * 0.3}" fill="#ffc86e"/>` : ''}`;
      }
    } else {
      s += `<rect y="${hz}" width="1600" height="${900 - hz}" fill="${['#5c7a66', '#2a2e45', '#080f18'][dark]}"/>`;
      for (let i = 0; i < 46; i++) {
        const w = 28 + r() * 50, h = (40 + r() * 160) * (0.8 + floor * 0.1), x = i * 36 + r() * 12;
        s += `<rect x="${x | 0}" y="${(hz - h) | 0}" width="${w | 0}" height="${h | 0}" fill="${['#b8c4cf', '#4a4868', '#101830'][dark]}"/>`;
        if (lit) for (let k = 0; k < h / 16; k++) if (r() > 0.55) s += `<rect x="${(x + 4 + r() * (w - 12)) | 0}" y="${hz - h + 6 + k * 16}" width="5" height="6" fill="#ffd27a" opacity=".85"/>`;
      }
      s += `<path d="M1000 ${hz + 70} C1200 ${hz + 20} 1400 ${hz + 60} 1600 ${hz + 20} L1600 900 L1000 900Z" fill="url(#${u}sea)" opacity=".9"/>`;
    }
    // 手前の松/木 (低層ほど大きい)
    for (let i = 0; i < 16; i++) {
      const x = i * 110 + r() * 40 - 30, h = (80 + r() * 90) * sc, w = h * 0.55;
      s += `<rect x="${x + w / 2 - 3}" y="${900 - h * 0.35}" width="6" height="${h * 0.4}" fill="#10170f"/><ellipse cx="${x + w / 2}" cy="${900 - h * 0.55}" rx="${w}" ry="${h * 0.45}" fill="${['#2f5a3a', '#16241e', '#050c09'][dark]}"/>`;
    }
    // 窓枠
    s += `<path fill-rule="evenodd" fill="#0b0b0d" d="M0 0H1600V900H0Z M70 50H1530V850H70Z"/><rect x="70" y="50" width="1460" height="800" fill="none" stroke="#c9a45c" stroke-width="3"/><rect x="796" y="50" width="8" height="800" fill="#0b0b0d" opacity=".9"/>`;
    return s + '</svg>';
  };

  /* ---------------- 室内 (カラーセレクト/ギャラリー) ---------------- */
  T.art.FINISH = {
    wall: [['ホワイト', '#efeae0'], ['グレージュ', '#cfc6b8'], ['ミストブルー', '#b9c6cf'], ['セージ', '#b7c0a8'], ['チャコール', '#4b4b50']],
    floor: [['オーク', '#b98f5c'], ['ウォールナット', '#6b4a32'], ['アッシュ', '#cdbba0'], ['ヘリンボーン灰', '#8d8a85'], ['ブラック', '#2c2a29']],
    accent: [['ノーブルゴールド', '#b8934a'], ['ディープネイビー', '#233253'], ['テラコッタ', '#b4684a'], ['エメラルド', '#1f5c4c'], ['ライトグレー', '#d9d9d9']],
    door: [['ダークオーク', '#4b3526'], ['ホワイト', '#f1efe9'], ['ブラック', '#1b1b1d'], ['ナチュラル', '#caa77a']],
    sofa: [['ベージュ', '#c6b49a'], ['グレー', '#7a7d84'], ['ネイビー', '#2b3b63'], ['ブラウンレザー', '#6a4228']],
  };
  T.art.room = function (f) {
    f = f || {};
    const wall = f.wall || '#efeae0', floor = f.floor || '#b98f5c', accent = f.accent || '#b8934a', door = f.door || '#4b3526', sofa = f.sofa || '#c6b49a';
    const u = 'r' + ++uid;
    let s = `<svg ${NS} viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice"><defs>
<linearGradient id="${u}sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
<linearGradient id="${u}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8dc0e6"/><stop offset="1" stop-color="#f1e6d0"/></linearGradient>
<radialGradient id="${u}lt" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9b8" stop-opacity=".8"/><stop offset="1" stop-color="#ffe9b8" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="700" fill="${wall}"/>
<polygon points="0,0 1200,0 900,120 300,120" fill="#fbf9f3"/>
<polygon points="0,0 300,120 300,440 0,700" fill="${wall}"/><polygon points="1200,0 900,120 900,440 1200,700" fill="${wall}"/>
<rect x="300" y="120" width="600" height="320" fill="${accent}"/>
<polygon points="0,700 300,440 900,440 1200,700" fill="${floor}"/>`;
    for (let i = -4; i <= 16; i++) { const xb = 300 + i * 40; s += `<line x1="${xb}" y1="440" x2="${600 + (xb - 600) * 2.625}" y2="700" stroke="#000" stroke-opacity=".12"/>`; }
    for (let k = 1; k < 6; k++) { const y = 440 + 260 * (k * k) / 36; s += `<line x1="${300 - (y - 440) * 1.15}" y1="${y}" x2="${900 + (y - 440) * 1.15}" y2="${y}" stroke="#000" stroke-opacity=".08"/>`; }
    s += `<polygon points="0,700 300,440 300,430 0,672" fill="#fff" opacity=".85"/><polygon points="1200,700 900,440 900,430 1200,672" fill="#fff" opacity=".85"/><rect x="300" y="428" width="600" height="12" fill="#fff" opacity=".85"/>
<rect x="300" y="120" width="600" height="320" fill="url(#${u}sh)"/>
<polygon points="0,0 300,120 300,440 0,700" fill="url(#${u}sh)" opacity=".4"/>
<g transform="translate(1060 360)"><polygon points="-120,-300 120,-300 120,-130 -120,-130" fill="none"/></g>
<polygon points="1000,150 1120,60 1120,520 1000,430" fill="url(#${u}sky)"/><polygon points="1000,150 1120,60 1120,520 1000,430" fill="none" stroke="#2a2724" stroke-width="6"/>
<polygon points="1060,105 1060,475" stroke="#2a2724" stroke-width="5"/>
<polygon points="940,135 990,140 990,435 940,425" fill="#f6f1e6" opacity=".95"/>
<polygon points="40,150 130,203 130,560 40,590" fill="${door}"/><polygon points="40,150 130,203 130,560 40,590" fill="none" stroke="#c9a45c" stroke-width="3"/><circle cx="118" cy="390" r="4" fill="#c9a45c"/>
<rect x="420" y="170" width="150" height="100" fill="#fff" stroke="#c9a45c" stroke-width="5"/><rect x="436" y="186" width="118" height="68" fill="${accent}" opacity=".6"/><path d="M436 254 L480 214 L510 238 L535 220 L554 254Z" fill="#fff" opacity=".7"/>
<rect x="650" y="190" width="120" height="70" fill="#1c1b1b" stroke="#c9a45c" stroke-width="3"/><rect x="654" y="194" width="112" height="62" fill="#262a34"/>
<line x1="600" y1="0" x2="600" y2="160" stroke="#c9a45c" stroke-width="3"/><ellipse cx="600" cy="168" rx="46" ry="22" fill="#2a2724"/><ellipse cx="600" cy="182" rx="40" ry="10" fill="#ffe4a8"/><circle cx="600" cy="190" r="140" fill="url(#${u}lt)"/>
<ellipse cx="600" cy="560" rx="330" ry="82" fill="#e9e1d1" opacity=".92"/><ellipse cx="600" cy="560" rx="300" ry="68" fill="none" stroke="${accent}" stroke-width="4" opacity=".7"/>
<ellipse cx="610" cy="470" rx="320" ry="16" fill="#000" opacity=".25"/>
<rect x="400" y="368" width="420" height="96" rx="14" fill="${sofa}"/><rect x="384" y="398" width="46" height="84" rx="14" fill="${sofa}"/><rect x="790" y="398" width="46" height="84" rx="14" fill="${sofa}"/><rect x="404" y="420" width="412" height="52" rx="10" fill="#000" opacity=".12"/>
<rect x="430" y="352" width="86" height="56" rx="10" fill="#fff" opacity=".35"/><rect x="700" y="352" width="86" height="56" rx="10" fill="${accent}" opacity=".8"/>
<rect x="480" y="520" width="240" height="60" rx="8" fill="#2a2724"/><rect x="480" y="520" width="240" height="14" rx="6" fill="#fff" opacity=".25"/>
<rect x="400" y="390" width="0" height="0"/>
<line x1="880" y1="330" x2="880" y2="450" stroke="#c9a45c" stroke-width="4"/><path d="M850 330 L910 330 L895 290 L865 290Z" fill="#ffe9bf"/><circle cx="880" cy="320" r="60" fill="url(#${u}lt)"/>
<rect x="690" y="410" width="0" height="0"/>
</svg>`;
    return s;
  };
})();

/* 実写アセット(公式素材)。生成アートは T.art.gen.* にフォールバックとして保持 */
(function () {
  const T = window.T, A = T.art;
  A.gen = { facade: A.facade, view: A.view, room: A.room };
  const P = gUrl('/assets/img/');
  const TF = { // 時間帯フィルタ(実写への疑似昼夜切替)
    day: 'brightness(1.32) saturate(.42) contrast(.9) sepia(.12) hue-rotate(160deg) saturate(.9)',
    dusk: 'none',
    night: 'brightness(.58) saturate(.8) contrast(1.1) hue-rotate(188deg)',
  };
  T.photo = function (file, o) {
    o = o || {};
    const st = `width:100%;height:100%;display:block;object-fit:${o.fit || 'cover'};object-position:${o.pos || '50% 50%'};` +
      (o.filter && o.filter !== 'none' ? `filter:${o.filter};` : '') + (o.tf ? `transform:${o.tf};transform-origin:${o.origin || '50% 50%'};` : '') + (o.bg ? `background:${o.bg};` : '');
    return `<img src="${P}${file}" alt="${(o.alt || '').replace(/"/g, '')}" draggable="false" style="${st}" onerror="this.style.display='none'">`;
  };
  // 外観: 実写CG (concept / design_2)
  A.facade = function (time, o) {
    time = time || 'dusk';
    if (o && o.t) return T.photo('top_design_2.png', { filter: TF[time], pos: '40% 50%', alt: 'エントランスアプローチ' });
    return T.photo('top_concept.jpg', { filter: TF[time], pos: '50% 60%', alt: 'エクステリア' });
  };
  // 眺望: 方角ごとに実写 (西=top_mv / 南=top_loca_1 / 東=top_access_3 / 北=top_access_2)
  const VIEW = { W: ['top_mv.jpg', '50% 45%'], S: ['top_loca_1.jpg', '50% 62%'], E: ['top_access_3.jpg', '50% 40%'], N: ['top_access_2.jpg', '50% 35%'] };
  A.view = function (dir, time, floor) {
    const v = VIEW[dir] || VIEW.W;
    const nat = dir === 'E' ? { day: 'brightness(1.2) saturate(.9)', dusk: 'brightness(.9)', night: 'none' } : TF;
    const z = 1 + (4 - (floor || 3)) * 0.04;
    return T.photo(v[0], { filter: nat[time || 'dusk'], pos: v[1], tf: `scale(${z.toFixed(2)})`, alt: '眺望' });
  };
  // 室内: エントランスラウンジCG
  A.room = function (f) {
    if (f && Object.keys(f).length) return A.gen.room(f);
    return T.photo('top_design_1.png', { alt: 'エントランスラウンジ' });
  };
  // カラーセレクタ用(色を反映できる生成版)
  A.roomGen = A.gen.room;
  T.HERO = (time) => T.photo('top_mv.jpg', { filter: TF[time || 'dusk'], pos: '50% 50%', alt: '物件ビジュアル' });
})();
