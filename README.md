# 限定くん (会員限定PWA)

    npm install && npm start      # http://localhost:3000  (PORT で変更)

- 顧客PWA: `/`  管理画面: `/admin/`  営業ツール: `/tool/`
- 管理パスワード: `admin` (環境変数 `ADMIN_PASSWORD` で上書き)
- デモ顧客(山田 太郎) トークン: `demo-token-gentei-0001`
  - ブラウザで `localStorage.setItem('aplika.token','demo-token-gentei-0001')`
  - API: `curl -H 'x-customer-token: demo-token-gentei-0001' localhost:3000/api/me`
- データ: `data/db.json` (初回起動で自動シード + VAPID鍵自動生成。削除すると再シード)
- `ANTHROPIC_API_KEY` を設定すると AI顧客サマリーが Claude(claude-sonnet-5-5, `ANTHROPIC_MODEL` で変更可)で生成され、失敗時はルールベースにフォールバック
- `VAPID_SUBJECT` (既定 mailto:admin@example.com), `DATA_DIR` で保存先変更可
- API仕様は SPEC.md 参照。追加: `GET /api/admin/customers/:id` と、Push送信応答に `failed/removed/targets/push` を追加
