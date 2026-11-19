/**
 * One-off repair: technicians left ON_JOB after their job was cancelled (before
 * cancellation released technicians) are put back to AVAILABLE.
 *
 * A technician is reset only when they have NO booking that is still active
 * (not CANCELLED / COMPLETED / PAYMENT_COLLECTED, and not DECLINED by them).
 *
 * Also lists technicians that are active but not ID-verified (e.g. created from
 * admin before admin-create marked them verified) — these are reported, not changed.
 *
 * Dry run (default):  npm run technicians:release-stale
 * Apply changes:      npm run technicians:release-stale -- --apply
 */
import mongoose from 'mongoose';
import 'dotenv/config';

const TERMINAL = ['CANCELLED', 'COMPLETED', 'PAYMENT_COLLECTED'];

async function run() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  await mongoose.connect(uri);
  const technicians = mongoose.connection.collection('technicians');
  const bookings = mongoose.connection.collection('bookings');

  const onJob = await technicians
    .find({ availabilityStatus: 'ON_JOB' }, { projection: { name: 1, phone: 1 } })
    .toArray();

  const stale: typeof onJob = [];
  for (const tech of onJob) {
    const active = await bookings.findOne({
      technicianId: tech._id,
      status: { $nin: TERMINAL },
      assignmentStatus: { $ne: 'DECLINED' },
    });
    if (!active) stale.push(tech);
  }

  console.log(`ON_JOB technicians: ${onJob.length}; stuck with no active job: ${stale.length}`);
  for (const t of stale) console.log(`  - ${t.name || '(no name)'} ${t.phone || ''} [${t._id}]`);

  if (apply && stale.length) {
    const res = await technicians.updateMany(
      { _id: { $in: stale.map((t) => t._id) }, availabilityStatus: 'ON_JOB' },
      { $set: { availabilityStatus: 'AVAILABLE', updatedAt: new Date() } },
    );
    console.log(`Reset ${res.modifiedCount} technician(s) to AVAILABLE.`);
  } else if (stale.length) {
    console.log('Dry run — re-run with --apply to reset them.');
  }

  const unverified = await technicians
    .find(
      { isActive: true, idVerified: { $ne: true } },
      { projection: { name: 1, phone: 1, onboardingStatus: 1 } },
    )
    .toArray();
  if (unverified.length) {
    console.log(
      `\nActive but NOT ID-verified (blocked from technician app / dispatch): ${unverified.length}`,
    );
    for (const t of unverified) {
      console.log(`  - ${t.name || '(no name)'} ${t.phone || ''} onboarding=${t.onboardingStatus} [${t._id}]`);
    }
    console.log('Verify these from the admin verification screen if they should be live.');
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
