const { MongoClient } = require('mongodb');

async function seedTechnicians() {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('fixxer');
    const techniciansCollection = db.collection('technicians');

    const technicians = [
      {
        name: 'Amit Sharma',
        phone: '9876543210',
        email: 'amit.sharma@example.com',
        skills: ['Washing Machine', 'Refrigerator'],
        isActive: true,
        idVerified: true,
        verificationStatus: 'VERIFIED',
        availabilityStatus: 'AVAILABLE',
        averageRating: 4.8,
        totalCompletedJobs: 142,
      },
      {
        name: 'Rahul Verma',
        phone: '9876543211',
        email: 'rahul.verma@example.com',
        skills: ['AC Repair', 'Geyser'],
        isActive: true,
        idVerified: true,
        verificationStatus: 'VERIFIED',
        availabilityStatus: 'AVAILABLE',
        averageRating: 4.6,
        totalCompletedJobs: 89,
      },
      {
        name: 'Suresh Kumar',
        phone: '9876543212',
        email: 'suresh.kumar@example.com',
        skills: ['Microwave', 'Chimney'],
        isActive: true,
        idVerified: true,
        verificationStatus: 'VERIFIED',
        availabilityStatus: 'ON_JOB',
        averageRating: 4.9,
        totalCompletedJobs: 215,
      },
      {
        name: 'Vikram Singh',
        phone: '9876543213',
        email: 'vikram.singh@example.com',
        skills: ['Water Purifier', 'AC Repair'],
        isActive: true,
        idVerified: true,
        verificationStatus: 'VERIFIED',
        availabilityStatus: 'UNAVAILABLE',
        averageRating: 4.2,
        totalCompletedJobs: 45,
      },
      {
        name: 'Deepak Patel',
        phone: '9876543214',
        email: 'deepak.patel@example.com',
        skills: ['Refrigerator', 'Microwave', 'Washing Machine'],
        isActive: true,
        idVerified: true,
        verificationStatus: 'VERIFIED',
        availabilityStatus: 'AVAILABLE',
        averageRating: 4.7,
        totalCompletedJobs: 176,
      },
    ];

    const now = new Date();
    const ops = technicians.map((tech) => ({
      updateOne: {
        filter: { phone: tech.phone },
        update: {
          $set: { ...tech, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    }));

    // Mark every technician in DB as ID verified (seeded + any others).
    const bulk = await techniciansCollection.bulkWrite(ops);
    const verifiedAll = await techniciansCollection.updateMany(
      {},
      {
        $set: {
          idVerified: true,
          verificationStatus: 'VERIFIED',
          updatedAt: now,
        },
      },
    );

    console.log(
      `Seed upserted: matched ${bulk.matchedCount}, upserted ${bulk.upsertedCount}; idVerified set on ${verifiedAll.modifiedCount} technicians`,
    );
  } catch (error) {
    console.error('Error seeding technicians:', error);
  } finally {
    await client.close();
  }
}

seedTechnicians();
