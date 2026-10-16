'use strict';
// Firebase Admin init. Credentials: env FIREBASE_SERVICE_ACCOUNT (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path).
function hasCredentials() {
  return !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}
function getDb() {
  if (!hasCredentials()) {
    throw new Error('認証情報がありません: 環境変数 FIREBASE_SERVICE_ACCOUNT (サービスアカウントJSON) か GOOGLE_APPLICATION_CREDENTIALS (JSONファイルのパス) を設定してください。');
  }
  const admin = require('firebase-admin');
  let cred;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let sa;
    try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
    catch (e) { throw new Error('FIREBASE_SERVICE_ACCOUNT が正しいJSONではありません: ' + e.message); }
    cred = admin.credential.cert(sa);
  } else {
    cred = admin.credential.applicationDefault();
  }
  if (!admin.apps.length) admin.initializeApp({ credential: cred });
  return admin.firestore();
}
module.exports = { getDb, hasCredentials };
