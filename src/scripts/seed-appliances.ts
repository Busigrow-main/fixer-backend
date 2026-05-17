/**
 * Seed script — AC Appliances 2026 Stock
 * Run: npm run seed:appliances
 *
 * Loads from src/scripts/data/ac-stock-2026.json when present;
 * otherwise builds all 12 SKUs from inline stock data.
 *
 * Pricing: price = Math.round(nlc * 1.18 + 1000)
 *          originalPrice = Math.round(price * 1.18)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Appliance, ApplianceSchema } from '../appliances/schemas/appliance.schema';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATA_JSON = path.resolve(__dirname, 'data/ac-stock-2026.json');

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

const SECTION_IMAGES = {
  lifestyle: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=800&fit=crop',
  detail: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1200&h=800&fit=crop',
  install: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=1200&h=800&fit=crop',
  banner: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600&h=500&fit=crop',
  fullWidth: 'https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=1600&h=900&fit=crop',
};

type DescriptionSectionType =
  | 'hero'
  | 'image_text'
  | 'feature_grid'
  | 'banner'
  | 'html'
  | 'image_full';

interface DescriptionSection {
  type: DescriptionSectionType;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt?: string;
  html?: string;
  features?: { icon: string; title: string; description: string }[];
  order?: number;
}

interface TechnicalDescription {
  sections: { title: string; specs: { label: string; value: string }[] }[];
}

interface StockRow {
  sku: string;
  desc: string;
  nlc: number;
  stars: number;
  type: 'Inverter' | 'Fixed Speed';
  series: string;
  code: string;
}

interface SeedProduct {
  slug: string;
  name: string;
  brand: string;
  modelNumber: string;
  sku: string;
  series: string;
  descriptionCode: string;
  price: number;
  originalPrice: number;
  nlcPrice: number;
  capacityTon: number;
  starRating: number;
  acType: string;
  isInverter: boolean;
  roomSizeRecommendation: string;
  description?: string;
  shortDescription: string;
  images: string[];
  descriptionSections: DescriptionSection[];
  technicalDescription: TechnicalDescription;
  specsPerformance: Record<string, unknown>;
  specsSmart: Record<string, unknown>;
  highlights: { icon: string; title: string; description: string }[];
  whatsInBox: string[];
  inStock: boolean;
  installationIncluded: boolean;
  compressorWarrantyYears: number;
  productWarrantyYears: number;
  applianceCategory: string;
  isActive: boolean;
}

const RAW_STOCK: StockRow[] = [
  { sku: '40101701SD01777', desc: 'AC 1.5T DS WIC 18F5TG WA', nlc: 32089, stars: 5, type: 'Inverter', series: 'WIC', code: '18F5TG' },
  { sku: '40101701SD01759', desc: 'AC 1.0T DS HIC 12Q3TH WA', nlc: 29514, stars: 3, type: 'Inverter', series: 'HIC', code: '12Q3TH' },
  { sku: '40101701SD01765', desc: 'AC 1.0T DS HIC 12Q5TH WA', nlc: 34051, stars: 5, type: 'Inverter', series: 'HIC', code: '12Q5TH' },
  { sku: '40101701SD01906', desc: 'AC 1.5T DS HIC 18Q3TG WA 4', nlc: 31500, stars: 3, type: 'Inverter', series: 'HIC', code: '18Q3TG' },
  { sku: '40101701SD01900', desc: 'AC 1.5T DS HFC 18R2TH WA', nlc: 35504, stars: 3, type: 'Fixed Speed', series: 'HFC', code: '18R2TH' },
  { sku: '40101701SD01744', desc: 'AC 1.5T DS HIC 18J5TG WA', nlc: 38000, stars: 5, type: 'Inverter', series: 'HIC', code: '18J5TG' },
  { sku: '40101701SD01774', desc: 'AC 1.5T DS HIC 19J5TG WA', nlc: 38000, stars: 5, type: 'Inverter', series: 'HIC', code: '19J5TG' },
  { sku: '40101701SD01909', desc: 'AC 1.7T DS HIC 20J5TG WA', nlc: 39913, stars: 5, type: 'Inverter', series: 'HIC', code: '20J5TG' },
  { sku: '40101701SD01740', desc: 'AC 2.0T DS HIC 24J3TS WA', nlc: 40092, stars: 3, type: 'Inverter', series: 'HIC', code: '24J3TS' },
  { sku: '40101701SD01892', desc: 'AC 2.0T DS HFC 24K2TG WA', nlc: 41009, stars: 3, type: 'Fixed Speed', series: 'HFC', code: '24K2TG' },
  { sku: '40101701SD01751', desc: 'AC 2.5T DS HIC 30K3TG RA 4', nlc: 48859, stars: 3, type: 'Inverter', series: 'HIC', code: '30K3TG' },
  { sku: '40101701SD01801', desc: 'AC 3.0T DS HIC 36B3TH WA 4', nlc: 55053, stars: 3, type: 'Inverter', series: 'HIC', code: '36B3TH' },
];

function calcPrice(nlc: number) {
  const price = Math.round(nlc * 1.18 + 1000);
  const originalPrice = Math.round(price * 1.18);
  return { price, originalPrice, nlcPrice: nlc };
}

function parseTon(desc: string): number {
  const m = desc.match(/AC\s+([\d.]+)T/);
  return m ? parseFloat(m[1]) : 1.5;
}

function roomSize(ton: number): string {
  if (ton <= 1.0) return 'Up to 100 sq. ft.';
  if (ton <= 1.5) return '100 – 160 sq. ft.';
  if (ton <= 1.7) return '150 – 180 sq. ft.';
  if (ton <= 2.0) return '180 – 240 sq. ft.';
  if (ton <= 2.5) return '240 – 300 sq. ft.';
  return '300 – 360 sq. ft.';
}

function toSlug(ton: number, stars: number, isInverter: boolean, code: string): string {
  const typeStr = isInverter ? 'inverter' : 'fixed-speed';
  return `godrej-${ton.toString().replace('.', '-')}t-${stars}s-${typeStr}-split-${code.toLowerCase()}`;
}

function toName(ton: number, stars: number, isInverter: boolean, series: string): string {
  const techLabel = isInverter ? 'Inverter' : 'Fixed Speed';
  return `Godrej ${ton} Ton ${stars} Star ${techLabel} Split AC (${series})`;
}

function coolingBtu(ton: number): string {
  const map: Record<number, string> = {
    1.0: '3,500 BTU/hr',
    1.5: '5,100 BTU/hr',
    1.7: '5,800 BTU/hr',
    2.0: '6,800 BTU/hr',
    2.5: '8,500 BTU/hr',
    3.0: '10,200 BTU/hr',
  };
  return map[ton] ?? `${Math.round(ton * 3400)} BTU/hr`;
}

function buildDescriptionSections(
  name: string,
  ton: number,
  stars: number,
  isInverter: boolean,
  series: string,
  code: string,
  images: string[],
): DescriptionSection[] {
  const techLabel = isInverter ? 'Inverter' : 'Fixed Speed';
  const seriesNote =
    series === 'WIC'
      ? 'Wide Inverter Comfort series with enhanced airflow.'
      : series === 'HFC'
        ? 'High-efficiency fixed-speed range for dependable cooling.'
        : 'High Inverter Comfort series with smart energy management.';

  const inverterHtml = isInverter
    ? '<p>Variable-speed inverter compressor adjusts output to room load, reducing power draw and keeping noise low even on peak summer afternoons.</p>'
    : '<p>Robust fixed-speed compressor delivers steady, predictable cooling for homes that want proven performance at an accessible price point.</p>';

  return [
    {
      type: 'hero',
      title: name,
      subtitle: `${ton} Ton · ${stars}-Star BEE · ${techLabel} · Godrej ${series} Series`,
      order: 1,
    },
    {
      type: 'image_text',
      title: 'Built for Indian Summers',
      subtitle: `Model ${code}`,
      imageUrl: SECTION_IMAGES.lifestyle,
      imageAlt: `${name} — lifestyle installation`,
      html: `<p>The <strong>${name}</strong> is engineered for long, humid summers. ${seriesNote}</p>${inverterHtml}<p>Recommended room size: <strong>${roomSize(ton)}</strong>.</p>`,
      order: 2,
    },
    {
      type: 'feature_grid',
      title: 'Key Features',
      features: [
        { icon: 'bolt', title: `${stars}-Star BEE Rated`, description: 'Certified energy efficiency for lower electricity bills' },
        { icon: 'eco', title: 'R-32 Refrigerant', description: 'Lower global warming potential than legacy refrigerants' },
        { icon: 'autorenew', title: 'Auto-Restart', description: 'Resumes with last settings after power cuts' },
        { icon: 'verified', title: 'Free Installation', description: 'Certified Fixxer technicians at no extra cost' },
        ...(isInverter
          ? [
              { icon: 'speed', title: 'Inverter Technology', description: 'Variable-speed compressor for efficient, quiet cooling' },
              { icon: 'volume_off', title: 'Low Noise', description: 'Quieter indoor operation for bedrooms and living rooms' },
            ]
          : [
              { icon: 'thermostat', title: 'Reliable Cooling', description: 'Consistent temperature control across operating modes' },
              { icon: 'savings', title: 'Value Performance', description: 'Dependable fixed-speed design at a competitive price' },
            ]),
      ],
      order: 3,
    },
    {
      type: 'banner',
      title: 'Free Standard Installation',
      subtitle: 'Includes indoor & outdoor mounting, copper piping up to 3 m, and commissioning by Fixxer experts.',
      imageUrl: SECTION_IMAGES.banner,
      imageAlt: 'Professional AC installation',
      order: 4,
    },
    {
      type: 'html',
      title: 'Comfort & Convenience',
      html: `<ul>
<li>Operating modes: Cool, Dry, Fan, Auto, Sleep</li>
<li>Self-diagnosis for faster service visits</li>
<li>Sleep mode for quieter, energy-saving nights</li>
<li>Anti-rust outdoor cabinet for coastal and monsoon climates</li>
<li>SKU <strong>${code}</strong> — genuine Godrej stock fulfilled by Fixxer</li>
</ul>`,
      order: 5,
    },
    {
      type: 'image_full',
      imageUrl: SECTION_IMAGES.fullWidth,
      imageAlt: `${name} — product detail`,
      order: 6,
    },
    {
      type: 'image_text',
      title: 'Quiet, Comfortable Nights',
      imageUrl: SECTION_IMAGES.detail,
      imageAlt: `${name} — indoor unit detail`,
      html: '<p>Optimized airflow design distributes cool air evenly without direct drafts. Pair with Sleep mode for comfortable overnight operation.</p>',
      order: 7,
    },
  ];
}

function buildTechnicalDescription(
  name: string,
  ton: number,
  stars: number,
  isInverter: boolean,
  series: string,
  code: string,
  sku: string,
): TechnicalDescription {
  const techLabel = isInverter ? 'Inverter' : 'Fixed Speed';
  return {
    sections: [
      {
        title: 'General',
        specs: [
          { label: 'Brand', value: 'Godrej' },
          { label: 'Model', value: code },
          { label: 'SKU', value: sku },
          { label: 'Series', value: series },
          { label: 'Product Name', value: name },
          { label: 'Type', value: 'Split Air Conditioner' },
          { label: 'Capacity', value: `${ton} Ton` },
        ],
      },
      {
        title: 'Performance',
        specs: [
          { label: 'Cooling Capacity', value: coolingBtu(ton) },
          { label: 'BEE Star Rating', value: `${stars} Star` },
          { label: 'Compressor', value: techLabel },
          { label: 'Refrigerant', value: 'R-32' },
          { label: 'Ambient Range', value: '15°C to 52°C' },
          { label: 'Room Size', value: roomSize(ton) },
        ],
      },
      {
        title: 'Electrical & Operating',
        specs: [
          { label: 'Power Supply', value: '230V ~ 50Hz, Single Phase' },
          { label: 'Operating Modes', value: 'Cool, Dry, Fan, Auto, Sleep' },
          { label: 'Auto Restart', value: 'Yes' },
          { label: 'Self Diagnosis', value: 'Yes' },
          { label: 'Wi-Fi', value: 'No' },
        ],
      },
      {
        title: 'Warranty',
        specs: [
          { label: 'Product Warranty', value: '1 Year' },
          { label: 'Compressor Warranty', value: '10 Years' },
          { label: 'Installation', value: 'Included (standard)' },
        ],
      },
    ],
  };
}

function buildHighlights(isInverter: boolean, stars: number) {
  return [
    { icon: 'bolt', title: `${stars}-Star BEE Rated`, description: `${stars === 5 ? 'Highest' : 'Standard'} BEE energy efficiency certification` },
    { icon: 'eco', title: 'R-32 Refrigerant', description: 'Eco-friendly coolant with low GWP' },
    { icon: 'autorenew', title: 'Auto-Restart', description: 'Resumes operation after power interruption' },
    { icon: 'verified', title: 'Free Installation', description: 'Certified Fixxer technicians included' },
    ...(isInverter
      ? [
          { icon: 'speed', title: 'Inverter Technology', description: 'Variable speed for energy savings up to 40%' },
          { icon: 'volume_off', title: 'Silent Operation', description: 'Whisper-quiet inverter motor' },
        ]
      : [{ icon: 'thermostat', title: 'Precise Cooling', description: 'Consistent temperature control' }]),
  ];
}

function buildProduct(row: StockRow): SeedProduct {
  const ton = parseTon(row.desc);
  const isInverter = row.type === 'Inverter';
  const { price, originalPrice, nlcPrice } = calcPrice(row.nlc);
  const slug = toSlug(ton, row.stars, isInverter, row.code);
  const name = toName(ton, row.stars, isInverter, row.series);
  const images = isInverter ? PLACEHOLDER_IMAGES.split : PLACEHOLDER_IMAGES.fixedSpeed;
  const descriptionSections = buildDescriptionSections(name, ton, row.stars, isInverter, row.series, row.code, images);
  const technicalDescription = buildTechnicalDescription(name, ton, row.stars, isInverter, row.series, row.code, row.sku);

  return {
    slug,
    name,
    brand: 'Godrej',
    modelNumber: row.code,
    sku: row.sku,
    series: row.series,
    descriptionCode: row.code,
    price,
    originalPrice,
    nlcPrice,
    capacityTon: ton,
    starRating: row.stars,
    acType: 'split',
    isInverter,
    roomSizeRecommendation: roomSize(ton),
    shortDescription: `Godrej ${ton}T ${row.stars}-Star ${row.type} Split AC — ${row.series} series.`,
    images,
    descriptionSections,
    technicalDescription,
    specsPerformance: {
      coolingCapacityBtu: coolingBtu(ton),
      refrigerant: 'R-32',
      compressorType: isInverter ? 'Inverter' : 'Fixed Speed',
      ambientTempRangeC: '15°C to 52°C',
    },
    specsSmart: {
      sleepMode: true,
      selfDiagnosis: true,
      wifiEnabled: false,
      autoCleanEnabled: false,
      pm25Filter: false,
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

function applyPricing(doc: SeedProduct & { nlc?: number }): SeedProduct {
  const nlc = doc.nlcPrice ?? doc.nlc;
  if (nlc == null) return doc;
  const { price, originalPrice, nlcPrice } = calcPrice(nlc);
  const { nlc: _drop, ...rest } = doc as SeedProduct & { nlc?: number };
  return { ...rest, price, originalPrice, nlcPrice };
}

function loadProducts(): SeedProduct[] {
  if (fs.existsSync(DATA_JSON)) {
    const raw = JSON.parse(fs.readFileSync(DATA_JSON, 'utf-8')) as { products?: SeedProduct[] };
    const products = raw.products ?? (raw as unknown as SeedProduct[]);
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error(`Invalid seed JSON at ${DATA_JSON}: expected "products" array`);
    }
    return products.map(applyPricing);
  }
  console.log(`ℹ️  ${DATA_JSON} not found — using inline stock data (${RAW_STOCK.length} SKUs)`);
  return RAW_STOCK.map(buildProduct);
}

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  console.log(`🔌 Connecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);
  console.log('✅ Connected');

  const ApplianceModel = mongoose.models.Appliance ?? mongoose.model(Appliance.name, ApplianceSchema);

  const deleted = await ApplianceModel.deleteMany({});
  console.log(`🗑  Deleted ${deleted.deletedCount} existing appliance documents`);

  const docs = loadProducts();
  const expectedSkus = new Set(RAW_STOCK.map((r) => r.sku));
  const missing = [...expectedSkus].filter((sku) => !docs.some((d) => d.sku === sku));
  if (missing.length) {
    throw new Error(`Seed missing required SKUs: ${missing.join(', ')}`);
  }

  const inserted = await ApplianceModel.insertMany(docs);
  console.log(`🌱 Inserted ${inserted.length} appliances:`);
  docs.forEach((d) => console.log(`   ✔ ${d.slug} (${d.sku})`));

  await mongoose.disconnect();
  console.log('👋 Done');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
