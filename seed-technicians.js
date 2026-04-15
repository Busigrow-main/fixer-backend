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
        availabilityStatus: 'AVAILABLE',
        averageRating: 4.8,
        totalCompletedJobs: 142,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Rahul Verma',
        phone: '9876543211',
        email: 'rahul.verma@example.com',
        skills: ['AC Repair', 'Geyser'],
        isActive: true,
        availabilityStatus: 'AVAILABLE',
        averageRating: 4.6,
        totalCompletedJobs: 89,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Suresh Kumar',
        phone: '9876543212',
        email: 'suresh.kumar@example.com',
        skills: ['Microwave', 'Chimney'],
        isActive: true,
        availabilityStatus: 'ON_JOB',
        averageRating: 4.9,
        totalCompletedJobs: 215,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Vikram Singh',
        phone: '9876543213',
        email: 'vikram.singh@example.com',
        skills: ['Water Purifier', 'AC Repair'],
        isActive: true,
        availabilityStatus: 'UNAVAILABLE',
        averageRating: 4.2,
        totalCompletedJobs: 45,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Deepak Patel',
        phone: '9876543214',
        email: 'deepak.patel@example.com',
        skills: ['Refrigerator', 'Microwave', 'Washing Machine'],
        isActive: true,
        availabilityStatus: 'AVAILABLE',
        averageRating: 4.7,
        totalCompletedJobs: 176,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const result = await techniciansCollection.insertMany(technicians);
    console.log(`Successfully seeded ${result.insertedCount} technicians`);

  } catch (error) {
    console.error('Error seeding technicians:', error);
  } finally {
    await client.close();
  }
}

seedTechnicians();
