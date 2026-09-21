import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const serviceablePincodes = [
  '800001',
  '800002',
  '800003',
  '800004',
  '800005',
  '800006',
  '800007',
  '800008',
  '800009',
  '800010',
  '800011',
  '800012',
  '800013',
  '800014',
  '800015',
  '800016',
  '800017',
  '800018',
  '800019',
  '800020',
  '800021',
  '800022',
  '800023',
  '800024',
  '800025',
  '800026',
  '800027',
  '800028',
  '800029',
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in .env');
    }

    await mongoose.connect(mongoUri);

    console.log('MongoDB connected');

    // Get the exact collection used by NestJS
    const collection = mongoose.connection.collection(
      'serviceablepincodes',
    );

    console.log(
      'Seed database:',
      mongoose.connection.db?.databaseName,
    );

    console.log(
      'Seed collection:',
      collection.collectionName,
    );

    // Unique index on pincode
    await collection.createIndex(
      { pincode: 1 },
      { unique: true },
    );

    // Seed / update pincodes
    for (const pincode of serviceablePincodes) {
      await collection.updateOne(
        { pincode },
        {
          $set: {
            pincode,
            city: 'Patna',
            state: 'Bihar',
            isActive: true,
          },
        },
        {
          upsert: true,
        },
      );
    }

    // Verify how many documents exist
    const count = await collection.countDocuments();

    console.log(
      `Successfully seeded ${serviceablePincodes.length} serviceable pincodes.`,
    );

    console.log(
      `Total documents in serviceablepincodes: ${count}`,
    );

    // Verify 800001 specifically
    const testPincode = await collection.findOne({
      pincode: '800001',
      isActive: true,
    });

    console.log(
      '800001 verification:',
      testPincode,
    );
  } catch (error) {
    console.error('Pincode seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();