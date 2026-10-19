(() => {
'use strict';
const $app = document.getElementById('app');
const TK = 'aplika.admin.token';
const FB = (window.GENTEI_CONFIG || {}).apiBase === 'firebase'; /* Firebase mode: email+password login, push "send" = queue */
const state = { property: null, tags: [], toolOpen: false, menuOpen: false };

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getToken = () => { try { return sessionStorage.getItem(TK) || ''; } catch { return ''; } };
const setToken = t => { try { t ? sessionStorage.setItem(TK, t) : sessionStorage.removeItem(TK); } catch {} };
async function api(path, opts = {}) {
  const o = { method: opts.method || 'GET', headers: { 'x-admin-token': getToken() } };
  if (opts.body !== undefined) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
  let r;
  try { r = await fetch(gApi('/admin' + path), o); } catch (e) { throw new Error('サーバーに接続できません'); }
  if (r.status === 401 && !opts.noAuth) { setToken(''); renderLogin(); throw new Error('ログインが必要です'); }
  let data = null; try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error((data && (data.error || data.message)) || ('エラー ' + r.status));
  return data;
}
function toast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600);
}
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { if (e.message !== 'ログインが必要です') toast(e.message, true); } };
function relTime(iso) {
  if (!iso) return { text: '未アクセス', recent: false };
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  let text;
  if (d < 60) text = 'たった今';
  else if (d < 3600) text = Math.floor(d / 60) + '分前';
  else if (d < 86400) text = Math.floor(d / 3600) + '時間前';
  else if (d < 86400 * 30) text = Math.floor(d / 86400) + '日前';
  else text = Math.floor(d / 86400 / 30) + 'ヶ月前';
  return { text, recent: d < 86400 };
}
const fmt = iso => { if (!iso) return '-'; const d = new Date(iso); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const tagMap = () => Object.fromEntries(state.tags.map(t => [t.name, t]));
const tagHtml = names => (names || []).map(n => `<span class="tag" style="--c:${esc((tagMap()[n] || {}).color || '#777')}">${esc(n)}</span>`).join('') || '<span class="note">なし</span>';
const propNo = () => { const p = state.property || {}; return (String(p.id || '').replace(/^p/, '') || '') ; };
const propTitle = () => { const p = state.property; return p ? `${propNo()}.${p.name}` : ''; };
const EVT = { login: 'ログイン', page: 'ページ閲覧', content: 'コンテンツ閲覧', push_open: '通知を開封', install: 'ホーム画面に追加', vr: 'VR体験', library: 'ライブラリ閲覧' };
const CV = { visit_reserve: '来場予約', document: '資料請求', contract_inquiry: '契約問い合わせ' };

function chipPicker(container, selected, onChange) {
  const render = () => {
    container.innerHTML = state.tags.map(t => `<span class="chip ${selected.includes(t.name) ? 'on' : ''}" data-n="${esc(t.name)}" style="--c:${esc(t.color)}">${esc(t.name)}</span>`).join('') || '<span class="note">タグがありません(タグ管理で作成)</span>';
  };
  container.onclick = e => {
    const c = e.target.closest('.chip'); if (!c) return;
    const n = c.dataset.n, i = selected.indexOf(n);
    i >= 0 ? selected.splice(i, 1) : selected.push(n);
    render(); onChange && onChange(selected);
  };
  render();
}
function modal({ title, body, footer, onMount }) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal"><header><span>${esc(title)}</span><button type="button" data-x>×</button></header><div class="mb">${body}</div><footer>${footer || ''}</footer></div>`;
  const close = () => bg.remove();
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  bg.querySelector('[data-x]').onclick = close;
  document.body.appendChild(bg);
  onMount && onMount(bg, close);
  return { el: bg, close };
}
const confirmBox = (msg) => new Promise(res => {
  const m = modal({ title: '確認', body: `<p>${esc(msg)}</p>`, footer: '<button class="btn" data-n>キャンセル</button><button class="btn red" data-y>OK</button>',
    onMount: (el, close) => { el.querySelector('[data-n]').onclick = () => { close(); res(false); }; el.querySelector('[data-y]').onclick = () => { close(); res(true); }; } });
});

/* ---------- login ---------- */
function renderLogin() {
  $app.innerHTML = `<div class="login-wrap"><form class="login" id="lf">
    <img class="login-logo" src="${gUrl('/assets/img/common_escon.svg')}" alt="ES CON エスコン" onerror="this.style.display='none'">
    <h1><span class="brand-logo lg" role="img" aria-label="IKIIKI"></span>限定くん マネージャー</h1><p>限定くん 管理コンソール</p>
 ${FB ? '<label class="f">メールアドレス<input type="email" id="em" autofocus autocomplete="username"></label>' : ''}
    <label class="f">パスワード<input type="password" id="pw" ${FB ? '' : 'autofocus'} autocomplete="current-password"></label>
    <button class="btn blue" style="width:100%;justify-content:center;padding:11px">ログイン</button>
    <p id="le" style="color:var(--red);margin:12px 0 0"></p></form></div>`;
  document.getElementById('lf').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await api('/login', { method: 'POST', body: FB ? { email: document.getElementById('em').value, password: document.getElementById('pw').value } : { password: document.getElementById('pw').value }, noAuth: true });
      setToken(r.token); boot();
    } catch (err) { document.getElementById('le').textContent = err.message.startsWith('エラー') ? (FB ? 'ログインできません' : 'パスワードが違います') : err.message; }
  };
}

