# 限定くん (APLIKA clone) — 共通仕様 / Shared Contract

物件(マンション)向け会員登録者専用 PWA。HP登録→ホーム画面追加→限定情報/Push通知→行動ログ→管理画面でAI顧客サマリー。
Stack: Node(>=20) + Express不使用の素の `node:http` ではなく **express** + **web-push** のみ依存。フロントは依存なしの素のHTML/CSS/JS(ES modules可)。JSONファイル永続化(data/db.json)。
Run: `npm install && npm start` → http://localhost:3000  (customer `/`, admin `/admin/`, sales tool `/tool/`)
UI言語は日本語。モバイルファースト。配色: 赤 #c00000 / 青 #0b3d91 / 白、上品な物件アプリ調。

## Ownership (他人のディレクトリは編集しない)
- backend: `server.js`, `lib/**`, `package.json`, `data/**`, `README.md`
- customer: `public/index.html register.html install.html app.js app.css sw.js manifest.webmanifest icons/**` (公開ルート直下)
- admin: `public/admin/**`
- tool: `public/tool/**`

## Data model (lib/db.js が管理, seedあり)
property: {id:"p0061", name:"グランレ・ジェイド葉山", tagline, heroImage(svg data/URL), gtmId:""}
customer: {id, name, email, tags:[str], status:str, assignee:str, memo, token, createdAt, lastSeenAt, pushSub|null, installed:bool, platform:"ios|android|pc"}
content (ライブラリ): {id, title, type:"folder|vr|gallery|pdf|video|link", url, thumb, targetTags:[str] (空=全員), active:bool, order:int, updatedAt}
personalFile (個人向け資料): {id, customerId, title, kind:"file|link|mail", url, createdAt}
push: {id, title, body, url, targetTags:[str], createdAt, status:"draft|sent", sentCount}
event: {id, customerId, type:"login|page|content|push_open|install|vr|library", target, at}
tag: {id, name, color}
conversion: {id, customerId, kind:"visit_reserve|document|contract_inquiry", at, note}
settings: {adminPassword:"admin", vapid:{publicKey,privateKey}} (VAPID は初回起動時に自動生成)

## API (JSON, 全て /api 配下)
### Customer (header `x-customer-token`)
- POST /api/register {name,email,tags?} → {customer, token}  (登録完了ページから呼ぶ。同emailは更新)
- GET  /api/me → {customer, property}
- GET  /api/contents → [content]  (customer.tagsと targetTags が合致/空のもののみ, active のみ, order順) + 個人資料 `personalFiles` も返す: {contents:[...], personalFiles:[...]}
- GET  /api/pushes → 自分宛の送信済みPush履歴 [push]
- GET  /api/vapid-public-key → {key}
- POST /api/push/subscribe {subscription, platform} → {ok}  (installed=true,platform更新)
- POST /api/event {type,target} → {ok}  (行動ログ)
### Admin (header `x-admin-token`, POST /api/admin/login {password} → {token})
- GET/POST /api/admin/pushes ; PUT/DELETE /api/admin/pushes/:id ; POST /api/admin/pushes/:id/send (対象タグの購読者へ web-push, sentCount返却)
- GET /api/admin/customers ; GET/PUT /api/admin/customers/:id (tags,status,assignee,memo) 
- GET /api/admin/customers/:id/files ; POST /api/admin/customers/:id/files ; DELETE /api/admin/customers/:id/files/:fid
- GET /api/admin/customers/:id/events
- GET /api/admin/customers/:id/summary → AI顧客サマリー {overview:{headline,body}, timeline:[{period,action,feature}], interests:{headline,points:[str]}, hints:{headline,points:[str]}, stats:{events,sessions}}  (ルールベースでログから生成。ANTHROPIC_API_KEY があればClaudeで生成する分岐も可)
- GET/POST /api/admin/contents ; PUT/DELETE /api/admin/contents/:id (追加・停止(active)・編集)
- GET/POST /api/admin/tags ; PUT/DELETE /api/admin/tags/:id
- GET /api/admin/conversions ; POST /api/admin/conversions
- GET /api/admin/dashboard → {customers, installed, pushesSent, events7d, conversions}
- GET /api/admin/property ; PUT /api/admin/property
### Public
- GET /api/property → property (登録前ページ用)

## Customer flow (public/)
1. `/` 公式TOP(物件HP風モック: ヒーロー、物件概要、「会員登録」ボタン)。インストール済(standalone)では「限定情報」ボタン表示(APLIKAのみ)。
2. `/register.html` 登録フォーム(入力→確認→完了の3ステップ)。完了で /api/register し token を localStorage `aplika.token` に保存、**3秒後に `/install.html` へ自動遷移**(手動リンクあり)。
3. `/install.html` UA判定(iOS Safari/Android Chrome/PC)で手順(01〜04)を自動出力、beforeinstallprompt があればボタンで直接インストール。
4. インストール後 起動→公式TOP→「限定情報」→モーダル(Window)に 氏名様/限定メニュー(フォルダ/CGギャラリー/VR...)・通知許可ボタン・CLOSE。VR/CGは全画面ビューア。
5. Service Worker: オフラインキャッシュ + push受信/通知クリックで `/` を開く。manifest standalone。

