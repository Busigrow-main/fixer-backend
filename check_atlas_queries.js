
require('dotenv').config();

const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error('MONGO_URI is missing from environment variables');
}

const client = new MongoClient(uri);

function windowForBusinessDate(businessDate) {
  const day = new Date(businessDate + 'T00:00:00.000Z');
  const start = new Date(day.getTime() - (5 * 60 + 30) * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { businessDate, start, end };
}

async function main() {
  try {
    await client.connect();

    const db = client.db();

    const dates = [
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ];

    for (const date of dates) {
      const window = windowForBusinessDate(date);
      const inWindow = { $gte: window.start, $lt: window.end };

      const created = await db.collection('bookings')
        .find({ createdAt: inWindow }).toArray();

      const completed = await db.collection('bookings').find({
        jobClosed: true,
        jobClosedAt: inWindow,
        status: { $ne: 'CANCELLED' },
      }).toArray();

      console.log(
        date,
        'created:', created.length,
        'completed:', completed.length
      );
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);