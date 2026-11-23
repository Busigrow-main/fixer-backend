const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixer-test';
const client = new MongoClient(uri);

function windowForBusinessDate(businessDate) {
  const day = new Date(businessDate + 'T00:00:00.000Z');
  const start = new Date(day.getTime() - (5 * 60 + 30) * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { businessDate, start, end };
}

client.connect().then(async () => {
  const db = client.db();
  
  const dates = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
  
  for (const date of dates) {
    const window = windowForBusinessDate(date);
    console.log('\n==========', date, '==========');
    
    // Feedback
    const allFeedback = await db.collection('feedback').find({
      comment: /^P2-11-TEST/
    }).toArray();
    
    console.log('Total P2-11 feedback:', allFeedback.length);
    
    // Visits
    const allVisits = await db.collection('visits').find({
      jobDescription: /^P2-11-TEST/
    }).toArray();
    
    console.log('Total P2-11 visits:', allVisits.length);
    
    // Parts wait bookings
    const waitBookings = await db.collection('bookings').find({
      'productDetails.serialNumber': /^P2-11-TEST/,
      partsWaitEvents: { $exists: true, $ne: [] }
    }).toArray();
    
    console.log('Bookings with partsWaitEvents:', waitBookings.length);
    waitBookings.forEach(b => {
      console.log('  Booking:', b._id, 'events:', b.partsWaitEvents?.length);
      b.partsWaitEvents?.forEach(ev => console.log('   ', ev.event, new Date(ev.at).toISOString()));
    });
  }
  
  client.close();
}).catch(e => console.error(e));