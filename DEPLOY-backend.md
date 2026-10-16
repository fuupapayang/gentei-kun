# DEPLOY-backend.md (Firebase half; to be merged into DEPLOY.md)

Back end = Firestore + one 2nd-gen Cloud Function `api` (asia-northeast1, Node 22) in `functions/`.
Project id placeholder: `gentei-kun-escon` (in `.firebaserc`; replace with the real id if different).

## 1. Create the Firebase project (console, one time)
1. https://console.firebase.google.com -> Add project -> id `gentei-kun-escon` (or your own; then `firebase use <id>` / edit `.firebaserc`).
2. Upgrade to the **Blaze** plan (required for Cloud Functions 2nd gen and Secret Manager). Set a budget alert.
3. Build -> **Firestore Database** -> Create database -> *Production mode*, location **asia-northeast1 (Tokyo)**.
4. (Optional) disable Google Analytics; not needed.

## 2. Local tooling
```
npm i -g firebase-tools        # v15+
firebase login
cd aplika
(cd functions && npm install)
firebase use gentei-kun-escon  # or your project id
```

## 3. Secrets / params
- **ADMIN_PASSWORD** (required, secret; there is NO default; login returns 503 until set):
  `firebase functions:secrets:set ADMIN_PASSWORD`  (paste a strong password)
- **ALLOWED_ORIGINS** (CORS, comma separated, no trailing slash, origin only - no path):
  create `functions/.env.gentei-kun-escon` containing
  `ALLOWED_ORIGINS=https://<github-user>.github.io`
  (add `,http://localhost:3000` if you want local front -> deployed API). If left empty, browsers are blocked by CORS. `deploy` prompts for it if the file is missing.
- VAPID_SUBJECT (optional): `VAPID_SUBJECT=mailto:you@example.com` in the same .env file.
- ANTHROPIC_API_KEY (optional, AI summary via Claude): not wired as a secret by default; rule-based summary is used.
- VAPID keys are generated automatically on the first request and stored in Firestore `settings/main`. Do not delete that doc after users subscribed (their subscriptions would break).

## 4. Deploy
```
firebase deploy --only firestore:rules,functions
```
Output prints the function URL, e.g. `https://asia-northeast1-gentei-kun-escon.cloudfunctions.net/api` (also `https://api-<hash>-an.a.run.app`).
Use `https://asia-northeast1-<project>.cloudfunctions.net/api` as `apiBase` for the front-end build (the API accepts paths both with and without a leading `/api`, e.g. `<apiBase>/api/register` and `<apiBase>/register`).

## 5. Verify
```
API=https://asia-northeast1-gentei-kun-escon.cloudfunctions.net/api
curl $API/api/property                      # first call seeds Firestore (a few seconds)
curl -X POST $API/api/admin/login -H 'content-type: application/json' -d '{"password":"<ADMIN_PASSWORD>"}'
```
Demo customer token (from seed): `demo-token-gentei-0001`.

## Notes
- Firestore rules deny all client access; everything goes through the function (Admin SDK).
- Collections: `tags contents customers personalFiles pushes events conversions adminSessions` (doc id = entity id), plus singleton docs `property/main`, `settings/main` (VAPID), `meta/main` (seedVersion) and `meta/lock-seed`. Admin sessions are stored hashed (sha256) with 7-day expiry.
- Seeding runs on the first request when `meta/main` is missing; bumping SEED_VERSION in `functions/lib/seed.js` refreshes property/contents/pushes only (like lib/db.js).
- Changing ADMIN_PASSWORD: set the secret again, then `firebase deploy --only functions`. Existing admin sessions stay valid until expiry (delete the `adminSessions` docs to force logout).
- Cost control: `maxInstances: 10`; events are not capped (server.js caps at 100k).
- Tests (no deploy, no Java): `cd functions && npm test` (Express app against an in-memory store fake). Full emulator run needs Java for the Firestore emulator: `firebase emulators:start --only functions,firestore` (ports 3295/3296 in firebase.json); put a dummy `ADMIN_PASSWORD=x` in `functions/.secret.local` for local.