## Branding & assets (v2)
- App name: **限定くん** everywhere (title, manifest name/short_name, headers, install guide, push notification default title, README). "APLIKA" appears nowhere user-facing.
- Client: **ES CON (エスコン)**. Logo: `/assets/img/common_escon.svg` (black wordmark with tagline; use on light bg, or CSS `filter: brightness(0) invert(1)` on dark bg). Property logo (white): `/assets/img/common_logo.svg` (Grand Le JADE HAYAMA).
- Downloaded official assets (user has permission) in `public/assets/img/` and `public/assets/video/`: og_img.jpg, top_mv.jpg(PC key visual), top_mv_sp.jpg(SP), top_concept.jpg, top_access_2/3.jpg, top_design_1.png, top_design_2.png, top_loca_1.jpg, top_plan_1.png, top_entry_merit_{2,3,4,6}.jpg, common_moments_hayama.jpg, common_nav_img.jpg; video: top_sp.mp4 (14MB, vertical), top_access.mp4 (12MB). View them (Read tool) to see what each is before use.
- Replace generated SVG placeholder art with these real assets wherever sensible (hero, gallery, panorama fallback, video, thumbnails). Keep generated fallbacks only where no real asset fits.
- Ownership of this round: backend → `server.js lib/** data/** README.md`; customer → `public/*.html|js|css|sw.js|manifest|icons`; admin → `public/admin/**`; tool → `public/tool/**`.

## Deploy plan (v3): GitHub Pages (static front) + Firebase (Firestore + Cloud Functions API)
- Front: `public/**` is built by `scripts/build-pages.js` into `dist/` for GitHub Pages (project site => served under `/<repo>/`). The build rewrites root-absolute URLs (`/assets/..`, `/admin/`, `/tool/`, `/api/..`, `/sw.js`, `/manifest..`, `/install.html` etc.) to be base-path aware, writes `dist/config.js` with `window.GENTEI_CONFIG={apiBase:"https://<region>-<project>.cloudfunctions.net/api"}` (value from env/arg), adds noindex meta (test release), copies `.nojekyll`, and a `404.html`. Frontend must read apiBase for every fetch (default "" = same-origin so local `npm start` keeps working) and SW scope/paths must work under the subpath.
- Back: `functions/` (self-contained, deployable): Express app exported as 2nd-gen HTTPS function `api` (region asia-northeast1) wrapping the SAME API contract as server.js, with a Firestore-backed store replacing lib/db.js (same seed incl. seedVersion), CORS allowing the Pages origin(s) from env `ALLOWED_ORIGINS`, VAPID keys + admin password from Firestore `settings` doc / Functions params (ADMIN_PASSWORD must be set at deploy, no default "admin" in production), admin tokens persisted in Firestore (stateless functions!), web-push via `web-push`. Firestore rules deny all client access (all access via the function).
- Config files at project root `aplika/`: `firebase.json`, `.firebaserc` (placeholder project id), `firestore.rules`, `.github/workflows/pages.yml` (build + deploy Pages), `DEPLOY.md` (exact step-by-step for the user: gh login, firebase project + Blaze, set secrets, deploy, GitHub repo vars).

## Deploy plan (v4, FREE / Firebase Spark — supersedes v3's Cloud Functions; `functions/` stays unused)
No server. Pages front-end talks to **Firestore + Firebase Auth directly** (Firebase JS SDK v10 modular via https://www.gstatic.com/firebasejs/10.12.2/... ESM imports, no bundler). Push sending = **GitHub Actions cron (every 5 min)** with firebase-admin (service-account secret) + web-push (VAPID private key secret). Repo must be public (free).
Config: `window.GENTEI_CONFIG = { apiBase: "firebase", firebase: {apiKey,authDomain,projectId,appId,...}, adminEmails:[...] }` (build script writes it from env/args; apiBase "" keeps the Express local mode, "http..." the old API mode).
Firestore layout (ids as before): `property/main`, `tags/{id}`, `contents/{id}`, `pushes/{id}` (status draft|queued|sent; admin "send" sets queued+queuedAt; the Action sets sent, sentAt, sentCount, failed), `customers/{uid}` (uid = Firebase anonymous-auth uid; fields as the customer model incl. pushSub, installed, platform, tags, status, assignee, memo, createdAt, lastSeenAt), `personalFiles/{id}` (customerId=uid), `events/{id}` (customerId), `conversions/{id}`, `settings/public` {vapidPublicKey}. NO private keys in Firestore.
Auth: customers = anonymous sign-in (register creates `customers/{uid}`); admin = Firebase email/password; admin = `request.auth.token.email in adminEmails` (emails fixed in firestore.rules by the build/deploy doc). Rules: admin full access; customer reads/writes only own `customers/{uid}` (cannot change tags/status/assignee: restrict via affectedKeys), reads `property`,`contents`,`pushes`(sent),`personalFiles` where customerId==uid, `settings/public`; may create own `events`.
Client shim: `public/firebase-api.js` provides the same logical API as the Express one (same function results/shapes the UI already consumes) by installing a `window.fetch` interceptor for `gApi()` URLs when apiBase=="firebase" so UI code stays unchanged; admin AI summary computed in-browser (port of lib/summary.js, rule-based).
Seeding: `scripts/seed-firestore.js` (Admin SDK, service account, run once from the user's Mac or an Action) writes the seed (same content as lib/db.js seed, image paths relative to site base).
