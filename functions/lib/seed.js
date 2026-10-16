'use strict';
// Seed data: identical to lib/db.js (seedVersion 2) minus settings (VAPID/admin live in Firestore settings/Secrets).
const crypto = require('crypto');
const DEMO_TOKEN = 'demo-token-gentei-0001';
const SEED_VERSION = 2;
const newToken = () => crypto.randomBytes(24).toString('hex');
const uid = (p) => p + crypto.randomBytes(5).toString('hex');

function seed() {
  const now = Date.now();
  const DAY = 86400000;
  let s = 20260601; // deterministic PRNG
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const iso = (t) => new Date(t).toISOString();

  const tags = [
    { id: 't001', name: '来場予約', color: '#c00000' },
    { id: 't002', name: '資金計画', color: '#0b3d91' },
    { id: 't003', name: '3LDK希望', color: '#2e7d32' },
    { id: 't004', name: 'VIP', color: '#b8860b' },
    { id: 't005', name: '2LDK希望', color: '#6a1b9a' },
  ];

  const A = '/assets/img/';
  const property = {
    id: 'p0061',
    name: 'グランレ・ジェイド葉山',
    tagline: '海と緑に抱かれる、葉山の邸宅。会員様だけの限定情報をお届けします。',
    heroImage: A + 'top_mv.jpg',
    heroImageSp: A + 'top_mv_sp.jpg',
    logo: A + 'common_logo.svg',
    clientName: '株式会社エスコン',
    clientLogo: A + 'common_escon.svg',
    gtmId: '',
  };

  const mk = (i, title, type, url, targetTags, order, thumb, active = true, extra = {}) => ({
    id: 'ct' + String(i).padStart(3, '0'), title, type, url,
    thumb, targetTags, active, order, updatedAt: iso(now - (30 - i) * DAY), ...extra,
  });
  const gallery = [
    { title: 'リビング・ダイニング', src: A + 'top_entry_merit_2.jpg' },
    { title: 'エクステリア', src: A + 'top_entry_merit_3.jpg' },
    { title: 'キッチン', src: A + 'top_entry_merit_6.jpg' },
    { title: 'エントランスラウンジ', src: A + 'top_design_1.png' },
    { title: 'デザインコンセプト', src: A + 'top_design_2.png' },
    { title: 'コンセプトビジュアル', src: A + 'top_concept.jpg' },
    { title: 'ロケーション', src: A + 'top_loca_1.jpg' },
  ];
  const contents = [
    mk(1, '物件概要・全体像', 'folder', '#folder-overview', [], 1, A + 'top_concept.jpg'),
    mk(2, 'CGギャラリー', 'gallery', 'cg:living,kitchen,balcony,entrance,bedroom', [], 2, A + 'top_entry_merit_2.jpg', true, { gallery }),
    mk(3, 'VR内覧(3LDK Aタイプ)', 'vr', 'https://example.com/vr/a-type', ['3LDK希望', 'VIP'], 3, A + 'top_entry_merit_6.jpg'),
    mk(4, 'VR内覧(2LDK Cタイプ)', 'vr', 'https://example.com/vr/c-type', ['2LDK希望'], 4, A + 'top_entry_merit_2.jpg'),
    mk(5, '価格表・間取り図(PDF)', 'pdf', 'https://example.com/files/price-list.pdf', ['資金計画', 'VIP'], 5, A + 'top_plan_1.png'),
    mk(6, '資金計画シミュレーション', 'link', 'https://example.com/simulation', ['資金計画'], 6, A + 'top_plan_1.png'),
    mk(7, '物件紹介ムービー', 'video', '/assets/video/top_sp.mp4', [], 7, A + 'top_mv_sp.jpg'),
    mk(8, '来場予約フォーム', 'link', 'https://example.com/reserve', ['来場予約'], 8, A + 'top_entry_merit_3.jpg'),
    mk(9, 'VIP限定 最上階プレミアムプラン', 'pdf', 'https://example.com/files/vip-premium.pdf', ['VIP'], 9, A + 'top_design_2.png'),
    mk(10, '周辺環境・葉山ライフガイド', 'video', '/assets/video/top_access.mp4', [], 10, A + 'top_access_3.jpg'),
    mk(11, '旧モデルルーム案内(終了)', 'link', 'https://example.com/old', [], 11, A + 'top_access_2.jpg', false),
  ];

  const names = [
    ['山田 太郎', 'yamada', ['来場予約', '3LDK希望'], '見込み', '佐藤', 'ios'],
    ['鈴木 花子', 'suzuki', ['資金計画', '2LDK希望'], '検討中', '田中', 'android'],
    ['高橋 健一', 'takahashi', ['VIP', '資金計画', '3LDK希望'], '商談中', '佐藤', 'ios'],
    ['伊藤 美咲', 'ito', ['来場予約'], '来場済', '田中', 'android'],
    ['渡辺 誠', 'watanabe', ['3LDK希望'], '新規', '', 'pc'],
    ['中村 由美', 'nakamura', ['資金計画'], '検討中', '佐藤', 'ios'],
    ['小林 大輔', 'kobayashi', ['VIP', '来場予約'], '商談中', '田中', 'ios'],
    ['加藤 さくら', 'kato', [], '新規', '', 'android'],
  ];
  const customers = [];
  names.forEach((n, i) => {
    const created = now - (170 - i * 18) * DAY;
    customers.push({
      id: 'c' + String(i + 1).padStart(3, '0'),
      name: n[0], email: `${n[1]}@example.com`, tags: n[2], status: n[3], assignee: n[4],
      memo: i === 2 ? 'ご夫婦でご検討。頭金多め、最上階に関心。' : '',
      token: i === 0 ? DEMO_TOKEN : newToken(),
      createdAt: iso(created), lastSeenAt: iso(created), pushSub: null,
      installed: i !== 4 && i !== 7, platform: n[5],
    });
  });

  // events
  const events = [];
  const ev = (c, type, target, t) => events.push({ id: uid('e'), customerId: c.id, type, target, at: iso(t) });
  const profiles = {
    c001: { n: 22, targets: ['CGギャラリー', 'VR内覧(3LDK Aタイプ)', '来場予約フォーム', '物件紹介ムービー'] },
    c002: { n: 14, targets: ['資金計画シミュレーション', '価格表・間取り図(PDF)', 'CGギャラリー'] },
    c003: { n: 30, targets: ['資金計画シミュレーション', '価格表・間取り図(PDF)', 'VIP限定 最上階プレミアムプラン', 'VR内覧(3LDK Aタイプ)'] },
    c004: { n: 9, targets: ['来場予約フォーム', 'CGギャラリー', '周辺環境・葉山ライフガイド'] },
    c005: { n: 3, targets: ['物件概要・全体像'] },
    c006: { n: 11, targets: ['資金計画シミュレーション', '価格表・間取り図(PDF)'] },
    c007: { n: 26, targets: ['VIP限定 最上階プレミアムプラン', 'VR内覧(3LDK Aタイプ)', '来場予約フォーム', 'CGギャラリー'] },
    c008: { n: 1, targets: [] },
  };
  customers.forEach((c) => {
    const p = profiles[c.id];
    const start = new Date(c.createdAt).getTime();
    ev(c, 'page', '/register.html', start);
    if (c.installed) ev(c, 'install', c.platform, start + 4 * 60000);
    let last = start;
    for (let k = 0; k < p.n; k++) {
      // sessions skew toward recent weeks for active customers
      const span = now - start;
      let t = start + span * (0.15 + 0.85 * Math.pow(rnd(), c.id === 'c005' || c.id === 'c008' ? 1.5 : 0.55));
      if (c.id === 'c004' && k > 5) t = start + span * 0.3 * rnd();
      ev(c, 'login', '/', t);
      ev(c, 'page', '/', t + 20000);
      if (p.targets.length) {
        const view = 1 + Math.floor(rnd() * 3);
        for (let v = 0; v < view; v++) {
          const tg = p.targets[Math.floor(rnd() * p.targets.length)];
          const type = /VR/.test(tg) ? 'vr' : 'content';
          ev(c, 'library', '限定情報', t + 40000 + v * 30000);
          ev(c, type, tg, t + 60000 + v * 45000);
        }
      }
      if (t > last) last = t;
      if (rnd() < 0.15) ev(c, 'push_open', 'push', t - 60000);
    }
    c.lastSeenAt = iso(last);
  });
  events.sort((a, b) => a.at.localeCompare(b.at));
  events.forEach((e, i) => { e.id = 'e' + String(i + 1).padStart(6, '0'); }); // deterministic ids => idempotent seeding

  const personalFiles = [
    { id: 'pf001', customerId: 'c001', title: '山田様ご提案プラン(3LDK Aタイプ)', kind: 'file', url: 'https://example.com/files/yamada-plan.pdf', createdAt: iso(now - 12 * DAY) },
    { id: 'pf002', customerId: 'c001', title: '住宅ローン試算メール', kind: 'mail', url: 'mailto:sales@example.com', createdAt: iso(now - 5 * DAY) },
    { id: 'pf003', customerId: 'c003', title: '高橋様 最上階ご提案資料', kind: 'link', url: 'https://example.com/files/takahashi-vip', createdAt: iso(now - 3 * DAY) },
  ];

  const pushes = [
    { id: 'ps001', title: '【会員限定】CGギャラリーを更新しました', body: 'リビング・バルコニーの新規CGを追加しました。', url: '/', targetTags: [], createdAt: iso(now - 60 * DAY), status: 'sent', sentCount: 5 },
    { id: 'ps002', title: '来場予約特典のご案内', body: '今月ご来場のお客様に限定特典をご用意しています。', url: '/', targetTags: ['来場予約'], createdAt: iso(now - 30 * DAY), status: 'sent', sentCount: 3 },
    { id: 'ps003', title: 'VIP様限定 最上階プラン公開', body: 'VIP会員様向けの最上階プレミアムプランを公開しました。', url: '/', targetTags: ['VIP'], createdAt: iso(now - 9 * DAY), status: 'sent', sentCount: 2 },
    { id: 'ps004', title: '資金計画セミナーのお知らせ', body: '来月、資金計画セミナーを開催します。(下書き)', url: '/', targetTags: ['資金計画'], createdAt: iso(now - 1 * DAY), status: 'draft', sentCount: 0 },
  ];

  const conversions = [
    { id: 'cv001', customerId: 'c001', kind: 'visit_reserve', at: iso(now - 20 * DAY), note: '週末来場予約' },
    { id: 'cv002', customerId: 'c004', kind: 'visit_reserve', at: iso(now - 45 * DAY), note: '来場済' },
    { id: 'cv003', customerId: 'c003', kind: 'document', at: iso(now - 14 * DAY), note: '資料請求(最上階)' },
    { id: 'cv004', customerId: 'c007', kind: 'visit_reserve', at: iso(now - 6 * DAY), note: '' },
    { id: 'cv005', customerId: 'c003', kind: 'contract_inquiry', at: iso(now - 2 * DAY), note: '契約条件のお問い合わせ' },
  ];

  return {
    meta: { seedVersion: SEED_VERSION },
    property, tags, contents, customers, personalFiles, pushes, events, conversions,
  };
}

module.exports = { seed, SEED_VERSION, DEMO_TOKEN, newToken, uid };
