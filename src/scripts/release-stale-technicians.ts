/**
 * One-off repair: technicians left ON_JOB after their job was cancelled (before
 * cancellation released technicians) are put back to AVAILABLE.
 *
 * A technician is reset only when they have NO booking that occupies them
 * (not CANCELLED / COMPLETED / PAYMENT_COLLECTED / RESCHEDULED, and not DECLINED).
 *
 * Also recomputes every technician's totalCompletedJobs from their bookings
 * (it used to be a +1 counter that missed admin-closed jobs).
 *
 * Also lists technicians that are active but not ID-verified (e.g. created from
 * admin before admin-create marked them verified) — these are reported, not changed.
 *
 * Dry run (default):  npm run technicians:release-stale
 * Apply changes:      npm run technicians:release-stale -- --apply
 */
import mongoose from 'mongoose';
import 'dotenv/config';

const NON_OCCUPYING = ['CANCELLED', 'COMPLETED', 'PAYMENT_COLLECTED', 'RESCHEDULED'];

async function run() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  await mongoose.connect(uri);
  const technicians = mongoose.connection.collection('technicians');
  const bookings = mongoose.connection.collection('bookings');

  const onJob = await technicians
    .find({ availabilityStatus: 'ON_JOB' }, { projection: { name: 1, phone: 1, employmentType: 1 } })
    .toArray();

  const stale: typeof onJob = [];
  for (const tech of onJob) {
    // Fixxer staff hold future ASSIGNED slots; for them only a job in progress is "on job".
    const active = await bookings.findOne({
      technicianId: tech._id,
      status:
        tech.employmentType === 'FIXXER_STAFF'
          ? { $in: ['EN_ROUTE', 'IN_PROGRESS'] }
          : { $nin: NON_OCCUPYING },
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

  // totalCompletedJobs: recompute from bookings.
  const counts = await bookings
    .aggregate<{ _id: unknown; n: number }>([
      { $match: { technicianId: { $ne: null }, status: { $in: ['COMPLETED', 'PAYMENT_COLLECTED'] } } },
      { $group: { _id: '$technicianId', n: { $sum: 1 } } },
    ])
    .toArray();
  const countById = new Map(counts.map((c) => [String(c._id), c.n]));
  const allTechs = await technicians
    .find({}, { projection: { name: 1, totalCompletedJobs: 1 } })
    .toArray();
  const wrongCounts = allTechs.filter(
    (t) => Number(t.totalCompletedJobs || 0) !== (countById.get(String(t._id)) || 0),
  );
  console.log(`\nCompleted-jobs count wrong for ${wrongCounts.length} technician(s)`);
  for (const t of wrongCounts) {
    console.log(
      `  - ${t.name || '(no name)'}: stored ${t.totalCompletedJobs || 0}, actual ${countById.get(String(t._id)) || 0}`,
    );
  }
  if (apply && wrongCounts.length) {
    for (const t of wrongCounts) {
      await technicians.updateOne(
        { _id: t._id },
        { $set: { totalCompletedJobs: countById.get(String(t._id)) || 0, updatedAt: new Date() } },
      );
    }
    console.log(`Fixed ${wrongCounts.length} completed-jobs count(s).`);
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
