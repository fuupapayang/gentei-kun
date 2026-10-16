#!/usr/bin/env node
'use strict';
// Usage: node gen-vapid.js [--write]
// Prints a VAPID keypair. --write stores ONLY the public key in Firestore settings/public {vapidPublicKey}.
// Put the private key into the GitHub secret VAPID_PRIVATE_KEY (it is shown only once, never stored).
const webpush = require('web-push');
const write = process.argv.includes('--write');
(async () => {
  const k = webpush.generateVAPIDKeys();
  if (write) {
    const { getDb } = require('./lib/admin');
    const db = getDb();
    await db.doc('settings/public').set({ vapidPublicKey: k.publicKey, updatedAt: new Date().toISOString() }, { merge: true });
    console.log('Firestore settings/public.vapidPublicKey を書き込みました。\n');
  } else {
    console.log('(--write なし: Firestore には書き込みません)\n');
  }
  console.log('VAPID_PUBLIC_KEY  = ' + k.publicKey);
  console.log('VAPID_PRIVATE_KEY = ' + k.privateKey);
  console.log('\n秘密鍵は今回しか表示しません。GitHub のシークレット VAPID_PRIVATE_KEY に登録してください。');
  console.log('注意: 鍵を作り直すと既存の購読(pushSub)は無効になります。');
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
