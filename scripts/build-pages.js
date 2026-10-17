#!/usr/bin/env node
/* 限定くん: build public/ -> dist/ for GitHub Pages (served under a sub-path, talking to a cross-origin API).
 *
 *   node scripts/build-pages.js --api https://asia-northeast1-<proj>.cloudfunctions.net/api --base /<repo>/
 *
 * Options (env fallbacks in brackets):
 *   --api   <url>   API root, i.e. what "/api" maps to          [API_BASE]   (default "" = same-origin /api)
 *   --base  </x/>   site base path, "/" for user/custom domains [BASE_PATH]  (default "/")
 *   --out   <dir>   output dir                                  (default dist)
 *   --index         do NOT add noindex / robots Disallow (production release)
 *   --mode  firebase  serverless Firebase (Spark) mode: apiBase="firebase", needs --firebase-config
 *   --firebase-config <json|file>  Web-app config {apiKey,authDomain,projectId,appId,...}  [FIREBASE_CONFIG]
 *   --admin-emails a@b.c,d@e.f     admin accounts (UI hint only; real gate = firestore.rules) [ADMIN_EMAILS]
 *   --origin <url>  site origin used to absolutise og:image     [SITE_ORIGIN] (optional)
 *
 * The source in public/ is already base-path agnostic (relative URLs in HTML/manifest, runtime gUrl()/gApi()
 * helpers from config.js in JS). This script writes dist/config.js, adds noindex, .nojekyll, robots.txt, 404.html,
 * and then VERIFIES that no root-absolute reference remains in dist/.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const opt = (name, env, def) => {
  const i = argv.indexOf('--' + name);
  if (i >= 0 && argv[i + 1] !== undefined) return argv[i + 1];
  return process.env[env] !== undefined && process.env[env] !== '' ? process.env[env] : def;
};
const flag = n => argv.includes('--' + n);

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.resolve(ROOT, opt('out', 'OUT_DIR', 'dist'));
let api = (opt('api', 'API_BASE', '') || '').trim().replace(/\/+$/, '');
let base = (opt('base', 'BASE_PATH', '/') || '/').trim();
const noindex = !flag('index');
const origin = (opt('origin', 'SITE_ORIGIN', '') || '').replace(/\/+$/, '');

const mode = (opt('mode', 'DEPLOY_MODE', '') || '').trim();
let fbConfig = null;
const adminEmails = (opt('admin-emails', 'ADMIN_EMAILS', '') || '').split(/[,\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
if (mode && mode !== 'firebase') { console.error('ERROR: --mode must be "firebase" (or omitted)'); process.exit(1); }
if (mode === 'firebase') {
  let raw = (opt('firebase-config', 'FIREBASE_CONFIG', '') || '').trim();
  if (raw && !raw.startsWith('{') && fs.existsSync(raw)) raw = fs.readFileSync(raw, 'utf8');
  try { fbConfig = JSON.parse(raw); } catch (e) { console.error('ERROR: --firebase-config / FIREBASE_CONFIG must be JSON (or a path to a JSON file)'); process.exit(1); }
  for (const k of ['apiKey', 'projectId', 'appId']) if (!fbConfig[k]) { console.error('ERROR: firebase config is missing "' + k + '"'); process.exit(1); }
  if (!fbConfig.authDomain) fbConfig.authDomain = fbConfig.projectId + '.firebaseapp.com';
  if (!adminEmails.length) console.warn('WARN: no --admin-emails given (adminEmails=[]): the admin UI will not pre-check emails; firestore.rules still decides.');
  api = 'firebase';
}

if (!base.startsWith('/')) base = '/' + base;
if (!base.endsWith('/')) base += '/';
if (mode !== 'firebase' && api && !/^https?:\/\//i.test(api)) { console.error('ERROR: --api must be an absolute http(s) URL, got: ' + api); process.exit(1); }
if (!api && mode !== 'firebase') console.warn('WARN: no --api / API_BASE given: apiBase="" (same-origin /api). Fine for local checks, useless on GitHub Pages.');
if (api && /^http:\/\//i.test(api) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(api)) console.warn('WARN: API is plain http; browsers block mixed content from an https Pages site.');

// ---- copy ----
if (path.relative(ROOT, OUT).startsWith('..') || OUT === ROOT) { console.error('refusing to use out dir ' + OUT); process.exit(1); }
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true, filter: s => !path.basename(s).startsWith('.DS_Store') });

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

// ---- config.js: prepend the real config (config.js keeps an existing GENTEI_CONFIG) ----
const cfgPath = path.join(OUT, 'config.js');
fs.writeFileSync(cfgPath, 'self.GENTEI_CONFIG=' + JSON.stringify(mode === 'firebase' ? { apiBase: 'firebase', firebase: fbConfig, adminEmails, github: process.env.GITHUB_REPOSITORY ? { repo: process.env.GITHUB_REPOSITORY, workflow: 'send-push.yml', ref: 'main' } : undefined } : { apiBase: api }) + ';\n' + fs.readFileSync(cfgPath, 'utf8'));

const BUILD_STAMP = Date.now().toString(36);
// ---- html: noindex meta, absolute og:image ----
const robotsMeta = '<meta name="robots" content="noindex, nofollow, noarchive">';
for (const f of walk(OUT).filter(f => f.endsWith('.html'))) {
  let s = fs.readFileSync(f, 'utf8');
  if (noindex && !/name=["']robots["']/i.test(s)) {
    s = /<meta charset[^>]*>/i.test(s) ? s.replace(/(<meta charset[^>]*>)/i, '$1\n' + robotsMeta) : s.replace(/<head[^>]*>/i, m => m + '\n' + robotsMeta);
  }
  // cache-busting stamp on local script/stylesheet references (GitHub Pages caches for 10 min)
  s = s.replace(/(<script[^>]*\ssrc=|<link[^>]*\shref=)"((?!https?:|\/\/|data:)[^"?#]+\.(?:js|css))"/g, (m, a, u) => a + '"' + u + '?v=' + BUILD_STAMP + '"');
  if (origin) s = s.replace(/(<meta property="og:image" content=")(?!https?:)([^"]*)(")/g, (m, a, u, c) => a + origin + base + u.replace(/^\.?\//, '') + c);
  fs.writeFileSync(f, s);
}

// ---- robots.txt / .nojekyll / 404.html ----
fs.writeFileSync(path.join(OUT, 'robots.txt'), noindex ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, '404.html'), `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
${noindex ? robotsMeta + '\n' : ''}<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ページが見つかりません｜限定くん</title>
<style>body{font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f6f8;color:#222;text-align:center}
.b{padding:32px 24px}h1{font-size:20px;margin:0 0 8px}p{margin:0 0 20px;color:#666;font-size:14px}a{display:inline-block;background:#c00000;color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px}</style>
</head><body><div class="b"><h1>ページが見つかりません</h1><p>お探しのページは存在しないか、移動した可能性があります。</p><a href="${base}">TOPへ戻る</a></div></body></html>
`);

// ---- verification: no root-absolute references may remain ----
const problems = [];
// 404.html: generated with the resolved base. config.js: the helper definitions themselves.
// sw.js: derives BASE from its own URL and maps every path through P()/rel (checked separately below).
const SKIP = new Set(['404.html', 'config.js', 'sw.js']);
for (const f of walk(OUT)) {
  const rel = path.relative(OUT, f);
  if (SKIP.has(rel) || !/\.(html|css|js|webmanifest)$/.test(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    if (/^\s*(\/\/|\/\*|\*)/.test(ln)) return; // comments
    const hits = [];
    // HTML attributes / manifest values / css url()
    for (const m of ln.matchAll(/(?:\b(?:src|href|srcset|data-src|poster|action|content)=|"(?:src|start_url|scope|id)":\s*)["']\/(?!\/)[^"']*/g)) hits.push(m[0]);
    for (const m of ln.matchAll(/url\(\s*["']?\/(?!\/)[^)]*/g)) hits.push(m[0]);
    // JS string literals that start with a known root path and are not wrapped by gUrl()/gApi()
    for (const m of ln.matchAll(/(gUrl\(\s*|gApi\(\s*)?(['"`])\/(assets|api|admin|tool|icons|sw\.js|manifest|register\.html|install\.html|index\.html|app\.(js|css)|config\.js)[^'"`]*\2/g)) if (!m[1]) hits.push(m[0]);
    for (const m of ln.matchAll(/(location\.href\s*=\s*|window\.open\(\s*|fetch\(\s*|register\(\s*)(['"`])\/[^'"`]*\2/g)) hits.push(m[0]);
    // template-literal / concatenated attrs in JS: src="/..." href="/..."
    // lines that route values through gUrl()/gApi() are base-aware; admin datalist <option value="/assets/.."> is stored data resolved by gUrl() at use
    if (hits.length && (/gUrl\(|gApi\(/.test(ln) || /<option value="\/assets\//.test(ln))) return;
    for (const h of hits) problems.push(rel + ':' + (i + 1) + '  ' + h.slice(0, 100));
  });
}
if (problems.length) {
  console.error('ERROR: root-absolute references remain in ' + path.relative(ROOT, OUT) + '/:');
  problems.forEach(p => console.error('  ' + p));
  process.exit(2);
}

const sw = fs.readFileSync(path.join(OUT, 'sw.js'), 'utf8');
if (!/new URL\('\.\/', self\.location\.href\)\.pathname/.test(sw) || /caches\.(add|match|open)\(\s*['"]\//.test(sw)) {
  console.error('ERROR: sw.js is not base-path safe'); process.exit(2);
}

const nFiles = walk(OUT).length;
console.log(`OK  ${path.relative(ROOT, OUT)}/  files=${nFiles}  base=${base}  apiBase=${api || '(same-origin)'}${mode === 'firebase' ? ' project=' + fbConfig.projectId + ' admins=' + adminEmails.length : ''}  noindex=${noindex}`);
console.log('    verified: no root-absolute references in html/css/js/manifest');
