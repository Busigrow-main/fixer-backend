/**
 * Seed script — AC Appliances 2026 Stock
 * Run: node src/scripts/seed-appliances.js
 *
 * Pricing formula: price = Math.round(nlc * 1.18 + 1000)
 * MRP (originalPrice) = Math.round(price * 1.18)
 */

'use strict';
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';

const PLACEHOLDER_IMAGES = {
  split: [
    'https://images.unsplash.com/photo-1621619856624-42fd193a0661?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&h=800&fit=crop',
  ],
  fixedSpeed: [
    'https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&h=800&fit=crop',
  ],
};

function calcPrice(nlc) {
  const price = Math.round(nlc * 1.18 + 1000);
  const originalPrice = Math.round(price * 1.18);
  return { price, originalPrice, nlcPrice: nlc };
}

function roomSize(ton) {
  if (ton <= 1.0) return 'Up to 100 sq. ft.';
  if (ton <= 1.5) return '100 – 160 sq. ft.';
  if (ton <= 1.7) return '150 – 180 sq. ft.';
  if (ton <= 2.0) return '180 – 240 sq. ft.';
  if (ton <= 2.5) return '240 – 300 sq. ft.';
  return '300 – 360 sq. ft.';
}

function buildDescription(name, ton, stars, isInverter) {
  const techLabel = isInverter ? 'Inverter' : 'Fixed Speed';
  return `<p>The <strong>${name}</strong> is a premium Godrej ${ton}T ${stars}-Star ${techLabel} Split AC engineered for Indian summers. ` +
    (isInverter
      ? 'Its variable-speed inverter compressor adapts cooling output to room load, cutting energy consumption by up to 40% vs fixed-speed models.'
      : 'Its reliable fixed-speed compressor delivers consistent cooling performance at an accessible price point.') +
    `</p>
<ul>
<li>BEE ${stars}-Star rated — ${stars === 5 ? 'highest' : 'standard'} energy efficiency class</li>
<li>${isInverter ? 'Inverter compressor for variable-speed, silent operation' : 'Robust fixed-speed compressor for consistent cooling'}</li>
<li>R-32 eco-friendly refrigerant with low global warming potential</li>
<li>Auto-restart after power cut — retains last settings</li>
<li>Ideal for rooms of ${roomSize(ton)}</li>
</ul>`;
}

function buildHighlights(isInverter, stars) {
  const h = [
    { icon: 'bolt', title: `${stars}-Star BEE Rated`, description: `${stars === 5 ? 'Highest' : 'Standard'} BEE energy efficiency certification` },
    { icon: 'eco', title: 'R-32 Refrigerant', description: 'Eco-friendly coolant with low GWP' },
    { icon: 'autorenew', title: 'Auto-Restart', description: 'Resumes operation after power interruption' },
    { icon: 'verified', title: 'Free Installation', description: 'Certified Fixxer technicians included' },
  ];
  if (isInverter) {
    h.push({ icon: 'speed', title: 'Inverter Technology', description: 'Variable speed for energy savings up to 40%' });
    h.push({ icon: 'volume_off', title: 'Silent Operation', description: 'Whisper-quiet inverter motor' });
  } else {
    h.push({ icon: 'thermostat', title: 'Precise Cooling', description: 'Consistent temperature control' });
  }
  return h;
}

