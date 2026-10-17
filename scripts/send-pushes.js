#!/usr/bin/env node
'use strict';
// Sends queued pushes. Usage: node send-pushes.js [--dry-run]
// Env: FIREBASE_SERVICE_ACCOUNT | GOOGLE_APPLICATION_CREDENTIALS, VAPID_PRIVATE_KEY, VAPID_SUBJECT (default mailto:admin@example.com), SITE_URL.
const STALE_CLAIM_MS = 30 * 60 * 1000; // a 'sending' push older than this is considered crashed and re-claimable

function absUrl(siteUrl, url) {
  const u = String(url || '/');
  if (/^https?:\/\//i.test(u)) return u;
  const base = String(siteUrl || '').replace(/\/+$/, '');
  return base + '/' + u.replace(/^\/+/, '');
}
const intersects = (a, b) => (a || []).some((t) => (b || []).includes(t));
const targets = (customers, tags) =>
  customers.filter((c) => c.pushSub && (!tags || tags.length === 0 || intersects(c.tags, tags)));

/**
 * Pure core. store: { listPushes(), claimPush(id, nowMs)->bool, listCustomers(), clearSub(customerId), finishPush(id, fields) }
 * webpush: { sendNotification(sub, payloadString) }  (VAPID details already set by caller)
 */
async function runSend({ store, webpush, siteUrl, dryRun = false, now = () => Date.now(), log = () => {} }) {
  const result = { pushes: 0, sent: 0, failed: 0, skipped: 0 };
  const all = await store.listPushes();
  const t0 = now();
  const due = (p) => p.status === 'scheduled' && Date.parse(p.scheduledAt) <= t0; // reserved send time has arrived
  const candidates = all.filter((p) => p.status === 'queued' || due(p) ||
    (p.status === 'sending' && t0 - (p.claimedAt || 0) > STALE_CLAIM_MS));
  if (!candidates.length) { log('queued pushes: 0'); return result; }
  const customers = await store.listCustomers();
  for (const p of candidates) {
    const subs = targets(customers, p.targetTags);
    if (dryRun) {
      log(`[dry-run] push ${p.id} "${p.title}" -> ${subs.length} subscriber(s)`);
      result.pushes++; result.skipped += subs.length; continue;
    }
    if (!(await store.claimPush(p.id, now()))) { log(`push ${p.id}: already claimed, skip`); continue; }
    result.pushes++;
    const payload = JSON.stringify({ title: p.title, body: p.body, url: absUrl(siteUrl, p.url), pushId: p.id });
    let sent = 0, failed = 0;
    for (const c of subs) {
      try {
        await webpush.sendNotification(c.pushSub, payload, { TTL: 86400, urgency: 'high' }); // high: wake sleeping Android (Doze) promptly
        sent++;
      } catch (e) {
        failed++;
        const code = e && e.statusCode;
        if (code === 404 || code === 410) await store.clearSub(c.id);
        log(`  fail ${c.id}: ${code || e.message}`);
      }
    }
    await store.finishPush(p.id, { status: 'sent', sentAt: new Date(now()).toISOString(), sentCount: sent, failed });
    log(`push ${p.id}: sent ${sent}, failed ${failed}`);
    result.sent += sent; result.failed += failed;
  }
  return result;
}

function firestoreStore(db) {
  return {
    async listPushes() { return (await db.collection('pushes').get()).docs.map((d) => ({ id: d.id, ...d.data() })); },
    async listCustomers() { return (await db.collection('customers').get()).docs.map((d) => ({ id: d.id, ...d.data() })); },
    async claimPush(id, nowMs) {
      const ref = db.collection('pushes').doc(id);
      return db.runTransaction(async (t) => {
        const d = await t.get(ref); const v = d.exists ? d.data() : null;
        if (!v) return false;
        const ok = v.status === 'queued' || (v.status === 'scheduled' && Date.parse(v.scheduledAt) <= nowMs) || (v.status === 'sending' && nowMs - (v.claimedAt || 0) > STALE_CLAIM_MS);
        if (!ok) return false;
        t.update(ref, { status: 'sending', claimedAt: nowMs });
        return true;
      });
    },
    async clearSub(id) { await db.collection('customers').doc(id).set({ pushSub: null }, { merge: true }); },
    async finishPush(id, f) { await db.collection('pushes').doc(id).set(f, { merge: true }); },
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { getDb, hasCredentials } = require('./lib/admin');
  if (!hasCredentials()) { console.error('ERROR: FIREBASE_SERVICE_ACCOUNT か GOOGLE_APPLICATION_CREDENTIALS が未設定です。'); process.exit(1); }
  const siteUrl = process.env.SITE_URL || '';
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!dryRun) {
    if (!priv) { console.error('ERROR: VAPID_PRIVATE_KEY が未設定です。'); process.exit(1); }
    if (!/^https?:\/\//i.test(siteUrl)) { console.error('ERROR: SITE_URL (例 https://user.github.io/repo/) が未設定です。'); process.exit(1); }
  }
  const db = getDb();
  const webpush = require('web-push');
  if (!dryRun) {
    const pub = (await db.doc('settings/public').get()).data();
    if (!pub || !pub.vapidPublicKey) { console.error('ERROR: Firestore settings/public.vapidPublicKey がありません (node gen-vapid.js --write)。'); process.exit(1); }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub.vapidPublicKey, priv);
  }
  const r = await runSend({ store: firestoreStore(db), webpush, siteUrl, dryRun, log: console.log });
  console.log('result', JSON.stringify(r));
}

module.exports = { runSend, absUrl, targets, STALE_CLAIM_MS };
if (require.main === module) main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
