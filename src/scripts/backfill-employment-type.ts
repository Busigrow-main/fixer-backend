/**
 * One-off backfill: every existing technician without `employmentType` becomes
 * FIXXER_STAFF (all technicians so far are Fixxer-owned and admin-managed).
 * Technicians that already have employmentType are never touched.
 * Future app sign-ups get PARTNER from the schema default.
 *
 * Dry run (default):  npm run technicians:backfill-employment
 * Apply changes:      npm run technicians:backfill-employment -- --apply
 */
import mongoose from 'mongoose';
import 'dotenv/config';

async function run() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  await mongoose.connect(uri);
  const technicians = mongoose.connection.collection('technicians');

  const missing = await technicians
    .find({ employmentType: { $exists: false } }, { projection: { name: 1, phone: 1 } })
    .toArray();

  console.log(`Technicians without employmentType → FIXXER_STAFF: ${missing.length}`);
  for (const t of missing) {
    console.log(`  - ${t.name || '(no name)'} ${t.phone || ''} [${t._id}]`);
  }

  if (apply && missing.length) {
    const res = await technicians.updateMany(
      { _id: { $in: missing.map((t) => t._id) }, employmentType: { $exists: false } },
      { $set: { employmentType: 'FIXXER_STAFF', updatedAt: new Date() } },
    );
    console.log(`\nSet FIXXER_STAFF on ${res.modifiedCount} technician(s).`);
  } else if (missing.length) {
    console.log('\nDry run — re-run with --apply to update them.');
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
