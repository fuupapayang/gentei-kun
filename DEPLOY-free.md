# エスコン プライムサイト 無料デプロイ手順 (GitHub Pages + Firebase Spark)

構成: フロント=GitHub Pages(public リポジトリ) / DB・認証=Firestore + Firebase Auth(Spark=無料) / Push送信=GitHub Actions(5分毎)。
Cloud Functions・Blaze(課金)は不要。`DEPLOY.md` / `DEPLOY-backend.md` は旧構成なので使わない。

## 0. 準備
```
brew install gh node
npm i -g firebase-tools
gh auth login && firebase login
```

## 1. Firebase プロジェクト(コンソールで手作業・課金なし)
1. https://console.firebase.google.com → プロジェクトを追加(Analytics 不要)。**Spark のまま**。
2. 構築 → **Firestore Database** → 作成(ロケーション `asia-northeast1`、本番モード)。
3. 構築 → **Authentication** → 始める → ログイン方法で **匿名** と **メール/パスワード** を有効化。
4. Authentication → ユーザー → 「ユーザーを追加」で管理者のメール+パスワードを作成(この email を後述 `ADMIN_EMAILS` に使う)。
5. Authentication → 設定 → 承認済みドメインに `<github-user>.github.io` を追加。
6. プロジェクトの設定 → 全般 → マイアプリで **ウェブアプリ**を登録し、`firebaseConfig`(apiKey, authDomain, projectId, appId ...)を控える。
7. プロジェクトの設定 → サービスアカウント → **新しい秘密鍵を生成** → JSON を `~/Downloads/sa.json` に保存(**コミット禁止**。使い終わったら安全な場所へ)。

## 2. ルール配備と初期データ
```
cd aplika
# .firebaserc の project id を自分のものに。firestore.rules は管理者メール入りのものを使用
firebase deploy --only firestore:rules --project <firebase-project-id>

cd scripts && npm install
export GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/sa.json

node seed-firestore.js --dry-run          # 件数確認(認証不要)
node seed-firestore.js                    # デモ顧客込み(テスト用)
# 本番: node seed-firestore.js --no-demo   (既存ドキュメントは上書きしない。上書きは --force)

node gen-vapid.js --write                 # 公開鍵を Firestore settings/public へ。秘密鍵が表示される
```
表示された `VAPID_PRIVATE_KEY` を控える(再表示されない。作り直すと既存購読は無効)。

## 3. GitHub リポジトリ・Secrets・Variables
```
cd aplika
git init -b main && git add -A && git commit -m "エスコン プライムサイト initial"
gh repo create <repo> --public --source . --remote origin     # public 必須(無料)

gh secret set FIREBASE_SERVICE_ACCOUNT < ~/Downloads/sa.json
gh secret set VAPID_PRIVATE_KEY                                  # 貼り付けて Enter
gh variable set SITE_URL --body "https://<github-user>.github.io/<repo>/"
gh variable set VAPID_SUBJECT --body "mailto:<your-email>"      # 任意
```
フロントのビルド用変数(Firebase の `firebaseConfig`・管理者メール等)は `pages.yml` が参照する名前で同様に `gh variable set` する(`SPEC.md` v4 の `GENTEI_CONFIG` 参照)。
Pages ソース: `gh api -X POST repos/<github-user>/<repo>/pages -f build_type=workflow`(有効済みなら `-X PUT`)。

## 4. デプロイ
```
git push -u origin main
```
Pages が公開されたら `https://<github-user>.github.io/<repo>/`(管理画面 `/admin/`)。

## 5. 動作確認
1. TOP → 会員登録 → `install.html`。Firestore に `customers/{uid}` ができる。
2. `/admin/` に手順1-4の管理者メールでログイン。
3. 管理画面でPush作成 → 「送信」(status=queued)。
4. GitHub → Actions → "Send queued push notifications" → **Run workflow**(即時)。通常は5分毎の自動実行。
   ログに `push <id>: sent N, failed M`。Firestore の push が `sent` になる。
5. 通知は HTTPS 必須。iOS はホーム画面に追加したアプリのみ受信可。

## 注意
- **GitHub の cron は遅延・間引きがある**(数分〜十数分遅れることも)。急ぐ時は Run workflow。
- 配信先: `pushSub` を持つ顧客で、Push の `targetTags` と顧客の `tags` が1つでも一致(空=全員)。404/410 の購読は自動で破棄。
- 二重送信防止: 送信前に status を `sending` へトランザクションで更新。異常終了で30分以上 `sending` のまま残った Push は次回実行で再送される。
- 手元でテスト: `node scripts/test-send.js`(ネットワーク不要)。実送信の確認のみ: `SITE_URL=... VAPID_PRIVATE_KEY=... node scripts/send-pushes.js --dry-run`(対象人数のみ表示)。
- 無料枠(Spark): Firestore 読み取り 5万/日。Actions は5分毎(1日288回)に pushes 全件を読む(顧客は送信対象がある時だけ全件読む)。Push 履歴が数百件を超えたら cron 間隔を延ばす。

## トラブルシュート
- `permission-denied`: ルール未配備/管理者メール不一致/匿名認証が無効。
- Push が届かない: 顧客の `pushSub` が null(通知未許可)、`settings/public.vapidPublicKey` とシークレットの鍵ペア不一致(鍵を作り直したら顧客は再許可が必要)。
- ワークフローが赤: エラー注釈に未設定のSecret/Variable名が出る。
