/**
 * Seed allowed pincodes for technician onboarding.
 * Usage: npx ts-node -r tsconfig-paths/register -r dotenv/config src/scripts/seed-allowed-pincodes.ts
 */
import mongoose from 'mongoose';

const PINCODES = Array.from({ length: 29 }, (_, index) => ({
  pincode: String(800001 + index),
  city: 'Patna',
}));

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
