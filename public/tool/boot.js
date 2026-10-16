/* boot.js - ヒーロー / ドック / ランチャー / 設定 */
(function () {
  const T = window.T, h = T.h;
  const DOCK = [
    ['hp', 'hp', '物件公式HP'], ['vr', 'vr', 'CG・VR'], ['ppt', 'present', 'プレゼン\nテーション'], ['brochure', 'book', 'パンフレット'],
    ['qbook', 'quality', 'クオリティ\nブック'], ['plan', 'plan', 'プラン'], ['gallery', 'gallery', 'CGギャラリー'], ['views', 'view', '眺望集'],
    ['hazard', 'hazard', 'ハザード\nマップ'], ['docs', 'docs', '資料集'], ['video', 'video', '動画'], ['loan', 'loan', '住宅ローン\nシミュレーション'],
    ['maker', 'maker', 'メーカー資料\n・在庫リスト'],
  ];
  const EXTRA = [
    ['furniture', 'furn', '家具配置シミュレーション', 'ドラッグ&回転でレイアウト提案'],
    ['color', 'color', 'カラーセレクト', '内装仕上げをリアルタイム確認'],
    ['map', 'map', '周辺マップ', '施設・距離・ハザード'],
  ];
  let heroTime = 'dusk';
  function drawHero() {
    const hero = T.$('#hero');
    hero.innerHTML = T.HERO(heroTime);
    T.$$('#timeSwitch button').forEach((b) => b.classList.toggle('on', b.dataset.t === heroTime));
  }
  function launcher() {
    const p = T.panel('すべての機能');
    const g = h('div', { class: 'launch scroll', style: { position: 'absolute', inset: 0, alignContent: 'start' } });
    const tile = (id, ic, label, sub) => h('button', { class: 'tile', type: 'button', onclick: () => { p.close(); setTimeout(() => T.open(id), 120); } }, h('span', { html: T.icon(ic) }), h('b', {}, label.replace('\n', '')), h('small', {}, sub || ''));
    const subs = { hp: '公式サイトを表示', vr: '360°VR・ギャラリー・動画', ppt: 'Box / PowerPoint資料', brochure: 'ページめくりブック', qbook: '品質・仕様のご説明', plan: '間取り比較・家具・カラー', gallery: '建築パース・室内CG', views: '階別・時間帯別の眺望', hazard: '周辺施設・防災情報', docs: '各種資料', video: '物件紹介ムービー', loan: '返済シミュレーション', maker: 'メーカー・在庫一覧' };
    DOCK.forEach(([id, ic, l]) => g.append(tile(id, ic, l, subs[id])));
    EXTRA.forEach(([id, ic, l, s]) => g.append(tile(id, ic, l, s)));
    g.append(h('div', { class: 'tile dis', 'aria-disabled': 'true', title: '2026年リリース予定' }, h('span', { html: T.icon('ai') }), h('b', {}, 'AIによる商談分析'), h('small', {}, '※2026年リリース予定')));
    p.body.append(g);
  }
  T.mods.settings = {
    title: '設定',
    mount(p) {
      const s = T.settings.all();
      const f = (k, label, ph, area) => h('div', { class: 'fld' }, h('label', { class: 'f' }, label), h(area ? 'textarea' : 'input', { class: 'inp', id: 'st-' + k, rows: area ? 5 : null, placeholder: ph || '', value: s[k] || '' }, area ? s[k] || '' : null));
      const wrap = h('div', { class: 'set scroll pad', style: { position: 'absolute', inset: 0, maxWidth: 'none' } }, h('div', { class: 'set' },
        h('p', { class: 'hint' }, 'リンクURLはこの端末(ブラウザ)の localStorage に保存されます。Box共有リンク・PDF・YouTube・Googleスライドは自動で埋め込み表示に変換します。'),
        f('hp', '物件公式HP URL', 'https://...'), f('ppt', 'プレゼンテーション(パワーポイント/Boxリンク)', 'https://app.box.com/s/...'),
        f('brochure', 'パンフレット(PDF)', 'https://.../brochure.pdf'), f('qbook', 'クオリティブック(PDF)', 'https://.../qualitybook.pdf'),
        f('video', '動画(mp4 / YouTube / Vimeo)', 'https://youtu.be/...'),
        f('docsList', '資料集(1行1件: タイトル|URL)', '重要事項説明書|https://...', true), f('makerList', 'メーカー資料(1行1件: タイトル|URL)', 'キッチン カタログ|https://...', true),
        f('staff', '担当者名(任意)', '例: 山田'),
        h('div', { class: 'row' },
          h('button', { class: 'btn pri', onclick: () => { const o = {}; Object.keys(s).forEach((k) => { const e = T.$('#st-' + k, p.body); if (e) o[k] = e.value.trim(); }); T.settings.save(o); T.toast('設定を保存しました'); } }, '保存'),
          h('button', { class: 'btn', onclick: () => { if (confirm('保存済みのシナリオ・レイアウト・設定をすべて削除しますか?')) { Object.keys(localStorage).filter((k) => k.startsWith('genteikun.tool.')).forEach((k) => localStorage.removeItem(k)); T.toast('初期化しました'); p.close(); } } }, 'データ初期化')),
        h('div', { class: 'set-foot' }, h('span', {}, '提供 株式会社エスコン'), h('img', { src: gUrl('/assets/img/common_escon.svg'), alt: 'ES CON', onerror: function () { this.style.display = 'none'; } }), h('span', {}, '限定くん'))));
      p.body.append(wrap);
    },
  };
  T.mods.ai = null;

  document.addEventListener('DOMContentLoaded', () => {
    drawHero();
    const dock = T.$('#dock');
    DOCK.forEach(([id, ic, label]) => dock.append(h('button', { class: 'dock-i', type: 'button', 'aria-label': label.replace('\n', ''), onclick: () => T.open(id) }, h('span', { html: T.icon(ic) }), h('span', {}, label.split('\n').map((t, i) => (i ? [h('br'), t] : t))))));
    dock.append(h('div', { class: 'dock-i sep' }));
    dock.append(h('button', { class: 'dock-i', 'aria-label': '設定', onclick: () => T.open('settings') }, h('span', { html: T.icon('gear') }), h('span', {}, '設定')));
    dock.append(h('button', { class: 'dock-i', 'aria-label': '全画面', onclick: T.toggleFull }, h('span', { html: T.icon('full') }), h('span', {}, '全画面')));
    T.$$('.dock-i > span:first-child').forEach((s) => { s.style.cssText = 'display:block;width:30px;height:30px'; });
    T.$('#menuBtn').addEventListener('click', launcher);
    T.$$('#timeSwitch button').forEach((b) => b.addEventListener('click', () => { heroTime = b.dataset.t; drawHero(); }));
    document.addEventListener('keydown', (e) => { if (!T.panels.length && (e.key === 'm' || e.key === 'M')) launcher(); });
    fetch(gApi('/property')).then((r) => (r.ok ? r.json() : Promise.reject())).then((p) => {
      if (p && p.name) T.prop.name = p.name;
      if (p && p.tagline) T.prop.tagline = p.tagline;
      T.$('#propName').setAttribute('aria-label', T.prop.name); const hl = T.$('#propName img'); if (hl) hl.alt = T.prop.name;
      T.$('#propTag').textContent = p && p.tagline ? p.tagline : '';
    }).catch(() => {});
  });
})();
