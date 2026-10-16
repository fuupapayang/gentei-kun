# 限定くん — Firebase (Spark) クライアント実装メモ

サーバー無し構成(SPEC v4)。`GENTEI_CONFIG.apiBase === "firebase"` のとき `public/firebase-api.js` が `window.fetch` を差し替え、
`gApi()` が作る全リクエスト(顧客アプリ / 管理画面 / 営業ツール)を Firestore + Firebase Auth で応答する(JSON形・ステータスは `server.js` と同じ)。
他の apiBase では何もしない。

## ビルド
```
node scripts/build-pages.js --mode firebase \
  --firebase-config '{"apiKey":"…","authDomain":"…","projectId":"…","appId":"…"}'   # または env FIREBASE_CONFIG (JSON文字列 or ファイルパス)
  --admin-emails boss@example.com,staff@example.com                                 # または env ADMIN_EMAILS
  --base /<repo>/
node scripts/make-rules.js boss@example.com,staff@example.com    # firestore.rules.template -> firestore.rules (管理者メール注入)
```
`dist/config.js` = `{apiBase:"firebase", firebase:{…}, adminEmails:[…]}`。`firestore.rules` はコミット済みの生成物(管理者0名=誰も管理不可)。デプロイ前に必ず make-rules を実行。
`firebase.json` は firestore rules のみ(functions / hosting 無し)。`.github/workflows/pages.yml` は従来の `--api` 呼び出しのまま(firebase 用に `--mode firebase` へ切替が必要 = 未対応)。

## 仕組み
- `config.js`: firebase モードでは `gApi(p)` が `https://firebase.invalid/api<p>`(ネットワークに出ない目印URL)を返し、`firebase-api.js` を `document.write` で同期ロード(app.js等より前)。
- SDK(v10.12.2 modular ESM, gstatic)は最初のAPI呼び出し時に `import()`(firebaseモード以外では読まない)。
- Firebase app を2つ使用: `customer`(匿名認証)と `admin`(メール+パスワード)。同一ブラウザで管理者がログインしても顧客の匿名uidは消えない。
- 顧客: 登録で `signInAnonymously` → `customers/{uid}` 作成。`token` = uid(UIは有無しか見ない)。タグ可視判定(contents/pushes)はクライアント側フィルタ。
- 管理: `POST /admin/login {email,password}` → `{token:"firebase"}`。実際の権限は Auth ユーザー + rules。管理画面ログインにメール欄を追加(firebaseモードのみ)。ログアウトで signOut。
- Push「送信」= `status:"queued", queuedAt` を書くだけ。GitHub Actions(別担当)が配信し `status:"sent", sentCount` を書く。管理画面は「送信待ち」→「N件」と表示。
- AI顧客サマリー = `lib/summary.js` のルールベース部分をそのまま移植しブラウザで計算(テストで lib 版と完全一致を確認)。Claude分岐は無し。
- ダッシュボード/顧客一覧の件数は `getCountFromServer`。複合インデックス不要(orderBy は使わずクライアントでソート)。

## Firestore 契約(seed担当と共有)
`property/main`(フィールド `id:"p0061"` を含めること。無ければ p0061 を補う)、`settings/public {vapidPublicKey}`、`tags/{id}`、`contents/{id}`(`active`必須boolean)、
`pushes/{id}`(status draft|queued|sent, createdAt ISO文字列)、`customers/{uid}`、`personalFiles/{id}`(customerId)、`events/{id}`{customerId,type,target,at}、`conversions/{id}`。日時は全て ISO 文字列。

## 既知の制限
- 同じメールで別ブラウザ/別端末から再登録すると別の `customers` 文書が増える(メール重複排除はサーバー無しでは不可)。
- iOS: Safari と「ホーム画面に追加」したPWAはストレージが別。Safariで登録した匿名uidはPWAに引き継がれない(PWA側で再登録が必要)。Express版のtoken方式でも同じ。
- タグによる限定表示は「クライアント側フィルタ」。rules は active な contents / sent な pushes を匿名ユーザーに読ませるので、技術者が直接読めば全 active コンテンツのURLが見える(秘匿情報はここに置かない)。個人資料(personalFiles)だけは uid で厳密に制限。
- 顧客はサインアップ時のみ自己申告タグ(`?tag=`、最大10個)を付けられる(Express版と同じ)。以降 tags/status/assignee/memo は rules が変更を拒否。
- 管理者判定は `request.auth.token.email`(メール確認不要)。先にコンソールで管理者ユーザーを作成すること(未作成のまま第三者に同メールで先に登録されるのを防ぐ)。Authentication で Email/Password と Anonymous を有効化。
- Service Worker の API オフラインキャッシュは firebase モードでは効かない(リクエストが SW まで届かない)。アプリシェルのキャッシュは従来通り。
- 管理者の同時書き込みは last-write-wins(トランザクション無し)。タグのリネーム/削除は customers/contents/pushes を batch 更新。

## テスト
`node scripts/test-firebase-api.js` — 実Firebase無し。インメモリ偽SDK(`globalThis.__GENTEI_FIREBASE_SDK__` フック)で全ルート・権限の想定(rules相当の簡易検査付き)を検証。rules 本文そのものは未実行(Java無し/エミュレータ不可)。
