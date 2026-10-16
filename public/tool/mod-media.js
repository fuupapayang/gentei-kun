/* mod-media.js - CG・VR・動画 / CGギャラリー / 眺望ギャラリー */
(function () {
  const T = window.T, h = T.h;

  /* ---------- 360° パノラマ (equirect を canvas で生成 → 透視投影) ---------- */
  function makeProcPano(time) {
    const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), S = T.art.SKY[time], hz = H / 2;
    let r = 12345; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
    const d = { day: 0, dusk: 1, night: 2 }[time];
    let gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, S[0]); gr.addColorStop(0.6, S[1]); gr.addColorStop(1, S[2]); g.fillStyle = gr; g.fillRect(0, 0, W, hz + 2);
    if (time !== 'day') { g.fillStyle = '#fff'; for (let i = 0; i < 320; i++) { g.globalAlpha = 0.3 + rnd() * 0.7; g.fillRect(rnd() * W, rnd() * hz * 0.85, 1.6, 1.6); } g.globalAlpha = 1; }
    const glow = (x, y, rad, col) => { const rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
    const sunX = time === 'day' ? W * 0.3 : W * 0.75, sunY = time === 'day' ? hz - 250 : time === 'dusk' ? hz - 20 : hz - 280;
    glow(sunX, sunY, time === 'dusk' ? 420 : 240, time === 'night' ? 'rgba(220,230,255,.5)' : 'rgba(255,230,170,.9)');
    g.fillStyle = time === 'night' ? '#eef1ff' : '#fff6dc'; g.beginPath(); g.arc(sunX, sunY, time === 'dusk' ? 38 : 28, 0, 7); g.fill();
    // 海
    gr = g.createLinearGradient(0, hz, 0, H); const sea = [['#5a9cc4', '#1a557f'], ['#6a5a8a', '#1c2650'], ['#0a1630', '#02050d']][d];
    gr.addColorStop(0, sea[0]); gr.addColorStop(1, sea[1]); g.fillStyle = gr; g.fillRect(0, hz, W, H - hz);
    for (let i = 0; i < 700; i++) { const y = hz + 3 + Math.pow(rnd(), 1.7) * (H * 0.4); g.fillStyle = time === 'day' ? '#d8eefa' : time === 'dusk' ? '#ffc58a' : '#6f86bf'; g.globalAlpha = 0.1 + rnd() * 0.3; g.fillRect(rnd() * W, y, 8 + (y - hz) * 0.4 * rnd(), 1.6); }
    g.globalAlpha = 1;
    // 陸 (西〜北: x≈0.8W 付近) + 富士山
    const mask = (x) => Math.max(0, Math.cos(((x / W) - 0.82) * Math.PI * 2) * 1.25 - 0.12);
    const col = [['#5f8468', '#8aa28e'], ['#2b2c47', '#3e3a55'], ['#070e1d', '#0b1426']][d];
    g.fillStyle = col[0];
    g.beginPath(); g.moveTo(0, hz + 40);
    for (let x = 0; x <= W; x += 8) { const m = mask(x); g.lineTo(x, hz - m * (46 + 26 * Math.sin(x / 31) + 18 * Math.sin(x / 9.3))); }
    g.lineTo(W, hz + 60); g.lineTo(0, hz + 60); g.fill();
    g.fillStyle = col[1]; g.beginPath(); g.moveTo(0, hz);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, hz + mask(x) * (70 + 22 * Math.sin(x / 40)));
    g.lineTo(W, hz); g.fill();
    g.fillStyle = col[0]; g.beginPath(); g.moveTo(0, hz);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, hz + mask(x) * (28 + 8 * Math.sin(x / 23)));
    g.lineTo(W, hz); g.fill();
    const fx = W * 0.8, F = ['#6177a0', '#2e2c52', '#0a1230'][d], SN = ['#f4f7fc', '#f1b9a2', '#4b5c86'][d];
    g.fillStyle = F; g.beginPath(); g.moveTo(fx - 260, hz); g.bezierCurveTo(fx - 120, hz - 20, fx - 70, hz - 170, fx - 34, hz - 215); g.lineTo(fx + 34, hz - 215); g.bezierCurveTo(fx + 70, hz - 170, fx + 120, hz - 20, fx + 260, hz); g.fill();
    g.fillStyle = SN; g.beginPath(); g.moveTo(fx - 34, hz - 215); g.lineTo(fx + 34, hz - 215); g.lineTo(fx + 66, hz - 150); g.lineTo(fx + 36, hz - 168); g.lineTo(fx + 14, hz - 130); g.lineTo(fx - 8, hz - 160); g.lineTo(fx - 36, hz - 126); g.lineTo(fx - 62, hz - 152); g.fill();
    // 街 (東: x≈0.3W)
    for (let i = 0; i < 70; i++) {
      const x = W * 0.2 + rnd() * W * 0.22, w = 12 + rnd() * 26, hh = 20 + rnd() * 110;
      g.fillStyle = ['#b8c4cf', '#4a4868', '#101830'][d]; g.fillRect(x, hz - hh, w, hh + 4);
      if (time !== 'day') { g.fillStyle = '#ffd27a'; for (let k = 0; k < hh / 10; k++) if (rnd() > 0.5) g.fillRect(x + 3 + rnd() * (w - 8), hz - hh + 4 + k * 10, 3, 4); }
    }
    // 江の島 (南: x≈0.55W)
    g.fillStyle = ['#58779a', '#3b3a62', '#0a1328'][d]; g.beginPath(); g.moveTo(W * 0.55 - 80, hz); g.quadraticCurveTo(W * 0.55, hz - 70, W * 0.55 + 90, hz); g.fill(); g.fillRect(W * 0.55 + 4, hz - 78, 4, 44);
    // 足元: テラスのデッキ
    gr = g.createLinearGradient(0, H * 0.78, 0, H); gr.addColorStop(0, 'rgba(20,16,12,0)'); gr.addColorStop(0.35, '#2a2018'); gr.addColorStop(1, '#16110c'); g.fillStyle = gr; g.fillRect(0, H * 0.78, W, H * 0.22);
    g.strokeStyle = 'rgba(201,164,92,.22)'; for (let x = 0; x < W; x += 64) { g.beginPath(); g.moveTo(x, H * 0.9); g.lineTo(x, H); g.stroke(); }
    g.fillStyle = '#c9a45c'; g.font = '700 38px sans-serif'; g.textAlign = 'center';
    g.fillText('GRANRE JADE', W * 0.5, H * 0.97);
    // ガラスの手すり (水平線上)
    g.strokeStyle = 'rgba(210,230,240,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, H * 0.78); g.lineTo(W, H * 0.78); g.stroke();
    g.fillStyle = 'rgba(160,200,225,.12)'; g.fillRect(0, H * 0.78, W, 6);
    return g.getImageData(0, 0, W, H);
  }
  /* 実写ワイド画像(top_mv.jpg)を等距円筒に配置: 中央180°=原画, 左右はミラーで継ぎ目なく補完 */
  const panoImg = new Image(); let panoReady = false, panoWake = null;
  panoImg.onload = () => { panoReady = true; if (panoWake) panoWake(); }; panoImg.src = gUrl('/assets/img/top_mv.jpg');
  function makePano(time) {
    if (!panoReady) return null;
    const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), bw = 1024, bh = Math.round(bw * panoImg.naturalHeight / panoImg.naturalWidth), by = (H - bh) / 2;
    const tile = (x, flip) => { g.save(); if (flip) { g.translate(x + bw, 0); g.scale(-1, 1); g.drawImage(panoImg, 0, by, bw, bh); } else g.drawImage(panoImg, x, by, bw, bh); g.restore(); };
    tile(512, false); tile(-512, true); tile(1536, true);
    // 上下は端の行を引き伸ばして空/地面に(下は暗く落とす)
    const ex = (sy, dy, dh, flipY) => { g.save(); g.drawImage(c, 0, sy, W, 2, 0, dy, W, dh); g.restore(); };
    ex(by + 1, 0, by, false); ex(by + bh - 3, by + bh, H - by - bh, false);
    let gr = g.createLinearGradient(0, by - 140, 0, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,6,20,.5)'); g.fillStyle = gr; g.fillRect(0, 0, W, by);
    gr = g.createLinearGradient(0, by + bh, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.9)'); g.fillStyle = gr; g.fillRect(0, by + bh, W, H - by - bh);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '600 34px sans-serif'; g.textAlign = 'center'; g.fillText('GRANRE JADE HAYAMA', W / 2, H - 40);
    g.globalCompositeOperation = 'multiply';
    if (time === 'night') { g.fillStyle = '#2a3566'; g.fillRect(0, 0, W, H); } else if (time === 'day') { g.fillStyle = '#e4f0ff'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(70,120,180,.28)'; g.fillRect(0, 0, W, H); }
    g.globalCompositeOperation = 'source-over';
    return g.getImageData(0, 0, W, H);
  }
  const HOT = [
    { l: '富士山', lon: 2, lat: 13 }, { l: '相模湾', lon: 38, lat: -5 }, { l: '葉山の街並み', lon: -22, lat: -28 }, { l: '逗子・鎌倉方面', lon: 74, lat: -3 }, { l: '三浦半島の丘', lon: -62, lat: -10 },
  ];
  const HOT_OLD = [
    { l: '相模湾', lon: 175, lat: -4 }, { l: '江の島', lon: 18, lat: 6 }, { l: '富士山', lon: -64, lat: 14 }, { l: '市街地', lon: -110, lat: 3 }, { l: 'テラス', lon: 0, lat: -40 },
  ];
  function vrView(host, p) {
    const maps = {}; let time = 'dusk';
    const getMap = (t) => maps[t] || (maps[t] = makePano(t));
    panoWake = () => { dirty = true; };
    const box = h('div', { class: 'vr' });
    const cv = h('canvas', { width: 800, height: 450 });
    const hsw = h('div'); box.append(cv, hsw);
    const ui = h('div', { class: 'vr-ui' });
    const timeSeg = h('div', { class: 'seg' }, [['day', '昼'], ['dusk', '夕'], ['night', '夜']].map(([k, l]) => h('button', { class: k === time ? 'on' : '', onclick: (e) => { time = k; T.$$('button', timeSeg).forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); draw(); } }, l)));
    let auto = true;
    const autoBtn = h('button', { class: 'btn sm pri', onclick: () => { auto = !auto; autoBtn.textContent = auto ? '自動回転 ON' : '自動回転 OFF'; autoBtn.classList.toggle('pri', auto); } }, '自動回転 ON');
    ui.append(timeSeg, autoBtn, h('span', { class: 'badge', style: { alignSelf: 'center', background: 'rgba(0,0,0,.6)' } }, 'ドラッグで見回す / ホイール・ピンチでズーム'));
    box.append(ui); host.append(box);
    let yaw, pitch, fov, dirty;
    const ctx = cv.getContext('2d'); let out = ctx.createImageData(cv.width, cv.height);
    yaw = 0; pitch = 0.0; fov = 1.35; dirty = true;
    const W = 2048, H = 1024;
    function draw() {
      const mp = getMap(time); if (!mp) return;
      const src = mp.data, w = cv.width, hh = cv.height, o = out.data;
      const t = Math.tan(fov / 2), a = w / hh, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      for (let y = 0; y < hh; y++) {
        const ny = -((y + 0.5) / hh - 0.5) * 2 * t;
        for (let x = 0; x < w; x++) {
          const nx = ((x + 0.5) / w - 0.5) * 2 * t * a;
          // pitch (x軸) → yaw (y軸)
          const y1 = ny * cp + sp, z1 = -ny * sp + cp;
          const X = nx * cy + z1 * sy, Z = -nx * sy + z1 * cy;
          const lon = Math.atan2(X, Z), lat = Math.atan2(y1, Math.hypot(X, Z));
          const u = ((lon / 6.283185307 + 0.5) * W) | 0, v = T.clamp(((0.5 - lat / 3.141592654) * H) | 0, 0, H - 1);
          const si = (v * W + (u % W)) * 4, di = (y * w + x) * 4;
          o[di] = src[si]; o[di + 1] = src[si + 1]; o[di + 2] = src[si + 2]; o[di + 3] = 255;
        }
      }
      ctx.putImageData(out, 0, 0);
      // ホットスポット
      hsw.innerHTML = '';
      const bw = box.clientWidth, bh = box.clientHeight;
      HOT.forEach((s) => {
        const lon = (s.lon * Math.PI) / 180, la = (s.lat * Math.PI) / 180;
        const wx = Math.sin(lon) * Math.cos(la), wy = Math.sin(la), wz = Math.cos(lon) * Math.cos(la);
        // inverse yaw
        const x1 = wx * cy - wz * sy, z1 = wx * sy + wz * cy;
        const y2 = wy * cp - z1 * sp, z2 = wy * sp + z1 * cp;
        if (z2 <= 0.05) return;
        const px = (0.5 + (x1 / z2) / (2 * t * a)) * bw, py = (0.5 - (y2 / z2) / (2 * t)) * bh;
        if (px < 0 || py < 0 || px > bw || py > bh) return;
        hsw.append(h('div', { class: 'hs', style: { left: px + 'px', top: py + 'px' } }, s.l));
      });
      dirty = false;
    }
    let drag = null, pinch = null; const pts = new Map();
    box.addEventListener('pointerdown', (e) => { box.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); drag = { x: e.clientX, y: e.clientY, yaw, pitch }; auto = false; autoBtn.textContent = '自動回転 OFF'; autoBtn.classList.remove('pri'); });
    box.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
      if (pts.size === 2) { const [a, b] = [...pts.values()], dd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (pinch) { fov = T.clamp(fov * (pinch / dd), 0.5, 2.0); dirty = true; } pinch = dd; return; }
      if (!drag) return; const k = fov / box.clientHeight;
      yaw = drag.yaw - (e.clientX - drag.x) * k; pitch = T.clamp(drag.pitch + (e.clientY - drag.y) * k, -1.35, 1.35); dirty = true;
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = null; if (!pts.size) drag = null; };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('wheel', (e) => { e.preventDefault(); fov = T.clamp(fov * (1 + e.deltaY * 0.001), 0.5, 2.0); dirty = true; }, { passive: false });
    const kd = (e) => { const s = 0.12; if (e.key === 'ArrowLeft') { yaw -= s; dirty = true; } if (e.key === 'ArrowRight') { yaw += s; dirty = true; } if (e.key === 'ArrowUp') { pitch = Math.min(1.3, pitch + s); dirty = true; } if (e.key === 'ArrowDown') { pitch = Math.max(-1.3, pitch - s); dirty = true; } };
    document.addEventListener('keydown', kd);
    let raf, last = performance.now();
    const loop = (t) => { raf = requestAnimationFrame(loop); const dt = (t - last) / 1000; last = t; if (auto) { yaw += dt * 0.12; dirty = true; } if (dirty) draw(); };
    const resize = () => { const w = Math.round(Math.min(760, box.clientWidth || 760)), hh = Math.round(w * (box.clientHeight || 430) / (box.clientWidth || 760)); cv.width = w; cv.height = hh; out = ctx.createImageData(w, hh); dirty = true; };
    resize();
    const ro2 = new ResizeObserver(resize); ro2.observe(box);
    const stop = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); ro2.disconnect(); };
    requestAnimationFrame(loop);
    p.tabCleanup ? p.tabCleanup(stop) : p.onClose(stop);
  }

  /* ---------- CGギャラリー ---------- */
  const ph = (f, o) => () => T.photo(f, o);
  const GALLERY = [
    { title: 'エクステリア(昼)', svg: () => T.art.facade('day') },
    { title: 'エクステリア(夕景)', svg: () => T.art.facade('dusk') },
    { title: 'エクステリア(夜景)', svg: () => T.art.facade('night') },
    { title: 'エントランスアプローチ', svg: ph('top_design_2.png', { alt: 'エントランスアプローチ' }) },
    { title: 'エントランスラウンジ', svg: ph('top_design_1.png', { alt: 'エントランスラウンジ' }) },
    { title: '眺望 西(富士山・夕景)', svg: ph('top_mv.jpg', { alt: '眺望' }) },
    { title: '眺望 南(相模湾と富士)', svg: ph('top_loca_1.jpg', { pos: '50% 62%', alt: '眺望' }) },
    { title: '葉山の夕景(ワイド)', svg: ph('common_nav_img.jpg', { pos: '50% 40%', alt: '夕景' }) },
    { title: '周辺 鎌倉・鶴岡八幡宮', svg: ph('top_access_2.jpg', { pos: '50% 35%', alt: '周辺' }) },
    { title: '周辺 横浜みなとみらい(夜景)', svg: ph('top_access_3.jpg', { alt: '周辺' }) },
    { title: 'Moments of HAYAMA', svg: ph('common_moments_hayama.jpg', { fit: 'contain', bg: '#0b3a40', alt: 'Moments of HAYAMA' }) },
  ];
  function galleryView(host) {
    const g = h('div', { class: 'thumbs scroll pad', style: { position: 'absolute', inset: 0, alignContent: 'start' } });
    GALLERY.forEach((it, i) => g.append(h('button', { class: 'th', type: 'button', onclick: () => T.lightbox(GALLERY, i), 'aria-label': it.title }, h('div', { style: { position: 'absolute', inset: 0 }, html: it.svg() }), h('b', {}, it.title))));
    host.append(g);
  }

  /* ---------- 動画 ---------- */
  function videoView(host, p) {
    T.linkViewer(host, { key: 'video', label: '動画', demo: (m) => { const c = realPlayer(m); (p.tabCleanup || p.onClose)(c); } });
  }
  function realPlayer(host) {
    const V = [['物件紹介ムービー(縦型)', gUrl('/assets/video/top_sp.mp4'), true], ['アクセスムービー', gUrl('/assets/video/top_access.mp4'), false]];
    const box = h('div', { style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 24px', gap: '10px' } });
    const stage = h('div', { style: { flex: 1, minHeight: 0, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' } });
    const seg = h('div', { class: 'seg' });
    let vid = null;
    const play = (i) => {
      T.$$('button', seg).forEach((b, k) => b.classList.toggle('on', k === i));
      if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
      vid = h('video', { src: V[i][1], controls: true, playsinline: true, preload: 'metadata', style: { maxWidth: '100%', maxHeight: '100%', height: V[i][2] ? '100%' : 'auto', width: V[i][2] ? 'auto' : '100%', background: '#000', borderRadius: '10px', boxShadow: '0 20px 50px #000' } });
      stage.innerHTML = ''; stage.append(vid);
    };
    V.forEach((v, i) => seg.append(h('button', { class: '', onclick: () => play(i) }, v[0])));
    box.append(seg, stage, h('div', { class: 'hint', style: { textAlign: 'center' } }, '公式素材の映像です。「設定」で動画URLを登録するとそちらを再生します。'));
    host.append(box); play(0);
    return () => { if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); } };
  }
  function demoPlayer(host) {
    const SC = [
      ['プロローグ', () => T.art.facade('dusk')], ['エクステリア', () => T.art.facade('day')], ['エントランス', () => T.art.facade('dusk', { t: 'translate(-420 -330) scale(1.5)' })],
      ['リビング', () => T.art.room()], ['眺望', () => T.art.view('W', 'dusk', 3)], ['ナイトビュー', () => T.art.facade('night')],
    ];
    const per = 7, total = per * SC.length;
    const pl = h('div', { class: 'player' });
    const scs = SC.map((s, i) => { const d = h('div', { class: 'sc' }, h('div', { html: s[1]() })); d.firstChild.style.setProperty('--o', ['30% 60%', '70% 40%', '50% 70%', '50% 50%', '60% 50%', '40% 60%'][i]); return d; });
    const cap = h('div', { class: 'cap' });
    const bar = h('input', { type: 'range', min: 0, max: total, step: 0.1, value: 0, style: { flex: 1 } });
    const tm = h('span');
    const pb = h('button', { class: 'btn sm', onclick: () => toggle() }, '▶ 再生');
    const big = h('button', { class: 'bigplay', 'aria-label': '再生', onclick: () => toggle() }, '▶');
    const fs = h('button', { class: 'btn sm', onclick: () => { (pl.requestFullscreen || pl.webkitRequestFullscreen || (() => {})).call(pl); } }, '全画面');
    pl.append(h('div', { class: 'stage' }, scs), cap, big, h('div', { class: 'ov' }, pb, bar, tm, fs));
    const note = h('div', { class: 'hint', style: { textAlign: 'center', padding: '8px' } }, 'デモ映像(自動生成)です。「設定」で動画URLを登録すると実際の動画を再生します。');
    host.append(h('div', { style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12px 24px' } }, pl, note));
    let t = 0, playing = false, raf, last = 0, cur = -1;
    const show = () => {
      const i = Math.min(SC.length - 1, Math.floor(t / per));
      if (i !== cur) { cur = i; scs.forEach((s, k) => s.classList.toggle('on', k === i)); cap.textContent = SC[i][0]; const e = scs[i].firstChild; e.style.animation = 'none'; e.offsetWidth; e.style.animation = ''; }
      bar.value = t; tm.textContent = `${fmt(t)} / ${fmt(total)}`;
    };
    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    function toggle() { playing = !playing; pl.classList.toggle('play', playing); pb.textContent = playing ? '❚❚ 一時停止' : '▶ 再生'; big.style.display = playing ? 'none' : ''; last = performance.now(); if (playing) raf = requestAnimationFrame(tick); }
    function tick(now) { if (!playing) return; t += (now - last) / 1000; last = now; if (t >= total) t = 0; show(); raf = requestAnimationFrame(tick); }
    bar.addEventListener('input', () => { t = +bar.value; show(); });
    show();
    return () => { playing = false; cancelAnimationFrame(raf); };
  }

  /* ---------- 眺望ギャラリー ---------- */
  function viewsView(host) {
    let dir = 'S', time = 'dusk', floor = 3;
    const layers = [h('div', { class: 'layer' }), h('div', { class: 'layer' })]; let front = 0;
    const wrap = h('div', { class: 'vw' }, layers);
    const info = h('div', { class: 'hint gold' });
    const draw = () => {
      const nx = 1 - front; layers[nx].innerHTML = T.art.view(dir, time, floor); layers[nx].style.opacity = 1; layers[front].style.opacity = 0; front = nx;
      info.textContent = `${floor}F相当 / ${{ S: '南 相模湾・江の島', W: '西 富士山', E: '東 市街地', N: '北 里山' }[dir]} / ${{ day: '昼', dusk: '夕景', night: '夜景' }[time]}`;
    };
    const seg = (items, cur, cb) => { const el = h('div', { class: 'seg' }); items.forEach(([k, l]) => el.append(h('button', { class: k === cur ? 'on' : '', onclick: (e) => { T.$$('button', el).forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); cb(k); draw(); } }, l))); return el; };
    const ui = h('div', { class: 'vw-ui' }, h('div', { class: 'box' }, h('div', { class: 'hint' }, '方角'), seg([['S', '南'], ['W', '西'], ['E', '東'], ['N', '北']], dir, (k) => (dir = k))), h('div', { class: 'box' }, h('div', { class: 'hint' }, '時間帯'), seg([['day', '昼'], ['dusk', '夕'], ['night', '夜']], time, (k) => (time = k))), h('div', { class: 'box' }, info));
    const fl = h('input', { type: 'range', min: 1, max: 4, step: 1, value: floor, 'aria-label': '階数' });
    fl.addEventListener('input', () => { floor = +fl.value; flv.textContent = floor + 'F'; draw(); });
    const flv = h('b', {}, floor + 'F');
    const sl = h('div', { class: 'floor-sl' }, h('span', {}, '4F'), fl, h('span', {}, '1F'), flv);
    host.append(wrap, ui, sl); wrap.append(); draw();
  }

  T.mods.vr = {
    title: 'CG・VR・動画',
    mount(p) {
      p.tabs([
        { id: 'vr', label: '360° VR', render: (el, pp) => vrView(el, pp) },
        { id: 'gal', label: 'CGギャラリー', render: (el) => galleryView(el) },
        { id: 'vid', label: '動画', render: (el, pp) => { const c = videoView(el, pp); } },
      ]);
    },
  };
  T.mods.gallery = { title: 'CGギャラリー', mount(p) { galleryView(p.body); } };
  T.mods.video = { title: '動画', mount(p) { videoView(p.body, p); } };
  T.mods.views = { title: '眺望集', mount(p) { viewsView(p.body); } };
  T.GALLERY = GALLERY;
})();
