/**
 * Comprehensive Seed Script: Generate 5000+ Diverse Spare Parts
 * Covers all appliance types with realistic part categories, pricing, and data
 *
 * Usage: node seed-5000-parts.js
 * Environment: MONGO_URI (defaults to localhost)
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';

// Define Schemas
const SparePartSchema = new mongoose.Schema(
  {
    sku: { type: String, unique: true, required: true, index: true },
    slug: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: String,
    imageUrls: [String],
    applianceTypeSlug: { type: String, required: true, index: true },
    isUniversal: { type: Boolean, default: false, index: true },
    brandSlug: { type: String, index: true },
    compatibleModels: [{ modelNumber: String, displayName: String }],
    crossBrandCompatibility: [String],
    partCategory: { type: String, index: true },
    partNumber: { type: String, unique: true, sparse: true },
    alternatePartNumbers: [String],
    partType: {
      type: String,
      enum: ['OEM', 'OEM-Equivalent', 'Aftermarket', 'Universal'],
    },
    price: { type: Number, required: true },
    mrp: Number,
    stock: { type: Number, default: 50 },
    isInStock: { type: Boolean, default: true },
    tags: [String],
    searchKeywords: [String],
    installationDifficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard', 'Professional Only'],
    },
    warrantyMonths: Number,
    isFeatured: { type: Boolean, default: false, index: true },
    viewCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const SparePart = mongoose.model('SparePart', SparePartSchema);

// ============== COMMON PARTS DATA ==============

const APPLIANCE_TYPES = {
  refrigerator: 'Refrigerator',
  'washing-machine': 'Washing Machine',
  'air-conditioner': 'Air Conditioner',
  'microwave-oven': 'Microwave & OTG',
  'water-purifier': 'Water Purifier',
  television: 'Television',
  geyser: 'Water Heater / Geyser',
  'ceiling-fan': 'Ceiling Fan',
};

const BRANDS = [
  'samsung',
  'lg',
  'whirlpool',
  'godrej',
  'haier',
  'ifb',
  'bosch',
  'daikin',
  'voltas',
  'hitachi',
  'panasonic',
  'kent',
  'aquaguard',
  'orient',
  'havells',
  'bajaj',
  'ao-smith',
];

// Common part categories across appliances
const COMMON_PART_CATEGORIES = {
  refrigerator: [
    'Cooling & Compressor',
    'Motors & Drive',
    'Controls & Sensors',
    'Cooling Fans',
    'Seals & Gaskets',
    'Ice Maker',
    'Water System',
    'Shelves & Drawers',
    'Lighting',
  ],
  'washing-machine': [
    'Motors & Drive',
    'Drums & Tubs',
    'Belts & Pulleys',
    'Controls & PCB',
    'Inlet Valves',
    'Drain Pumps',
    'Bearings',
    'Seals & Gaskets',
    'Fasteners',
  ],
  'air-conditioner': [
    'Compressors',
    'Cooling Fans',
    'Condenser Coils',
    'Evaporator Coils',
    'Thermostats',
    'Control Boards',
    'Capillary Tubes',
    'Filters',
    'Motors',
  ],
  'microwave-oven': [
    'Magnetrons',
    'Transformers',
    'Capacitors',
    'Heating Elements',
    'Waveguide Covers',
    'Control Panels',
    'Stirrer Motors',
    'Turntables',
  ],
  'water-purifier': [
    'RO Membranes',
    'Pre-Filters',
    'Carbon Filters',
    'Cartridges',
    'Valves & Fittings',
    'TDS Meters',
    'Pumps',
    'Housings',
  ],
  television: [
    'Power Supplies',
    'LED Backlights',
    'Main Boards',
    'T-Con Boards',
    'Panel Cables',
    'Remote Controls',
    'Speakers',
    'Capacitors',
  ],
  geyser: [
    'Heating Elements',
    'Thermostats',
    'Control Boards',
    'Temperature Sensors',
    'Relief Valves',
    'Inlets & Outlets',
    'Pipes & Fittings',
    'Insulation',
  ],
  'ceiling-fan': [
    'Motors',
    'Capacitors',
    'Regulators',
    'Bearings',
    'Blades',
    'Fasteners',
    'Wiring',
    'Speed Controllers',
  ],
};

const PART_TYPES = ['OEM', 'OEM-Equivalent', 'Aftermarket', 'Universal'];
const INSTALLATION_DIFFICULTY = ['Easy', 'Medium', 'Hard', 'Professional Only'];
const WARRANTY_MONTHS = [3, 6, 12, 18, 24, 36];

// Image URLs for variety
const GENERIC_IMAGES = [
  'https://images.unsplash.com/photo-1581092160562-40aa08e78837',
  'https://images.unsplash.com/photo-1571172964276-91faaa704e1d',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64',
  'https://images.unsplash.com/photo-1585659722983-3a675dabf23d',
  'https://images.unsplash.com/photo-1518770660439-4636190af475',
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
];

// ============== GENERATION LOGIC ==============

function generateSKU(applianceType, partCategory, index) {
  const appliancePrefix = applianceType.split('-')[0].toUpperCase().slice(0, 3);
  const partPrefix = partCategory.split(' ')[0].slice(0, 3).toUpperCase();
  return `SP-${appliancePrefix}-${partPrefix}-${String(index).padStart(5, '0')}`;
}

function generatePartNumber(index) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let partNum = '';
  for (let i = 0; i < 8; i++) {
    partNum += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return partNum;
}

function generatePrice(basePrice = 500, variance = 0.8) {
  // Price in paise (1 rupee = 100 paise)
  const multiplier = 1 + (Math.random() - 0.5) * variance;
  const price = Math.round(basePrice * 100 * multiplier);
  return Math.max(price, 100); // minimum 1 rupee
}

function generateName(applianceType, partCategory, brand) {
  const partNames = {
    'Cooling & Compressor': [
      'Rotary Compressor',
      'Scroll Compressor',
      'Inverter Compressor',
    ],
    'Motors & Drive': [
      'AC Induction Motor',
      'BLDC Motor',
      'Universal Motor',
      'Synchronous Motor',
    ],
    'Drums & Tubs': ['Stainless Steel Drum', 'Porcelain Tub', 'Aluminum Drum'],
    'Belts & Pulleys': [
      'Drive Belt',
      'Motor Pulley',
      'Drum Pulley',
      'Flat Belt',
    ],
    'Controls & PCB': [
      'Main Control Board',
      'Power Module',
      'Display PCB',
      'Inverter Card',
    ],
    'Cooling Fans': [
      'Condenser Fan Motor',
      'Evaporator Fan',
      'Circulation Fan',
    ],
    'Seals & Gaskets': ['Door Gasket', 'Shaft Seal', 'Lid Seal', 'O-Ring'],
    Thermostats: [
      'Bimetal Thermostat',
      'Electronic Thermostat',
      'Temperature Sensor',
    ],
    'Heating Elements': [
      'Tubular Heater',
      'Immersion Heater',
      'Resistance Coil',
    ],
    Capacitors: ['Run Capacitor', 'Start Capacitor', 'Filter Capacitor'],
    'RO Membranes': [
      '75 GPD RO Membrane',
      '100 GPD RO Membrane',
      'Imported RO Membrane',
    ],
    'Pre-Filters': [
      '1 Micron Cartridge',
      '5 Micron Cartridge',
      'Sediment Filter',
    ],
    Magnetrons: [
      '2M246J Magnetron',
      '2M261J Magnetron',
      'High Power Magnetron',
    ],
    'Power Supplies': ['SMPS Board', 'Power Supply Module', 'LED Driver'],
    Fasteners: ['Stainless Steel Screw', 'Mounting Bracket', 'Cable Clip'],
    Wiring: ['Power Cord', 'Cable Harness', 'Wire Loom'],
    Blades: ['Aluminum Blade Set', 'Wooden Blade Set', 'Replacement Blades'],
    'Remote Controls': ['IR Remote with Battery', 'Smart Remote', 'RF Remote'],
  };

  const names = partNames[partCategory] || ['Spare Part'];
  return `${brand.charAt(0).toUpperCase() + brand.slice(1)} ${names[Math.floor(Math.random() * names.length)]}`;
}

function generateDescription(name, category, partType) {
  const descriptions = [
    `High-quality ${partType === 'OEM' ? 'original' : 'replacement'} ${name.toLowerCase()} for reliable performance.`,
    `Durable ${name.toLowerCase()} with extended lifespan and optimal efficiency.`,
    `Professional-grade ${name.toLowerCase()} engineered for precision and reliability.`,
    `Premium ${name.toLowerCase()} compatible with multiple models and brands.`,
    `Replacement ${name.toLowerCase()} featuring advanced materials and design.`,
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function getCompatibleBrands(applianceType) {
  const brandApplianceMap = {
    refrigerator: [
      'samsung',
      'lg',
      'whirlpool',
      'godrej',
      'haier',
      'hitachi',
      'voltas',
      'bosch',
    ],
    'washing-machine': [
      'samsung',
      'lg',
      'whirlpool',
      'godrej',
      'ifb',
      'bosch',
      'panasonic',
      'haier',
    ],
    'air-conditioner': [
      'lg',
      'daikin',
      'voltas',
      'panasonic',
      'hitachi',
      'samsung',
      'godrej',
      'haier',
    ],
    'microwave-oven': [
      'samsung',
      'lg',
      'panasonic',
      'ifb',
      'bajaj',
      'whirlpool',
    ],
    'water-purifier': ['kent', 'aquaguard', 'lg', 'ao-smith'],
    television: ['samsung', 'lg', 'panasonic', 'haier', 'orient'],
    geyser: ['havells', 'bajaj', 'ao-smith', 'godrej'],
    'ceiling-fan': ['havells', 'bajaj', 'orient', 'panasonic'],
  };
  return brandApplianceMap[applianceType] || BRANDS;
}

async function generateSparePartsData() {
  console.log('Generating 5000+ diverse spare parts...\n');

  const partsToCreate = [];
  const featuredParts = new Set(); // Track featured parts for landing page
  let partIndex = 0;

  // Generate parts for each appliance type
  for (const [applianceSlug, applianceName] of Object.entries(
    APPLIANCE_TYPES,
  )) {
    const categories = COMMON_PART_CATEGORIES[applianceSlug] || [];
    const compatibleBrands = getCompatibleBrands(applianceSlug);
    const partsPerAppliance = Math.round(
      5000 / Object.keys(APPLIANCE_TYPES).length,
    );

    console.log(
      `\n📱 ${applianceName}: Generating ${partsPerAppliance} parts...`,
    );

    for (let i = 0; i < partsPerAppliance; i++) {
      const category = categories[i % categories.length];
      const brand = compatibleBrands[i % compatibleBrands.length];
      const isUniversal = Math.random() < 0.15; // 15% universal parts
      const isOEM = Math.random() < 0.4; // 40% OEM parts
      const isFeatured = Math.random() < 0.05 && !isUniversal; // 5% featured parts (non-universal)

      const partTypeSelection = isOEM
        ? 'OEM'
        : isUniversal
          ? 'Universal'
          : PART_TYPES[Math.floor(Math.random() * (PART_TYPES.length - 1))];

      const sku = generateSKU(applianceSlug, category, partIndex++);
      const name = generateName(applianceSlug, category, brand);
      const slug = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const price = generatePrice(Math.random() < 0.5 ? 2000 : 10000, 1.2);
      const mrp = Math.round(price * (1 + Math.random() * 0.3)); // 0-30% markup

      const part = {
        sku,
        slug: `${slug}-${sku.split('-').pop()}`,
        name,
        description: generateDescription(name, category, partTypeSelection),
        applianceTypeSlug: applianceSlug,
        isUniversal,
        brandSlug: isUniversal ? null : brand,
        partCategory: category,
        partNumber: generatePartNumber(partIndex),
        partType: partTypeSelection,
        price,
        mrp,
        stock: Math.floor(Math.random() * 100),
        isInStock: Math.random() < 0.85, // 85% in stock
        tags: [category.toLowerCase(), applianceSlug, brand],
        installationDifficulty:
          INSTALLATION_DIFFICULTY[
            Math.floor(Math.random() * INSTALLATION_DIFFICULTY.length)
          ],
        warrantyMonths:
          WARRANTY_MONTHS[Math.floor(Math.random() * WARRANTY_MONTHS.length)],
        imageUrls: [GENERIC_IMAGES[i % GENERIC_IMAGES.length]],
        isFeatured,
        viewCount: Math.floor(Math.random() * 500),
        soldCount: Math.floor(Math.random() * 200),
        isActive: true,
      };

      if (isFeatured) {
        featuredParts.add(part.sku);
        console.log(`  ⭐ Featured: ${name} (${sku})`);
      }

      partsToCreate.push(part);
    }
  }

  return { parts: partsToCreate, featuredParts: Array.from(featuredParts) };
}

async function seedDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log(`✅ Connected to ${MONGO_URI}\n`);

    const { parts, featuredParts } = await generateSparePartsData();

    console.log(`\n💾 Total parts to seed: ${parts.length}`);
    console.log(`⭐ Featured parts: ${featuredParts.length}\n`);

    // Batch insert with progress tracking
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < parts.length; i += BATCH_SIZE) {
      const batch = parts.slice(i, i + BATCH_SIZE);

      try {
        // Use bulkWrite with upsert for idempotent seeding
        const ops = batch.map((part) => ({
          updateOne: {
            filter: { sku: part.sku },
            update: { $set: part },
            upsert: true,
          },
        }));

        await SparePart.collection.bulkWrite(ops);
        inserted += batch.length;

        const percentage = ((inserted / parts.length) * 100).toFixed(1);
        console.log(
          `✅ Progress: ${inserted}/${parts.length} parts (${percentage}%)`,
        );
      } catch (error) {
        console.error(`❌ Batch error at index ${i}:`, error.message);
      }
    }

    // Get statistics
    const total = await SparePart.countDocuments();
    const featured = await SparePart.countDocuments({ isFeatured: true });
    const byAppliance = {};

    for (const applianceType of Object.keys(APPLIANCE_TYPES)) {
      byAppliance[applianceType] = await SparePart.countDocuments({
        applianceTypeSlug: applianceType,
      });
    }

    console.log('\n========== SEEDING COMPLETE ==========');
    console.log(`📊 Total parts in database: ${total}`);
    console.log(`⭐ Featured parts: ${featured}`);
    console.log('\n📱 Parts by Appliance Type:');
    for (const [type, count] of Object.entries(byAppliance)) {
      console.log(`   ${APPLIANCE_TYPES[type]}: ${count} parts`);
    }
    console.log('=====================================\n');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seeding
seedDatabase();