// Raw stock data from AC SKU 2026
const RAW_STOCK = [
  { sku: '40101701SD01777', desc: 'AC 1.5T DS WIC 18F5TG WA',   nlc: 32089, stars: 5, type: 'Inverter',    series: 'WIC', code: '18F5TG' },
  { sku: '40101701SD01759', desc: 'AC 1.0T DS HIC 12Q3TH WA',   nlc: 29514, stars: 3, type: 'Inverter',    series: 'HIC', code: '12Q3TH' },
  { sku: '40101701SD01765', desc: 'AC 1.0T DS HIC 12Q5TH WA',   nlc: 34051, stars: 5, type: 'Inverter',    series: 'HIC', code: '12Q5TH' },
  { sku: '40101701SD01906', desc: 'AC 1.5T DS HIC 18Q3TG WA 4', nlc: 31500, stars: 3, type: 'Inverter',    series: 'HIC', code: '18Q3TG' },
  { sku: '40101701SD01900', desc: 'AC 1.5T DS HFC 18R2TH WA',   nlc: 35504, stars: 3, type: 'Fixed Speed', series: 'HFC', code: '18R2TH' },
  { sku: '40101701SD01744', desc: 'AC 1.5T DS HIC 18J5TG WA',   nlc: 38000, stars: 5, type: 'Inverter',    series: 'HIC', code: '18J5TG' },
  { sku: '40101701SD01774', desc: 'AC 1.5T DS HIC 19J5TG WA',   nlc: 38000, stars: 5, type: 'Inverter',    series: 'HIC', code: '19J5TG' },
  { sku: '40101701SD01909', desc: 'AC 1.7T DS HIC 20J5TG WA',   nlc: 39913, stars: 5, type: 'Inverter',    series: 'HIC', code: '20J5TG' },
  { sku: '40101701SD01740', desc: 'AC 2.0T DS HIC 24J3TS WA',   nlc: 40092, stars: 3, type: 'Inverter',    series: 'HIC', code: '24J3TS' },
  { sku: '40101701SD01892', desc: 'AC 2.0T DS HFC 24K2TG WA',   nlc: 41009, stars: 3, type: 'Fixed Speed', series: 'HFC', code: '24K2TG' },
  { sku: '40101701SD01751', desc: 'AC 2.5T DS HIC 30K3TG RA 4', nlc: 48859, stars: 3, type: 'Inverter',    series: 'HIC', code: '30K3TG' },
  { sku: '40101701SD01801', desc: 'AC 3.0T DS HIC 36B3TH WA 4', nlc: 55053, stars: 3, type: 'Inverter',    series: 'HIC', code: '36B3TH' },
];

function parseTon(desc) {
  const m = desc.match(/AC\s+([\d.]+)T/);
  return m ? parseFloat(m[1]) : 1.5;
}

function toSlug(ton, stars, isInverter, code) {
  const typeStr = isInverter ? 'inverter' : 'fixed-speed';
  return `godrej-${String(ton).replace('.', '-')}t-${stars}s-${typeStr}-split-${code.toLowerCase()}`;
}

function toName(ton, stars, isInverter, series) {
  return `Godrej ${ton} Ton ${stars} Star ${isInverter ? 'Inverter' : 'Fixed Speed'} Split AC (${series})`;
}

function buildProduct(row) {
  const ton = parseTon(row.desc);
  const isInverter = row.type === 'Inverter';
  const { price, originalPrice, nlcPrice } = calcPrice(row.nlc);
  const slug = toSlug(ton, row.stars, isInverter, row.code);
  const name = toName(ton, row.stars, isInverter, row.series);
  const images = isInverter ? PLACEHOLDER_IMAGES.split : PLACEHOLDER_IMAGES.fixedSpeed;

  return {
    slug,
    name,
    brand: 'Godrej',
    modelNumber: row.code,
    sku: row.sku,
    series: row.series,
    price,
    originalPrice,
    nlcPrice,
    capacityTon: ton,
    starRating: row.stars,
    acType: 'split',
    isInverter,
    roomSizeRecommendation: roomSize(ton),
    description: buildDescription(name, ton, row.stars, isInverter),
    shortDescription: `Godrej ${ton}T ${row.stars}-Star ${row.type} Split AC — ${row.series} series.`,
    images,
    specsPerformance: {
      refrigerant: 'R-32',
      compressorType: isInverter ? 'Inverter' : 'Fixed Speed',
      ambientTempRangeC: '15°C to 52°C',
    },
    specsSmart: {
      sleepMode: true,
      selfDiagnosis: true,
      wifiEnabled: false,
      autoCleanEnabled: false,
      operatingModes: ['Cool', 'Dry', 'Fan', 'Auto', 'Sleep'],
    },
    highlights: buildHighlights(isInverter, row.stars),
    whatsInBox: ['Indoor Unit', 'Outdoor Unit', 'Remote Control', 'Connecting Pipe', 'User Manual'],
    inStock: true,
    installationIncluded: true,
    compressorWarrantyYears: 10,
    productWarrantyYears: 1,
    applianceCategory: 'ac',
    isActive: true,
  };
}

async function main() {
  console.log(`🔌 Connecting to MongoDB: ${MONGO_URI}`);
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const col = db.collection('appliances');

  const deleted = await col.deleteMany({});
  console.log(`🗑  Deleted ${deleted.deletedCount} existing appliance documents`);

  const docs = RAW_STOCK.map(buildProduct);
  const result = await col.insertMany(docs);
  console.log(`🌱 Inserted ${result.insertedCount} appliances:`);
  docs.forEach((d) => console.log(`   ✔ ${d.slug}`));

  await client.close();
  console.log('👋 Done');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
