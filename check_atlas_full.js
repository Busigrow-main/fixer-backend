const { MongoClient } = require('mongodb');
const uri = '***REMOVED***';
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
    const inWindow = { $gte: window.start, $lt: window.end };
    
    const earnings = await db.collection('earnings').find({ earnedAt: inWindow }).toArray();
    const settlements = await db.collection('settlements').find({ settlementDate: date }).toArray();
    const feedback = await db.collection('feedback').find({}).toArray();
    const visits = await db.collection('visits').find({}).toArray();
    
    console.log(date, 'earnings:', earnings.length, 'settlements:', settlements.length);
  }
  
  // Check technicians
  const techs = await db.collection('technicians').find({}).toArray();
  console.log('\nTechnicians:', techs.length);
  techs.forEach(t => console.log('  ', t.name, t.phone));
  
  client.close();
}).catch(e => console.error(e));