/* ---------- shell ---------- */
const MENU = [
  ['dashboard', '📊', 'ダッシュボード'],
  ['pushes', '📣', 'セルフ配信一覧'],
  ['customers', '👥', '顧客管理'],
  ['library', '📚', 'ライブラリ管理'],
  ['tags', '🏷️', 'タグ管理'],
  ['conversions', '🎯', 'コンバージョン管理'],
];
async function boot() {
  if (!getToken()) return renderLogin();
  try {
    const [p, t] = await Promise.all([api('/property'), api('/tags')]);
    state.property = p; state.tags = t;
  } catch (e) { if (getToken()) toast(e.message, true); return; }
  renderShell(); route();
}
function renderShell() {
  const toolUrl = location.origin + gUrl('/tool/');
  $app.innerHTML = `
  <div class="topbar">
    <button class="menu-toggle" id="mt">☰</button>
    <div class="brand"><span class="brand-logo" role="img" aria-label="IKIIKI"></span>限定くん<span>マネージャー</span></div>
    <img class="topbar-logo" src="${gUrl('/assets/img/common_escon.svg')}" alt="ES CON" onerror="this.style.display='none'">
    <div class="prop" title="${esc(propTitle())}">🏢 ${esc(propTitle())}</div>
    <button class="logout" id="lo">ログアウト</button>
  </div>
  <div class="shell">
    <nav class="side" id="side">${MENU.map(([k, i, l]) => `<a href="#/${k}" data-k="${k}"><span class="ic">${i}</span>${l}</a>`).join('')}</nav>
    <main class="main">
      <div class="toolbar-bar">
        <button class="open" id="tb">🛠 接客ツール管理を開く ${state.toolOpen ? '▲' : '▼'}</button>
        <div class="body" id="tbody" ${state.toolOpen ? '' : 'hidden'}>
          <input type="text" readonly id="turl" value="${esc(toolUrl)}">
          <button class="btn" id="tcopy">URLをコピー</button>
          <a class="btn blue" href="${gUrl('/tool/')}" target="_blank" rel="noopener">接客ツールを開く ↗</a>
          <button class="btn" id="tsc">ショートカット作成</button>
        </div>
      </div>
      <div id="view"></div>
    </main>
  </div>`;
  document.getElementById('lo').onclick = () => { if (FB && window.GenteiFirebaseApi) window.GenteiFirebaseApi.signOutAdmin(); setToken(''); renderLogin(); };
  document.getElementById('mt').onclick = () => document.getElementById('side').classList.toggle('open');
  document.getElementById('side').onclick = () => document.getElementById('side').classList.remove('open');
  document.getElementById('tb').onclick = () => { state.toolOpen = !state.toolOpen; document.getElementById('tbody').hidden = !state.toolOpen; document.getElementById('tb').textContent = `🛠 接客ツール管理を開く ${state.toolOpen ? '▲' : '▼'}`; };
  document.getElementById('tcopy').onclick = async () => {
    const i = document.getElementById('turl');
    try { await navigator.clipboard.writeText(i.value); } catch { i.select(); document.execCommand('copy'); }
    toast('URLをコピーしました');
  };
  document.getElementById('tsc').onclick = () => {
    const blob = new Blob([`[InternetShortcut]\r\nURL=${toolUrl}\r\n`], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '接客ツール.url'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('ショートカットを作成しました');
  };
}

/* ---------- router ---------- */
const routes = { dashboard: vDashboard, pushes: vPushes, customers: vCustomers, library: vLibrary, tags: vTags, conversions: vConversions };
async function route() {
  if (!getToken()) return renderLogin();
  if (!document.getElementById('view')) return;
  const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
  let key = parts[0];
  if (!routes[key]) key = 'dashboard';
  document.querySelectorAll('#side a').forEach(a => a.classList.toggle('on', a.dataset.k === key));
  const v = document.getElementById('view');
  v.innerHTML = '<div class="empty">読み込み中…</div>';
  try {
    if (key === 'customers' && parts[1]) await vCustomerDetail(v, parts[1]);
    else await routes[key](v);
  } catch (e) { if (e.message !== 'ログインが必要です') v.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', route);

/* ---------- dashboard ---------- */
async function vDashboard(v) {
  const [d, ev] = await Promise.all([api('/dashboard'), api('/customers').then(async cs => {
    const lists = await Promise.all(cs.slice(0, 50).map(c => api(`/customers/${c.id}/events`).catch(() => [])));
    return lists.flat();
  }).catch(() => [])]);
  const k = [['登録顧客数', d.customers], ['ホーム画面追加済み', d.installed], ['配信済みPush', d.pushesSent], ['直近7日のイベント', d.events7d], ['コンバージョン', d.conversions]];
  // chart: events by day for last 7 days (client-side from per-customer events)
  const days = []; for (let i = 6; i >= 0; i--) { const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - i); days.push(t); }
  const counts = days.map(day => ev.filter(e => { const t = new Date(e.at); return t >= day && t < new Date(day.getTime() + 864e5); }).length);
  const byType = {}; ev.forEach(e => byType[e.type] = (byType[e.type] || 0) + 1);
  v.innerHTML = `<h2 class="title">ダッシュボード</h2>
    <div class="kpis">${k.map(([l, n]) => `<div class="kpi"><div class="n">${esc(n)}</div><div class="l">${l}</div></div>`).join('')}</div>
    <div class="grid2"><div class="card"><h3>日別イベント数(直近7日)</h3>${barSvg(days.map(x => `${x.getMonth() + 1}/${x.getDate()}`), counts, '#0b3d91')}</div>
    <div class="card"><h3>イベント種別(全期間)</h3>${barSvg(Object.keys(byType).map(t => EVT[t] || t), Object.values(byType), '#c00000')}</div></div>`;
}
function barSvg(labels, vals, color) {
  if (!labels.length) return '<div class="empty">データがありません</div>';
  const W = 440, H = 200, pad = 28, max = Math.max(1, ...vals), bw = (W - pad * 2) / labels.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="棒グラフ"><line x1="${pad}" y1="${H - 28}" x2="${W - pad}" y2="${H - 28}" stroke="#ccd2de"/>`;
  vals.forEach((n, i) => {
    const h = (H - 28 - 24) * n / max, x = pad + i * bw + bw * .2, y = H - 28 - h;
    s += `<rect x="${x}" y="${y}" width="${bw * .6}" height="${h}" rx="3" fill="${color}"/><text x="${x + bw * .3}" y="${y - 5}" text-anchor="middle" font-size="11" fill="#333">${n}</text><text x="${x + bw * .3}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#666">${esc(labels[i])}</text>`;
  });
  return s + '</svg>';
}

/* ---------- pushes ---------- */
async function vPushes(v) {
  const list = await api('/pushes');
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  v.innerHTML = `<h2 class="title">セルフ配信一覧 <span class="sp"></span>${FB && list.some(p => p.status === 'queued') ? '<button class="btn red" id="runq">⚡ 送信待ちを今すぐ配信</button> ' : ''}<button class="btn green" id="new">＋ 新規作成</button></h2>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>タイトル</th><th>詳細通知</th><th>通知</th><th>対象</th><th>操作</th></tr></thead><tbody>
  ${list.map(p => `<tr><td><b>${esc(p.title)}</b><div class="note">${esc((p.body || '').slice(0, 50))}</div></td>
    <td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" title="${esc(p.url)}">🔗</a>` : '-'}</td>
    <td>${p.status === 'sent' ? `<span class="badge yes">あり</span> <span class="note">${p.sentCount ?? 0}件</span>` : p.status === 'queued' ? '<span class="badge no">送信待ち</span>' : p.status === 'scheduled' ? `<span class="badge blue">予約 ${esc(fmtSched(p.scheduledAt))}</span>` : '<span class="badge no">なし</span>'}</td>
    <td>${(p.targetTags || []).length ? tagHtml(p.targetTags) : '<span class="note">全員</span>'}</td>
    <td><button class="ibtn" data-e="${esc(p.id)}" title="編集">✏️</button><button class="ibtn" data-d="${esc(p.id)}" title="削除">🗑️</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">配信がありません</td></tr>'}
  </tbody></table></div>`;
  if (FB) { const t = document.createElement('div'); t.className = 'note'; t.style.margin = '-4px 0 10px'; v.querySelector('h2').after(t); ghTokenStatus(t); }
  v.querySelector('#new').onclick = () => pushModal(null);
  const rq = v.querySelector('#runq');
  if (rq) rq.onclick = guard(async () => { await dispatchSender(); toast('配信を開始しました(約30秒)'); setTimeout(route, 30000); });
  v.onclick = guard(async e => {
    const eb = e.target.closest('[data-e]'), db = e.target.closest('[data-d]');
    if (eb) pushModal(list.find(p => p.id === eb.dataset.e));
    if (db && await confirmBox('この配信を削除しますか?')) { await api('/pushes/' + db.dataset.d, { method: 'DELETE' }); toast('削除しました'); route(); }
  });
}
/* ---------- instant push (free plan): queue in Firestore + start the GitHub Actions sender right away ---------- */
const GH_TOKEN_KEY = 'gentei.ghToken';
const askToken = (repo) => new Promise(res => {
  let done = false; const fin = (v, close) => { if (done) return; done = true; close(); res(v); };
  modal({ title: 'GitHubトークンの入力(初回のみ)',
    body: `<p style="line-height:1.7;font-size:13px">「今すぐ送信」でGitHubの送信ジョブを起動するために、アクセストークンが必要です。<b>この端末のブラウザにだけ</b>保存されます。<br>作り方: GitHub &gt; Settings &gt; Developer settings &gt; Fine-grained tokens<br>・Repository: <b>${esc(repo)}</b> のみ<br>・Permissions: <b>Actions = Read and write</b></p><label class="f">トークン<input type="password" id="ght" autocomplete="off" placeholder="github_pat_..."></label>`,
    footer: '<button class="btn" data-n>キャンセル</button><button class="btn red" data-y>保存して送信</button>',
    onMount: (el, close) => { el.querySelector('[data-n]').onclick = () => fin('', close); el.querySelector('[data-y]').onclick = () => fin(el.querySelector('#ght').value.trim(), close); el.querySelector('#ght').focus(); } });
});
async function dispatchSender(workflow, inputs) {
  // config.js may be stale in the browser cache: fall back to <owner>.github.io/<repo>/ from the URL
  const m = location.hostname.match(/^([^.]+)\.github\.io$/), seg = location.pathname.split('/')[1];
  const g = (self.GENTEI_CONFIG || {}).github || (m && seg ? { repo: m[1] + '/' + seg, workflow: 'send-push.yml', ref: 'main' } : null);
  if (!g || !g.repo) throw new Error('GitHub連携の設定がありません');
  let tk = ''; try { tk = localStorage.getItem(GH_TOKEN_KEY) || ''; } catch (e) {}
  if (!tk) {
    tk = await askToken(g.repo);
    if (!tk) throw new Error('トークンが未入力のため、5分ごとの自動送信を待ちます');
  }
  const r = await fetch(`https://api.github.com/repos/${g.repo}/actions/workflows/${workflow || g.workflow || 'send-push.yml'}/dispatches`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + tk, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify(inputs ? { ref: g.ref || 'main', inputs } : { ref: g.ref || 'main' }) });
  if (r.status === 401) { try { localStorage.removeItem(GH_TOKEN_KEY); } catch (e) {} throw new Error('GitHubトークンの期限が切れたか、無効です。もう一度入力してください(期限は長め、または無期限にして作成)'); }
  if (r.status === 403 || r.status === 404) throw new Error('GitHubトークンの権限が足りません(Repository=' + g.repo + '、Actions=Read and write)。トークンの設定を確認してください (' + r.status + ')');
  if (!r.ok) throw new Error('GitHubの起動に失敗しました(' + r.status + ')');
  try { localStorage.setItem(GH_TOKEN_KEY, tk); } catch (e) {}
}
/* shows whether this browser has a working GitHub token, and when it expires */
async function ghTokenStatus(el) {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/), seg = location.pathname.split('/')[1];
  const g = (self.GENTEI_CONFIG || {}).github || (m && seg ? { repo: m[1] + '/' + seg } : null); if (!g || !el) return;
  let tk = ''; try { tk = localStorage.getItem(GH_TOKEN_KEY) || ''; } catch (e) {}
  if (!tk) { el.innerHTML = '🔑 GitHubトークン: <b style="color:var(--red)">未保存</b>(このブラウザでは未入力です。今すぐ送信・予約送信の初回に入力します)'; return; }
  try {
    const r = await fetch(`https://api.github.com/repos/${g.repo}`, { headers: { Authorization: 'Bearer ' + tk, Accept: 'application/vnd.github+json' } });
    if (r.status === 401) { try { localStorage.removeItem(GH_TOKEN_KEY); } catch (e) {} el.innerHTML = '🔑 GitHubトークン: <b style="color:var(--red)">期限切れ・無効</b>(次の送信時に再入力してください)'; return; }
    const ex = r.headers.get('github-authentication-token-expiration');
    el.innerHTML = '🔑 GitHubトークン: <b style="color:var(--green)">保存済み</b>' + (ex ? `(期限: ${esc(ex.replace(/ UTC$/, ''))})` : '');
  } catch (e) { el.innerHTML = '🔑 GitHubトークン: 保存済み(状態の確認はできませんでした)'; }
}

async function waitSent(id, onTick) {
  for (let i = 0; i < 24; i++) {
    await new Promise(res => setTimeout(res, 5000));
    const l = await api('/pushes'); const q = l.find(x => x.id === id);
    if (q && q.status === 'sent') return q;
    onTick && onTick(i);
  }
  return null;
}

const pad2 = n => String(n).padStart(2, '0');
const fmtSched = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const toLocalInput = iso => { const d = new Date(iso); return iso && !isNaN(d) ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}` : ''; };
function pushModal(p) {
  const sel = [...(p?.targetTags || [])];
  const sent = p?.status === 'sent';
  modal({ title: p ? 'セルフ配信の編集' : 'セルフ配信の新規作成',
    body: `<label class="f">タイトル<input type="text" id="pt" value="${esc(p?.title)}"></label>
    <label class="f">本文<textarea id="pb">${esc(p?.body)}</textarea></label>
    <label class="f">詳細通知URL <small>(タップ時に開くリンク)</small><input type="url" id="pu" placeholder="https://" value="${esc(p?.url)}"></label>
    <div class="f" style="font-weight:600;font-size:13px">対象タグ <small style="font-weight:400;color:var(--mut)">(未選択=全員)</small><div class="chips" id="pc"></div></div>
    ${FB ? `<label class="f">送信予約日時 <small>(空欄=予約しない。指定した時刻以降の次回の定期実行で配信)</small><input type="datetime-local" id="ps" value="${esc(toLocalInput(p?.status === 'scheduled' ? p.scheduledAt : ''))}"></label>` : ''}
    <div class="pushprev"><img src="${gUrl('/assets/img/top_concept.jpg')}" alt=""><div><small>限定くん ・ いま</small><b id="ppt">${esc(p?.title) || 'タイトル'}</b><span id="ppb">${esc((p?.body || '').slice(0, 60)) || '本文がここに表示されます'}</span></div></div>
    ${sent ? `<p class="note">送信済み: ${p.sentCount ?? 0}件に配信</p>` : ''}<p id="pr" style="font-weight:700;color:var(--green)"></p>`,
    footer: `<button class="btn" data-s>下書き保存</button>${FB ? '<button class="btn blue" data-r>予約送信</button>' : ''}<button class="btn red" data-n>今すぐ送信</button>`,
    onMount: (el, close) => {
      chipPicker(el.querySelector('#pc'), sel);
      const upd = () => { el.querySelector('#ppt').textContent = el.querySelector('#pt').value || 'タイトル'; el.querySelector('#ppb').textContent = el.querySelector('#pb').value.slice(0, 60) || '本文がここに表示されます'; };
      el.querySelector('#pt').oninput = upd; el.querySelector('#pb').oninput = upd;
      const val = () => ({ title: el.querySelector('#pt').value.trim(), body: el.querySelector('#pb').value, url: el.querySelector('#pu').value.trim(), targetTags: sel, ...(FB && p && !el.querySelector('#ps').value ? { scheduledAt: '' } : {}) });
      const save = async () => {
        const b = val(); if (!b.title) throw new Error('タイトルを入力してください');
        return p ? api('/pushes/' + p.id, { method: 'PUT', body: b }) : api('/pushes', { method: 'POST', body: b });
      };
      if (el.querySelector('footer [data-r]')) el.querySelector('footer [data-r]').onclick = guard(async () => {
        const v = el.querySelector('#ps').value; if (!v) throw new Error('送信予約日時を入力してください');
        const when = new Date(v); if (isNaN(when) || when.getTime() < Date.now() + 60000) throw new Error('予約日時は、現在より後の時刻を指定してください');
        const saved = await save(); const r = await api(`/pushes/${saved.id || p.id}/schedule`, { method: 'POST', body: { scheduledAt: when.toISOString() } });
        // GitHub cron is unreliable on quiet repos: start a run that waits until the due time (needs the token, same as "今すぐ送信")
        let precise = true; try { await dispatchSender('send-scheduled.yml', { run_at: r.scheduledAt }); } catch (e) { precise = false; toast('時刻ぴったりの配信を起動できませんでした(' + (e.message || e) + ')。定期実行での配信になり、遅れる場合があります', true); await new Promise(res => setTimeout(res, 2500)); }
        toast(`予約しました(${fmtSched(r.scheduledAt)})${precise ? '' : ' ※遅れる場合あり'}`); close(); route();
      });
      el.querySelector('footer [data-s]').onclick = guard(async () => { await save(); toast('下書きを保存しました'); close(); route(); });
      el.querySelector('footer [data-n]').onclick = guard(async () => {
        if (!await confirmBox('この内容で今すぐ送信しますか?')) return;
        const saved = await save(); const r = await api(`/pushes/${saved.id || p.id}/send`, { method: 'POST' });
        const pr = el.querySelector('#pr');
        if (!r.queued) { pr.textContent = `送信完了: ${r.sentCount ?? 0}件に配信しました`; toast(`送信完了(${r.sentCount ?? 0}件)`); setTimeout(() => { close(); route(); }, 1600); return; }
        const id = saved.id || p.id;
        try {
          pr.textContent = '送信を開始しています…'; await dispatchSender();
          pr.textContent = '配信中です(約30秒)…';
          const done = await waitSent(id, i => { pr.textContent = '配信中です…(' + (i + 1) * 5 + '秒)'; });
          pr.textContent = done ? `送信完了: ${done.sentCount ?? 0}件に配信しました` : '送信を開始しました。完了まで少しかかります(一覧で確認してください)';
          toast(done ? `送信完了(${done.sentCount ?? 0}件)` : '送信を開始しました');
        } catch (e) { pr.style.color = 'var(--red)'; pr.textContent = '送信を予約しました(' + (e.message || e) + ')'; toast('予約しました(最大5分以内に配信)', true); route(); return; }
        setTimeout(() => { close(); route(); }, 1600);
      });
    } });
}

/* ---------- customers ---------- */
async function vCustomers(v) {
  const list = await api('/customers');
  list.sort((a, b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''));
  let q = '';
  const draw = () => {
    const ls = list.filter(c => !q || (c.name + c.email + (c.assignee || '') + (c.tags || []).join()).toLowerCase().includes(q));
    v.querySelector('tbody').innerHTML = ls.map(c => { const r = relTime(c.lastSeenAt);
      return `<tr><td><b>${esc(c.name)}</b> 様<div class="note">${esc(c.email)}</div><div class="note">${c.installed ? '📱 追加済み' : '未追加'} ${esc({ ios: 'iOS', android: 'Android', pc: 'PC' }[c.platform] || '')}</div></td>
      <td><span class="badge ${r.recent ? 'red' : 'gray'}">${r.text}</span></td>
      <td>${esc(c.assignee) || '<span class="note">未設定</span>'}</td>
      <td>${c.status ? `<span class="badge blue">${esc(c.status)}</span> ` : ''}${tagHtml(c.tags)}</td>
      <td><a class="btn sm blue" href="#/customers/${esc(c.id)}">詳しく見る</a> <button class="ibtn" data-cd="${esc(c.id)}" title="削除">🗑️</button></td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">該当する顧客がいません</td></tr>';
  };
  v.innerHTML = `<h2 class="title">顧客管理 <span class="sp"></span><input type="text" id="q" placeholder="名前・メール・担当者で検索" style="width:260px;margin:0"></h2>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>お客様</th><th>最終アクセス</th><th>担当者</th><th>ステータス / タグ</th><th></th></tr></thead><tbody></tbody></table></div>`;
  v.querySelector('#q').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  v.querySelector('tbody').onclick = guard(async e => {
    const b = e.target.closest('[data-cd]'); if (!b) return;
    const c = list.find(x => x.id === b.dataset.cd); if (!c) return;
    if (!await confirmBox(`「${c.name}」様を削除しますか?\n専用資料・閲覧履歴・コンバージョンも一緒に削除され、元に戻せません。`)) return;
    await api('/customers/' + c.id, { method: 'DELETE' }); toast('顧客を削除しました'); route();
  });
  draw();
}

