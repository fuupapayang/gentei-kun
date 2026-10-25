# エスコン プライムサイト デプロイ手順 (テストリリース)

構成: **GitHub Pages**(静的フロント, `public/` → `dist/`) + **Firebase**(Firestore + Cloud Functions `api`)。
フロントは `https://<github-user>.github.io/<repo>/` に置かれ、API は別オリジン(Cloud Functions)を呼びます。
テストリリース中は全ページ `noindex` + `robots.txt: Disallow: /`(検索に出ません)。

## 0. 準備(1回だけ)
```
brew install gh node          # 未インストールなら
npm i -g firebase-tools
gh auth login                 # GitHub.com / HTTPS / ブラウザ認証
firebase login
```

## 1. バックエンド(Firebase) → 先に済ませる
**[DEPLOY-backend.md](DEPLOY-backend.md) の手順 1〜5** を実行し、最後に表示される関数URLを控える:
```
https://asia-northeast1-<firebase-project-id>.cloudfunctions.net/api
```
これが `API_BASE`。CORS 用に `functions/.env.<project>` の `ALLOWED_ORIGINS` へ
`https://<github-user>.github.io`(オリジンのみ。`/<repo>` は付けない)を設定してから `firebase deploy --only firestore:rules,functions` を実行すること。

## 2. GitHub リポジトリ作成 & 変数設定
```
cd aplika
git init -b main
git add -A && git commit -m "エスコン プライムサイト initial"
gh repo create <repo> --public --source . --remote origin     # Pages(無料)は public が簡単。private は有料プランのみ
gh variable set API_BASE --body "https://asia-northeast1-<firebase-project-id>.cloudfunctions.net/api"
```
- `.gitignore` により `data/`(VAPID秘密鍵入り)・`node_modules`・`dist` はコミットされません。
- Pages のソースを Actions にする(1回): `gh api -X POST repos/<github-user>/<repo>/pages -f build_type=workflow`
  (既に有効なら `-X PUT`)。または GitHub の Settings → Pages → Source = **GitHub Actions**。

## 3. デプロイ
```
git push -u origin main
```
`.github/workflows/pages.yml` が走り `node scripts/build-pages.js --api $API_BASE --base /<repo>/` → Pages に公開。
完了後のURL: `https://<github-user>.github.io/<repo>/`  (管理画面 `/admin/`、接客ツール `/tool/`)。
再デプロイは `main` への push、または Actions → "Deploy front-end to GitHub Pages" → Run workflow。
リポジトリ名が `<github-user>.github.io` の場合は自動で base=`/` になります。

## 4. 動作確認
1. `https://<github-user>.github.io/<repo>/` が開く → 「会員登録」→ 登録 → `install.html`。
2. `/<repo>/admin/` で `ADMIN_PASSWORD`(Firebase側で設定した値)でログイン。
3. デモ顧客トークン: `localStorage.setItem('aplika.token','demo-token-gentei-0001')` 後に `/<repo>/?app=1&open=1`。
4. ブラウザの DevTools Network で API が `…cloudfunctions.net/api/...` に飛び、CORS エラーが無いこと。
   CORS エラーなら `ALLOWED_ORIGINS` を見直して `firebase deploy --only functions`。
5. Push は HTTPS 必須(Pages は OK)。iOS はホーム画面追加後のみ通知可。

## 5. 本番化するとき
- 検索に出したい場合: リポジトリ変数 `ALLOW_INDEX=1` を設定(`gh variable set ALLOW_INDEX --body 1`)して再デプロイ → noindex / Disallow が外れる。
- 独自ドメイン: Settings → Pages → Custom domain 設定後、base が `/` になるようワークフローの BASE 計算(`pages.yml`)を `BASE="/"` に固定し、`ALLOWED_ORIGINS` にそのドメインを追加。

## ローカルで確認
- 通常開発(変更なし): `npm install && npm start` → http://localhost:3000 (`apiBase=""`, base `/`)
- Pages と同じ形のビルド確認: `node scripts/build-pages.js --api <API_URL> --base /<repo>/` → `dist/` を静的サーバーで `/<repo>/` 配下に配置。
  ビルドは最後に「dist/ にルート絶対参照(`/assets/..` 等)が残っていないか」を自動検査し、残っていれば失敗します。

## トラブルシュート
- 画面は出るが API 失敗: Actions の変数 `API_BASE` が空/誤り(ビルド時に焼き込み)。直して再デプロイ。
- 古い画面が出る: Service Worker のキャッシュ。ハードリロード or `sw.js` の `VERSION` を上げる。
- 404 ページ: `404.html`(TOPへ戻るリンク付き)が自動配置されます。
