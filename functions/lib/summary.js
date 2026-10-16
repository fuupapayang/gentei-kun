'use strict';
// AI顧客サマリー: ルールベース生成 (+ ANTHROPIC_API_KEY があれば Claude 分岐)

const LOAN_RE = /資金|ローン|シミュレーション|返済|loan|simulat|price|価格/i;
const VR_RE = /vr/i;
const VISIT_RE = /来場|予約|reserve|visit/i;
const SESSION_GAP = 30 * 60 * 1000;

function fmtDate(d) { return `${d.getMonth() + 1}月${d.getDate()}日`; }
function monthKey(d) { return `${d.getFullYear()}年${d.getMonth() + 1}月`; }

function resolveTarget(e, contents) {
  const c = contents.find((x) => x.id === e.target);
  return c ? c.title : e.target;
}

function computeStats(customer, events, contents, now = Date.now()) {
  const evs = events.slice().sort((a, b) => a.at.localeCompare(b.at));
  let sessions = 0; let lastT = 0;
  for (const e of evs) {
    const t = new Date(e.at).getTime();
    if (e.type === 'login' || t - lastT > SESSION_GAP) sessions++;
    lastT = t;
  }
  const withTitle = evs.map((e) => ({ ...e, title: resolveTarget(e, contents), t: new Date(e.at).getTime() }));
  const contentViews = withTitle.filter((e) => e.type === 'content' || e.type === 'vr');
  const vr = withTitle.filter((e) => e.type === 'vr' || (e.type === 'content' && VR_RE.test(e.title)));
  const library = withTitle.filter((e) => e.type === 'library');
  const loan = withTitle.filter((e) => ['content', 'vr', 'page'].includes(e.type) && LOAN_RE.test(e.title));
  const visit = withTitle.filter((e) => ['content', 'page'].includes(e.type) && VISIT_RE.test(e.title));
  const pushOpen = withTitle.filter((e) => e.type === 'push_open');
  const counts = {};
  contentViews.forEach((e) => { counts[e.title] = (counts[e.title] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const last = withTitle.length ? withTitle[withTitle.length - 1].t : null;
  const first = withTitle.length ? withTitle[0].t : null;
  const days7 = withTitle.filter((e) => now - e.t <= 7 * 86400000);
  const days30 = withTitle.filter((e) => now - e.t <= 30 * 86400000);
  const prev30 = withTitle.filter((e) => now - e.t > 30 * 86400000 && now - e.t <= 60 * 86400000);
  return { evs: withTitle, sessions, contentViews, vr, library, loan, visit, pushOpen, top, last, first, days7, days30, prev30, now };
}

function ruleSummary(customer, events, contents, conversions = [], now = Date.now()) {
  const s = computeStats(customer, events, contents, now);
  const name = `${customer.name}様`;
  const total = s.evs.length;
  const out = { stats: { events: total, sessions: s.sessions } };

  if (!total) {
    out.overview = { headline: '行動ログがまだありません', body: `${name}は登録済みですが、アプリ利用の記録がありません。まずはホーム画面への追加と通知許可をご案内しましょう。` };
    out.timeline = [];
    out.interests = { headline: '興味関心はまだ判断できません', points: ['閲覧データが蓄積されるまでお待ちください。'] };
    out.hints = { headline: '初回接点づくりを優先', points: ['登録御礼とあわせてCGギャラリーなど見やすいコンテンツを案内する。', 'ホーム画面追加の手順を再送する。'] };
    return out;
  }

  const daysSince = s.last ? Math.floor((now - s.last) / 86400000) : null;
  const spanDays = Math.max(1, Math.floor((s.last - s.first) / 86400000));
  let level; let levelWord;
  const recentRate = s.days7.length;
  if (daysSince <= 3 && s.sessions >= 8) { level = '高'; levelWord = '非常に積極的な閲覧傾向'; }
  else if (daysSince <= 14 && s.sessions >= 4) { level = '中'; levelWord = '継続的な閲覧傾向'; }
  else if (daysSince > 30) { level = '低'; levelWord = '関心が薄れつつある傾向'; }
  else { level = '中〜低'; levelWord = '様子見の閲覧傾向'; }

  const recency = daysSince === 0 ? '本日' : daysSince === 1 ? '昨日' : `${daysSince}日前`;
  out.overview = {
    headline: `検討度「${level}」: ${levelWord}`,
    body: `${name}は${customer.installed ? 'アプリをホーム画面に追加済みで、' : ''}これまでに累計${s.sessions}回のセッション・${total}件の行動が記録されています。` +
      `限定情報ライブラリの閲覧は${s.library.length}回、コンテンツ閲覧${s.contentViews.length}件(うちVR${s.vr.length}件)。最終アクセスは${recency}(${fmtDate(new Date(s.last))})です。` +
      (s.pushOpen.length ? `Push通知からの起動も${s.pushOpen.length}回あり、情報配信への反応は良好です。` : '')
      + (customer.status ? `現在のステータスは「${customer.status}」です。` : ''),
  };

  // timeline by month
  const byMonth = new Map();
  for (const e of s.evs) {
    const k = monthKey(new Date(e.t));
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(e);
  }
  out.timeline = [];
  let prevCount = null;
  for (const [period, list] of byMonth) {
    const ss = list.filter((e) => e.type === 'login').length;
    const cv = list.filter((e) => e.type === 'content' || e.type === 'vr');
    const tc = {};
    cv.forEach((e) => { tc[e.title] = (tc[e.title] || 0) + 1; });
    const tt = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
    const hasInstall = list.some((e) => e.type === 'install');
    let action = `ログイン${ss}回・コンテンツ閲覧${cv.length}件`;
    if (hasInstall) action = '会員登録・ホーム画面に追加。' + action;
    if (tt.length) action += `(主に「${tt.join('」「')}」)`;
    let feature;
    if (list.length <= 3) feature = '利用は限定的。接点が薄い月。';
    else if (prevCount !== null && list.length > prevCount * 1.5) feature = '前月より行動量が大きく増加。関心が高まった時期。';
    else if (prevCount !== null && list.length < prevCount * 0.5) feature = '前月より行動量が減少。熱量が落ち着いた時期。';
    else if (cv.some((e) => VR_RE.test(e.title))) feature = 'VR内覧など体験型コンテンツに関心。';
    else if (cv.some((e) => LOAN_RE.test(e.title))) feature = '資金面の情報収集が中心。';
    else feature = '安定した閲覧ペース。';
    prevCount = list.length;
    out.timeline.push({ period, action, feature });
  }
  if (out.timeline.length > 8) out.timeline = out.timeline.slice(-8);

  // interests
  const pts = [];
  if (s.top.length) pts.push(`最も閲覧が多いのは「${s.top[0][0]}」(${s.top[0][1]}回)${s.top[1] ? `、次いで「${s.top[1][0]}」(${s.top[1][1]}回)` : ''}。`);
  if (s.loan.length) pts.push(`資金計画・価格関連の閲覧が${s.loan.length}件あり、予算や返済イメージを具体的に検討している様子。`);
  if (s.vr.length) pts.push(`VR内覧を${s.vr.length}回利用。間取りや空間の広がりを重視している可能性が高い。`);
  if (s.visit.length) pts.push(`来場予約に関する導線を${s.visit.length}回確認しており、現地確認への意欲がある。`);
  if (customer.tags && customer.tags.length) pts.push(`登録タグ: ${customer.tags.join('、')}。`);
  const cvs = conversions.filter((c) => c.customerId === customer.id);
  if (cvs.length) {
    const label = { visit_reserve: '来場予約', document: '資料請求', contract_inquiry: '契約相談' };
    pts.push(`成果実績: ${cvs.map((c) => `${label[c.kind] || c.kind}(${fmtDate(new Date(c.at))})`).join('、')}。`);
  }
  if (!pts.length) pts.push('特定のコンテンツへの偏りは見られません。');
  const head = s.loan.length >= Math.max(2, s.vr.length) ? '資金計画・価格への関心が強い' :
    s.vr.length >= 2 ? '空間体験(VR・CG)への関心が強い' : s.top.length ? `「${s.top[0][0]}」に注目` : '関心領域は形成途上';
  out.interests = { headline: head, points: pts };

  // hints
  const h = [];
  if (daysSince > 30) h.push(`最終アクセスから${daysSince}日経過。新着コンテンツ更新のPush配信で再接触を。`);
  else if (daysSince <= 3) h.push('直近で活発に閲覧中。今が連絡の好機なので、早めの架電またはメッセージを。');
  if (s.loan.length) h.push('資金計画の閲覧が多いため、具体的な返済シミュレーションや住宅ローン相談の場を提案する。');
  if (s.vr.length) h.push('VRで見た間取りをもとに、実際のモデルルームでの体感を勧めると来場動機になりやすい。');
  if (!cvs.some((c) => c.kind === 'visit_reserve') && (s.visit.length || s.sessions >= 5)) h.push('来場予約が未取得。具体的な日程候補を2〜3提示してクロージングへ。');
  if (!customer.installed) h.push('ホーム画面未追加。インストール手順の再案内でPush到達率を高める。');
  else if (!customer.pushSub && !s.pushOpen.length) h.push('通知許可が未取得の可能性。アプリ内で通知ONをご案内する。');
  if (!customer.assignee) h.push('担当者が未設定。早めに担当を割り当てる。');
  if (!h.length) h.push('現状の関心領域に沿った情報を継続配信し、反応を見て次の提案を行う。');
  out.hints = { headline: level === '高' ? '今が提案のタイミング' : level === '低' ? '再活性化が課題' : '関心に合わせた情報提供を', points: h };
  return out;
}

async function claudeSummary(customer, events, contents, conversions, base) {
  const key = process.env.ANTHROPIC_API_KEY;
  const compact = events.slice(-200).map((e) => `${e.at.slice(0, 16)} ${e.type} ${resolveTarget(e, contents)}`).join('\n');
  const prompt = `あなたは不動産営業支援AIです。以下の顧客の行動ログから、営業担当者向けの顧客サマリーを日本語で作成してください。\n` +
    `顧客: ${customer.name} / タグ: ${(customer.tags || []).join(',')} / ステータス: ${customer.status}\n行動ログ:\n${compact}\n\n` +
    `次のJSONのみを出力してください(説明文やコードフェンス不要):\n` +
    `{"overview":{"headline":"","body":""},"timeline":[{"period":"","action":"","feature":""}],"interests":{"headline":"","points":[""]},"hints":{"headline":"","points":[""]}}`;
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const text = (j.content || []).map((c) => c.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    const o = JSON.parse(m[0]);
    if (!o.overview || !o.timeline || !o.interests || !o.hints) throw new Error('bad shape');
    return { overview: o.overview, timeline: o.timeline, interests: o.interests, hints: o.hints, stats: base.stats };
  } finally { clearTimeout(to); }
}

async function generateSummary(customer, events, contents, conversions) {
  const base = ruleSummary(customer, events, contents, conversions);
  if (process.env.ANTHROPIC_API_KEY && events.length) {
    try { return await claudeSummary(customer, events, contents, conversions, base); }
    catch (e) { console.warn('[summary] Claude fallback to rules:', e.message); }
  }
  return base;
}

module.exports = { generateSummary, ruleSummary };
