'use strict';
// node scripts/test-send.js  (no network / credentials)
const assert = require('assert');
const { runSend, absUrl, STALE_CLAIM_MS } = require('./send-pushes');

function fakeStore(pushes, customers) {
  const P = new Map(pushes.map((p) => [p.id, { ...p }])), C = new Map(customers.map((c) => [c.id, { ...c }]));
  return {
    P, C,
    async listPushes() { return [...P.values()].map((x) => ({ ...x })); },
    async listCustomers() { return [...C.values()].map((x) => ({ ...x })); },
    async claimPush(id, n) { const p = P.get(id); if (p.status === 'queued' || (p.status === 'scheduled' && Date.parse(p.scheduledAt) <= n) || (p.status === 'sending' && n - (p.claimedAt || 0) > STALE_CLAIM_MS)) { p.status = 'sending'; p.claimedAt = n; return true; } return false; },
    async clearSub(id) { C.get(id).pushSub = null; },
    async finishPush(id, f) { Object.assign(P.get(id), f); },
  };
}
const sub = (n) => ({ endpoint: 'https://push.example/' + n, keys: { p256dh: 'x', auth: 'y' } });
const customers = () => [
  { id: 'a', tags: ['VIP'], pushSub: sub('a') },
  { id: 'b', tags: ['資金計画'], pushSub: sub('b') },
  { id: 'c', tags: ['VIP'], pushSub: null },
  { id: 'gone', tags: [], pushSub: sub('gone') },
  { id: 'err', tags: [], pushSub: sub('err') },
];
function stub() {
  const calls = [];
  return { calls, async sendNotification(s, payload) {
    calls.push({ endpoint: s.endpoint, payload: JSON.parse(payload) });
    if (s.endpoint.endsWith('/gone')) throw Object.assign(new Error('Gone'), { statusCode: 410 });
    if (s.endpoint.endsWith('/err')) throw Object.assign(new Error('boom'), { statusCode: 500 });
  } };
}
(async () => {
  assert.strictEqual(absUrl('https://u.github.io/repo/', '/'), 'https://u.github.io/repo/');
  assert.strictEqual(absUrl('https://u.github.io/repo', '/x?a=1'), 'https://u.github.io/repo/x?a=1');
  assert.strictEqual(absUrl('https://u.github.io/repo/', 'https://z.com/q'), 'https://z.com/q');

  // all-target + VIP-target + non-queued ignored
  let st = fakeStore([
    { id: 'p1', title: 'T', body: 'B', url: '/', targetTags: [], status: 'queued' },
    { id: 'p2', title: 'V', body: 'B', url: '/lib', targetTags: ['VIP'], status: 'queued' },
    { id: 'p3', title: 'D', body: 'B', url: '/', targetTags: [], status: 'draft' },
    { id: 'p4', title: 'S', body: 'B', url: '/', targetTags: [], status: 'sent' },
  ], customers());
  let w = stub();
  let r = await runSend({ store: st, webpush: w, siteUrl: 'https://u.github.io/repo/' });
  assert.deepStrictEqual(r, { pushes: 2, sent: 3, failed: 2, skipped: 0 });
  assert.strictEqual(st.P.get('p1').status, 'sent');
  assert.strictEqual(st.P.get('p1').sentCount, 2);
  assert.strictEqual(st.P.get('p1').failed, 2);
  assert.ok(st.P.get('p1').sentAt);
  assert.strictEqual(st.P.get('p2').sentCount, 1);
  assert.strictEqual(st.P.get('p3').status, 'draft');
  assert.strictEqual(st.C.get('gone').pushSub, null, '410 clears sub');
  assert.ok(st.C.get('err').pushSub, '500 keeps sub');
  const first = w.calls[0].payload;
  assert.deepStrictEqual(Object.keys(first).sort(), ['body', 'pushId', 'title', 'url']);
  assert.strictEqual(first.url, 'https://u.github.io/repo/');
  assert.strictEqual(w.calls.find((c) => c.payload.pushId === 'p2').payload.url, 'https://u.github.io/repo/lib');

  // second run: nothing to do (no double send)
  w = stub();
  r = await runSend({ store: st, webpush: w, siteUrl: 'https://u.github.io/repo/' });
  assert.strictEqual(r.pushes, 0); assert.strictEqual(w.calls.length, 0);

  // overlapping runs: second claim fails
  st = fakeStore([{ id: 'p1', title: 'T', body: 'B', url: '/', targetTags: [], status: 'queued' }], customers());
  const [r1, r2] = await Promise.all([
    runSend({ store: st, webpush: stub(), siteUrl: 'https://x/' }),
    runSend({ store: st, webpush: stub(), siteUrl: 'https://x/' }),
  ]);
  assert.strictEqual(r1.pushes + r2.pushes, 1, 'exactly one run claims');

  // fresh 'sending' is not re-sent; stale 'sending' is recovered
  st = fakeStore([
    { id: 'f', title: 'T', body: 'B', url: '/', targetTags: [], status: 'sending', claimedAt: 1000 },
    { id: 's', title: 'T', body: 'B', url: '/', targetTags: [], status: 'sending', claimedAt: 1000 - STALE_CLAIM_MS - 1 },
  ], customers());
  w = stub();
  r = await runSend({ store: st, webpush: w, siteUrl: 'https://x/', now: () => 1000 });
  assert.strictEqual(r.pushes, 1); assert.strictEqual(st.P.get('s').status, 'sent'); assert.strictEqual(st.P.get('f').status, 'sending');

  // dry-run: sends nothing, changes nothing
  st = fakeStore([{ id: 'p1', title: 'T', body: 'B', url: '/', targetTags: ['VIP'], status: 'queued' }], customers());
  w = stub();
  r = await runSend({ store: st, webpush: w, siteUrl: 'https://x/', dryRun: true });
  assert.strictEqual(w.calls.length, 0); assert.strictEqual(st.P.get('p1').status, 'queued'); assert.strictEqual(r.skipped, 1);

  // scheduled pushes: not sent before the time, sent once after it
  const T = Date.parse('2026-10-20T06:00:00Z');
  st = fakeStore([
    { id: 's1', title: 'Later', body: 'B', url: '/', targetTags: [], status: 'scheduled', scheduledAt: '2026-10-20T06:30:00Z' },
    { id: 's2', title: 'Due', body: 'B', url: '/', targetTags: [], status: 'scheduled', scheduledAt: '2026-10-20T05:55:00Z' },
  ], customers());
  w = stub();
  r = await runSend({ store: st, webpush: w, siteUrl: 'https://x/', now: () => T });
  assert.strictEqual(r.pushes, 1); assert.strictEqual(st.P.get('s1').status, 'scheduled'); assert.strictEqual(st.P.get('s2').status, 'sent');
  r = await runSend({ store: st, webpush: stub(), siteUrl: 'https://x/', now: () => T + 31 * 60000 });
  assert.strictEqual(r.pushes, 1); assert.strictEqual(st.P.get('s1').status, 'sent');
  r = await runSend({ store: st, webpush: stub(), siteUrl: 'https://x/', now: () => T + 60 * 60000 });
  assert.strictEqual(r.pushes, 0, 'never sent twice');

  console.log('test-send: all OK');
})().catch((e) => { console.error(e); process.exit(1); });
