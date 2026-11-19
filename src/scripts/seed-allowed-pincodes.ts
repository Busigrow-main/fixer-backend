/**
 * Set the ONLY active pincodes, for both:
 *   - serviceablepincodes  (customer bookings, shop checkout, installation)
 *   - allowedpincodes      (technician onboarding)
 * Listed pincodes are upserted as active; every other pincode is deactivated (not deleted).
 *
 * Usage: npx ts-node -r tsconfig-paths/register -r dotenv/config src/scripts/seed-allowed-pincodes.ts
 */
import mongoose from 'mongoose';

const PINCODES = [
  { pincode: '800014', city: 'Patna', state: 'Bihar' },
  { pincode: '800025', city: 'Patna', state: 'Bihar' },
];

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  await mongoose.connect(uri);
  const codes = PINCODES.map((p) => p.pincode);
  const now = new Date();

  for (const name of ['serviceablepincodes', 'allowedpincodes']) {
    const collection = mongoose.connection.collection(name);
    for (const entry of PINCODES) {
      await collection.updateOne(
        { pincode: entry.pincode },
        { $set: { ...entry, isActive: true, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
    }
    const off = await collection.updateMany(
      { pincode: { $nin: codes }, isActive: { $ne: false } },
      { $set: { isActive: false, updatedAt: now } },
    );
    console.log(`${name}: active = ${codes.join(', ')}; deactivated ${off.modifiedCount} others`);
  }
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
