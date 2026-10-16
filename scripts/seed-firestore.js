#!/usr/bin/env node
'use strict';
// Usage: node seed-firestore.js [--dry-run] [--no-demo] [--force]
//   --dry-run  print counts only (no credentials needed)
//   --no-demo  skip demo customers/events/personalFiles/conversions (production)
//   --force    overwrite existing docs (set merge). Default: existing docs are left untouched,
//              so re-running never reverts edits made in the admin UI.
// Credentials: env FIREBASE_SERVICE_ACCOUNT (JSON) or GOOGLE_APPLICATION_CREDENTIALS (file).
const { seedForFirestore } = require('./lib/seed-data');
const args = new Set(process.argv.slice(2));
const dry = args.has('--dry-run'), force = args.has('--force');
const data = seedForFirestore({ demo: !args.has('--no-demo') });

const plan = [
  ['property', [{ ...data.property, id: 'main' }]],
  ['tags', data.tags],
  ['contents', data.contents],
  ['pushes', data.pushes],
  ['personalFiles', data.personalFiles],
  ['customers', data.customers],
  ['events', data.events],
  ['conversions', data.conversions],
];

async function main() {
  console.log(`seed (version ${data.seedVersion}) demo=${!args.has('--no-demo')}${dry ? ' [dry-run]' : ''}`);
  if (dry) {
    for (const [col, docs] of plan) console.log(`  ${col}: ${docs.length}`);
    console.log('  settings/public: (VAPIDは gen-vapid.js --write で作成)');
    return;
  }
  const db = require('./lib/admin').getDb();
  for (const [col, docs] of plan) {
    let written = 0, skipped = 0;
    for (let i = 0; i < docs.length; i += 200) {
      const part = docs.slice(i, i + 200);
      const refs = part.map((d) => db.collection(col).doc(d.id));
      const snaps = await db.getAll(...refs);
      const batch = db.batch();
      part.forEach((d, j) => {
        if (snaps[j].exists && !force) { skipped++; return; }
        batch.set(refs[j], JSON.parse(JSON.stringify(d)), { merge: true });
        written++;
      });
      await batch.commit();
    }
    console.log(`  ${col}: written ${written}, skipped(existing) ${skipped}`);
  }
  console.log('done.');
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