async function vCustomerDetail(v, id) {
  const [c, files, events, contents] = await Promise.all([api('/customers/' + id), api(`/customers/${id}/files`), api(`/customers/${id}/events`), api('/contents')]);
  const sel = [...(c.tags || [])];
  const visible = contents.filter(m => m.active && (!(m.targetTags || []).length || m.targetTags.some(t => sel.includes(t)))).sort((a, b) => a.order - b.order);
  const evs = [...events].sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const r = relTime(c.lastSeenAt);
  const ICON = { file: '📄', link: '🔗', mail: '✉️', folder: '📁', vr: '🥽', gallery: '🖼️', pdf: '📕', video: '🎞️' };
  v.innerHTML = `<h2 class="title"><a class="btn sm" href="#/customers">← 一覧</a> ${esc(c.name)} 様</h2>
  <div class="grid2">
   <div class="card"><h3>顧客情報</h3><dl class="kv">
     <dt>氏名</dt><dd>${esc(c.name)}</dd><dt>メール</dt><dd>${esc(c.email)}</dd>
     <dt>最終アクセス</dt><dd><span class="badge ${r.recent ? 'red' : 'gray'}">${r.text}</span> <span class="note">${fmt(c.lastSeenAt)}</span></dd>
     <dt>端末</dt><dd>${c.installed ? '📱 ホーム画面追加済み' : '未追加'} ${esc(c.platform || '')}</dd>
     <dt>ステータス</dt><dd><input type="text" id="cs" value="${esc(c.status)}" placeholder="例: 検討中" style="margin:0"></dd>
     <dt>担当者</dt><dd><input type="text" id="ca" value="${esc(c.assignee)}" placeholder="例: 山田" style="margin:0"></dd>
     <dt>タグ</dt><dd><div class="chips" id="cc" style="margin:0"></div></dd>
     <dt>メモ</dt><dd><textarea id="cm" style="margin:0;min-height:60px">${esc(c.memo)}</textarea></dd></dl>
     <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center"><button class="btn" id="cdel" style="color:var(--red);border-color:var(--red)">🗑️ この顧客を削除</button><button class="btn blue" id="csave">保存</button></div></div>
   <div class="card"><h3>行動タイムライン <span class="note">(${evs.length}件)</span></h3>
     <ul class="timeline" style="max-height:340px;overflow:auto">${evs.slice(0, 60).map(e => `<li><b>${esc(EVT[e.type] || e.type)}</b>${e.target ? ` <span class="note">${esc(e.target)}</span>` : ''}<time>${fmt(e.at)}</time></li>`).join('') || '<li class="note">まだ行動がありません</li>'}</ul></div>
  </div>
  <div class="card"><h3>資料のお渡し</h3>
    <p class="note" style="margin-top:0">このお客様に表示されているコンテンツメニュー(タグ設定により自動表示。ここからの追加は不可 / ライブラリ管理で編集)</p>
    ${visible.map(m => `<div class="mini"><span>${ICON[m.type] || '📄'}</span><div class="grow"><b>${esc(m.title)}</b></div><span class="badge gray">${esc(m.type)}</span></div>`).join('') || '<div class="note">表示中のコンテンツはありません</div>'}
    <h3 style="margin-top:22px">${esc(c.name)}様 専用の資料 <button class="btn green sm" id="fadd" style="float:right">＋ 追加</button></h3>
    <div id="flist">${files.map(f => `<div class="mini"><span>${ICON[f.kind] || '📄'}</span><div class="grow"><b>${esc(f.title)}</b><div class="note">${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.url)}</a>` : ''} ・ ${fmt(f.createdAt)}</div></div><span class="badge blue">${{ file: 'ファイル', link: 'リンク', mail: 'メール' }[f.kind] || esc(f.kind)}</span><button class="ibtn" data-fd="${esc(f.id)}" title="削除">🗑️</button></div>`).join('') || '<div class="note">専用の資料はまだありません</div>'}</div>
  </div>
  <div class="ai" id="ai"><div class="ai-h"><b>🤖 顧客サマリー</b><span class="beta">AI BETA</span><span class="sp"></span><button class="btn sm" id="reai">再解析する</button></div><div class="ai-b" id="aib"><div class="note">解析中…</div></div></div>`;
  chipPicker(v.querySelector('#cc'), sel);
  v.querySelector('#csave').onclick = guard(async () => {
    await api('/customers/' + id, { method: 'PUT', body: { tags: sel, status: v.querySelector('#cs').value.trim(), assignee: v.querySelector('#ca').value.trim(), memo: v.querySelector('#cm').value } });
    toast('保存しました'); route();
  });
  v.querySelector('#cdel').onclick = guard(async () => {
    if (!await confirmBox(`「${c.name}」様を削除しますか?\n専用資料・閲覧履歴・コンバージョンも一緒に削除され、元に戻せません。`)) return;
    await api('/customers/' + id, { method: 'DELETE' }); toast('顧客を削除しました'); location.hash = '#/customers';
  });
  v.querySelector('#fadd').onclick = () => fileModal(id);
  v.querySelector('#flist').onclick = guard(async e => {
    const b = e.target.closest('[data-fd]');
    if (b && await confirmBox('この資料を削除しますか?')) { await api(`/customers/${id}/files/${b.dataset.fd}`, { method: 'DELETE' }); toast('削除しました'); route(); }
  });
  const loadAI = guard(async () => {
    const btn = v.querySelector('#reai'), box = v.querySelector('#aib');
    btn.disabled = true; btn.innerHTML = '<span class="spin" style="border-color:#0b3d9155;border-top-color:#0b3d91"></span> 解析中';
    box.innerHTML = '<div class="note">解析中…</div>';
    try { box.innerHTML = summaryHtml(await api(`/customers/${id}/summary`)); }
    finally { btn.disabled = false; btn.textContent = '再解析する'; }
  });
  v.querySelector('#reai').onclick = loadAI;
  loadAI();
}
function summaryHtml(s) {
  const hl = t => `<span class="hl">${esc(t)}</span>`;
  const o = s.overview || {}, i = s.interests || {}, h = s.hints || {};
  return `<div class="ai-sec"><h4><span class="num">1</span>${hl(o.headline || '概要')}</h4><p>${esc(o.body)}</p></div>
  <div class="ai-sec"><h4><span class="num">2</span>${hl('行動タイムライン')}</h4>
    <table class="ai-tbl"><thead><tr><th style="width:24%">時期</th><th>行動</th><th style="width:28%">注目機能</th></tr></thead><tbody>
    ${(s.timeline || []).map(t => `<tr><td>${esc(t.period)}</td><td>${esc(t.action)}</td><td>${esc(t.feature)}</td></tr>`).join('') || '<tr><td colspan="3" class="note">データなし</td></tr>'}</tbody></table></div>
  <div class="ai-sec"><h4><span class="num">3</span>${hl(i.headline || '関心事項')}</h4><ul>${(i.points || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
  <div class="ai-sec"><h4><span class="num">4</span>${hl(h.headline || '接客のヒント')}</h4><ul>${(h.points || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
  ${s.stats ? `<div class="note">解析対象: イベント ${esc(s.stats.events)}件 / セッション ${esc(s.stats.sessions)}回</div>` : ''}`;
}
function fileModal(cid) {
  modal({ title: '専用の資料を追加', body: `<label class="f">種別<select id="fk"><option value="file">ファイル(URL)</option><option value="link">リンク</option><option value="mail">メール</option></select></label>
    <label class="f">タイトル<input type="text" id="ft"></label>
    <label class="f"><span id="fl">URL</span><input type="text" id="fu" placeholder="https://"></label>`,
    footer: '<button class="btn" data-c>キャンセル</button><button class="btn green" data-s>追加</button>',
    onMount: (el, close) => {
      const k = el.querySelector('#fk');
      k.onchange = () => { const m = k.value === 'mail'; el.querySelector('#fl').textContent = m ? 'メールアドレス / 件名' : 'URL'; el.querySelector('#fu').placeholder = m ? 'mailto:xxx@example.com' : 'https://'; };
      el.querySelector('[data-c]').onclick = close;
      el.querySelector('[data-s]').onclick = guard(async () => {
        const title = el.querySelector('#ft').value.trim(); if (!title) throw new Error('タイトルを入力してください');
        await api(`/customers/${cid}/files`, { method: 'POST', body: { title, kind: k.value, url: el.querySelector('#fu').value.trim() } });
        toast('追加しました'); close(); route();
      });
    } });
}

/* ---------- library ---------- */
async function vLibrary(v) {
  const list = (await api('/contents')).sort((a, b) => a.order - b.order);
  const TY = { folder: 'フォルダ', vr: 'VR', gallery: 'CGギャラリー', pdf: 'PDF', video: '動画', link: 'リンク' };
  v.innerHTML = `<h2 class="title">ライブラリ管理 <span class="sp"></span><button class="btn green" id="new">＋ コンテンツメニュー追加</button></h2>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>順</th><th>コンテンツメニュー</th><th>種別</th><th>公開対象タグ</th><th>状態</th><th>操作</th></tr></thead><tbody>
  ${list.map((m, i) => `<tr style="${m.active ? '' : 'opacity:.55'}"><td style="white-space:nowrap"><button class="ibtn" data-up="${i}" ${i === 0 ? 'disabled' : ''}>▲</button><button class="ibtn" data-dn="${i}" ${i === list.length - 1 ? 'disabled' : ''}>▼</button></td>
    <td><div class="tcell">${m.thumb ? `<img class="thumb" src="${esc(gUrl(m.thumb))}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<span class="thumb ph"></span>'}<div><b>${esc(m.title)}</b><div class="note">${esc(m.url)}</div></div></div></td><td><span class="badge gray">${TY[m.type] || esc(m.type)}</span></td>
    <td>${(m.targetTags || []).length ? tagHtml(m.targetTags) : '<span class="note">全員</span>'}</td>
    <td><span class="badge ${m.active ? 'yes' : 'no'}">${m.active ? '公開中' : '停止中'}</span></td>
    <td style="white-space:nowrap"><button class="btn sm" data-t="${i}">${m.active ? '停止' : '公開'}</button> <button class="ibtn" data-e="${i}">✏️</button><button class="ibtn" data-d="${i}">🗑️</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">コンテンツがありません</td></tr>'}</tbody></table></div>`;
  v.querySelector('#new').onclick = () => contentModal(null, list.length);
  v.onclick = guard(async e => {
    const b = e.target.closest('button[data-up],button[data-dn],button[data-t],button[data-e],button[data-d]'); if (!b || b.disabled) return;
    const ds = b.dataset;
    if (ds.up !== undefined || ds.dn !== undefined) {
      const i = +(ds.up ?? ds.dn), j = ds.up !== undefined ? i - 1 : i + 1;
      const arr = list.slice(); [arr[i], arr[j]] = [arr[j], arr[i]];
      await Promise.all(arr.map((m, k) => m.order !== k ? api('/contents/' + m.id, { method: 'PUT', body: { order: k } }) : null));
      route();
    } else if (ds.t !== undefined) { const m = list[+ds.t]; await api('/contents/' + m.id, { method: 'PUT', body: { active: !m.active } }); toast(m.active ? '停止しました' : '公開しました'); route(); }
    else if (ds.e !== undefined) contentModal(list[+ds.e]);
    else if (ds.d !== undefined && await confirmBox('このコンテンツを削除しますか?')) { await api('/contents/' + list[+ds.d].id, { method: 'DELETE' }); toast('削除しました'); route(); }
  });
}
function contentModal(m, n) {
  const sel = [...(m?.targetTags || [])];
  modal({ title: m ? 'コンテンツメニューの編集' : 'コンテンツメニューの追加',
    body: `<label class="f">タイトル<input type="text" id="mt1" value="${esc(m?.title)}"></label>
    <div class="row"><label class="f">種別<select id="mty">${[['folder', 'フォルダ'], ['vr', 'VR'], ['gallery', 'CGギャラリー'], ['pdf', 'PDF'], ['video', '動画'], ['link', 'リンク']].map(([k, l]) => `<option value="${k}" ${m?.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f">表示順<input type="number" id="mor" value="${m?.order ?? n ?? 0}"></label></div>
    <label class="f">URL<input type="text" id="mur" value="${esc(m?.url)}"></label>
    <label class="f">サムネイルURL <small>(任意 / 候補から選択可)</small><input type="text" id="mth" list="thl" value="${esc(m?.thumb)}"></label>
    <datalist id="thl">${['top_mv.jpg', 'top_concept.jpg', 'top_design_1.png', 'top_design_2.png', 'top_loca_1.jpg', 'top_access_2.jpg', 'top_access_3.jpg', 'common_nav_img.jpg', 'top_entry_merit_2.jpg', 'top_entry_merit_3.jpg', 'top_entry_merit_4.jpg', 'top_entry_merit_6.jpg'].map(f => `<option value="/assets/img/${f}">`).join('')}</datalist>
    <div class="f" style="font-weight:600;font-size:13px">公開対象タグ <small style="font-weight:400;color:var(--mut)">(未選択=全員)</small><div class="chips" id="mc"></div></div>
    <label class="f"><input type="checkbox" id="mac" ${m?.active === false ? '' : 'checked'}> 公開する</label>`,
    footer: '<button class="btn" data-c>キャンセル</button><button class="btn blue" data-s>保存</button>',
    onMount: (el, close) => {
      chipPicker(el.querySelector('#mc'), sel);
      el.querySelector('[data-c]').onclick = close;
      el.querySelector('[data-s]').onclick = guard(async () => {
        const b = { title: el.querySelector('#mt1').value.trim(), type: el.querySelector('#mty').value, order: +el.querySelector('#mor').value, url: el.querySelector('#mur').value.trim(), thumb: el.querySelector('#mth').value.trim(), targetTags: sel, active: el.querySelector('#mac').checked };
        if (!b.title) throw new Error('タイトルを入力してください');
        m ? await api('/contents/' + m.id, { method: 'PUT', body: b }) : await api('/contents', { method: 'POST', body: b });
        toast('保存しました'); close(); route();
      });
    } });
}

/* ---------- tags ---------- */
async function vTags(v) {
  state.tags = await api('/tags');
  v.innerHTML = `<h2 class="title">タグ管理 <span class="sp"></span><button class="btn green" id="new">＋ タグ追加</button></h2>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>タグ</th><th>色</th><th>操作</th></tr></thead><tbody>
  ${state.tags.map((t, i) => `<tr><td><span class="tag" style="--c:${esc(t.color)}">${esc(t.name)}</span></td><td><code>${esc(t.color)}</code></td>
   <td><button class="ibtn" data-e="${i}">✏️</button><button class="ibtn" data-d="${i}">🗑️</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">タグがありません</td></tr>'}</tbody></table></div>`;
  v.querySelector('#new').onclick = () => tagModal(null);
  v.onclick = guard(async e => {
    const b = e.target.closest('[data-e],[data-d]'); if (!b) return;
    if (b.dataset.e !== undefined) tagModal(state.tags[+b.dataset.e]);
    else if (await confirmBox('このタグを削除しますか?')) { await api('/tags/' + state.tags[+b.dataset.d].id, { method: 'DELETE' }); toast('削除しました'); route(); }
  });
}
function tagModal(t) {
  modal({ title: t ? 'タグの編集' : 'タグの追加', body: `<label class="f">タグ名<input type="text" id="tn" value="${esc(t?.name)}"></label><label class="f">色<input type="color" id="tc" value="${esc(t?.color || '#0b3d91')}" style="display:block;margin-top:5px;height:40px;width:90px;padding:2px"></label>`,
    footer: '<button class="btn" data-c>キャンセル</button><button class="btn blue" data-s>保存</button>',
    onMount: (el, close) => {
      el.querySelector('[data-c]').onclick = close;
      el.querySelector('[data-s]').onclick = guard(async () => {
        const b = { name: el.querySelector('#tn').value.trim(), color: el.querySelector('#tc').value };
        if (!b.name) throw new Error('タグ名を入力してください');
        t ? await api('/tags/' + t.id, { method: 'PUT', body: b }) : await api('/tags', { method: 'POST', body: b });
        toast('保存しました'); close(); route();
      });
    } });
}

/* ---------- conversions ---------- */
async function vConversions(v) {
  const [list, cs] = await Promise.all([api('/conversions'), api('/customers')]);
  const nm = Object.fromEntries(cs.map(c => [c.id, c.name]));
  list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const cnt = {}; list.forEach(x => cnt[x.kind] = (cnt[x.kind] || 0) + 1);
  v.innerHTML = `<h2 class="title">コンバージョン管理 <span class="sp"></span><button class="btn green" id="new">＋ 追加</button></h2>
  <div class="kpis">${Object.entries(CV).map(([k, l]) => `<div class="kpi"><div class="n">${cnt[k] || 0}</div><div class="l">${l}</div></div>`).join('')}<div class="kpi"><div class="n">${list.length}</div><div class="l">合計</div></div></div>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>日時</th><th>お客様</th><th>種別</th><th>メモ</th></tr></thead><tbody>
  ${list.map(x => `<tr><td>${fmt(x.at)}</td><td>${x.customerId ? `<a href="#/customers/${esc(x.customerId)}">${esc(nm[x.customerId] || x.customerId)}</a>` : '-'}</td><td><span class="badge blue">${esc(CV[x.kind] || x.kind)}</span></td><td>${esc(x.note)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">コンバージョンがありません</td></tr>'}</tbody></table></div>`;
  v.querySelector('#new').onclick = () => modal({ title: 'コンバージョンの追加',
    body: `<label class="f">お客様<select id="xc">${cs.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.email)})</option>`).join('')}</select></label>
    <label class="f">種別<select id="xk">${Object.entries(CV).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
    <label class="f">メモ<input type="text" id="xn"></label>`,
    footer: '<button class="btn" data-c>キャンセル</button><button class="btn green" data-s>追加</button>',
    onMount: (el, close) => {
      el.querySelector('[data-c]').onclick = close;
      el.querySelector('[data-s]').onclick = guard(async () => {
        await api('/conversions', { method: 'POST', body: { customerId: el.querySelector('#xc').value, kind: el.querySelector('#xk').value, note: el.querySelector('#xn').value } });
        toast('追加しました'); close(); route();
      });
    } });
}

boot();
})();
