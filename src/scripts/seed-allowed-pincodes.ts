/**
 * Seed allowed pincodes for technician onboarding.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/seed-allowed-pincodes.ts
 */
import mongoose from 'mongoose';

const PINCODES = [
  { pincode: '700091', city: 'Kolkata' },
  { pincode: '700001', city: 'Kolkata' },
  { pincode: '110001', city: 'New Delhi' },
  { pincode: '400001', city: 'Mumbai' },
  { pincode: '560001', city: 'Bengaluru' },
];

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  await mongoose.connect(uri);

  const collection = mongoose.connection.collection('allowedpincodes');
  for (const entry of PINCODES) {
    await collection.updateOne(
      { pincode: entry.pincode },
      { $set: { ...entry, isActive: true } },
      { upsert: true },
    );
  }

  console.log(`Seeded ${PINCODES.length} allowed pincodes`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
