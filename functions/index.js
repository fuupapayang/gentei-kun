'use strict';
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { createApp } = require('./app');
const { firestoreStore } = require('./lib/store');

admin.initializeApp();
const db = admin.firestore();

// Secret: `firebase functions:secrets:set ADMIN_PASSWORD`. Login is refused (503) when unset/empty.
const ADMIN_PASSWORD = defineSecret('ADMIN_PASSWORD');
// Comma separated, e.g. https://<user>.github.io  (set in functions/.env.<projectId> or prompted at deploy)
const ALLOWED_ORIGINS = defineString('ALLOWED_ORIGINS', { default: '' });
const VAPID_SUBJECT = defineString('VAPID_SUBJECT', { default: 'mailto:admin@example.com' });

const app = createApp({
  store: firestoreStore(db),
  getAdminPassword: () => { try { return ADMIN_PASSWORD.value(); } catch (e) { return undefined; } },
  getAllowedOrigins: () => String(ALLOWED_ORIGINS.value() || '').split(',').map((x) => x.trim()).filter(Boolean),
  getVapidSubject: () => VAPID_SUBJECT.value() || 'mailto:admin@example.com',
});

exports.api = onRequest(
  { region: 'asia-northeast1', secrets: [ADMIN_PASSWORD], memory: '512MiB', timeoutSeconds: 60, maxInstances: 10, invoker: 'public', cors: false },
  app,
);
