const mongoose = require('mongoose');
const xlsx = require('xlsx');
const fs = require('fs');

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
const defaultFilePath = '/Users/misanthropic/codebase/fixxer-backend/MARUTI_SPARE_2025.xlsx';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
const BATCH_SIZE = 1000;

// Grab filepath from CLI arguments if provided (e.g. node seed.js ./my-data.xlsx)
const filePath = process.argv[2] || defaultFilePath;

// -----------------------------------------------------------------------------
// 1. Define Mongoose Schema (Matching our SparePart structure)
// -----------------------------------------------------------------------------
const SparePartSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  partNumber: { type: String, required: true, unique: true, index: true }, // Extra explicit index for safety
  name: { type: String, required: true },
  category: { type: String, default: 'Automotive' },
  price: { type: String, required: true }, // Storing as String to allow "₹2,500" logic if needed, but numeric parsing is handled
  manufacturer: { type: String, default: 'Maruti Suzuki' },
  seller: { type: String, default: 'Fixxer OEM Hub' },
  supportsServiceBooking: { type: Boolean, default: false },
  image: { type: String, required: true },
  description: { type: String },
}, { timestamps: true });

const SparePart = mongoose.models.SparePart || mongoose.model('SparePart', SparePartSchema);

// -----------------------------------------------------------------------------
// 2. Data Mapping Configuration
// Dynamically maps common Excel header variations to our Schema fields
// -----------------------------------------------------------------------------
const COLUMN_MAP = {
  // Excel Column Name Variations : Target Mongoose Field
  'partnumber': 'partNumber',
  'part no': 'partNumber',
  'part_no': 'partNumber',
  'inventory id': 'partNumber',
  
  'description': 'name',
  'part name': 'name',
  'name': 'name',

  'mrp': 'price',
  'price': 'price',
  'customer price': 'price',
  'cost': 'price',
  
  'category': 'category',
  'group': 'category'
};

// -----------------------------------------------------------------------------
// 3. Helper Functions
// -----------------------------------------------------------------------------
function normalizeKey(key) {
  // Lowercase, trim, and remove weird spaces to match map
  return key.toLowerCase().trim();
}

/**
 * Normalizes and cleans a single raw row object into a Mongoose-ready payload
 */
function cleanAndTransformRow(rawRow) {
  const transformed = {};
  
  // Transform keys dynamically based on our COLUMN_MAP
  Object.keys(rawRow).forEach((key) => {
    const rawVal = rawRow[key];
    const normalizedK = normalizeKey(key);
    
    const targetField = COLUMN_MAP[normalizedK] || null;
    if (targetField && rawVal !== undefined && rawVal !== null) {
      // Trim strings
      if (typeof rawVal === 'string') {
        transformed[targetField] = rawVal.trim();
      } else {
        transformed[targetField] = rawVal;
      }
    }
  });

  // Ensure minimum required fields exist. Skip row if core identifier is completely missing.
  if (!transformed.partNumber) return null; 

  // Normalize defaults
  const partNumberStr = String(transformed.partNumber).toUpperCase();
  
  // Formatting price to string
  const rawPrice = transformed.price || 0;
  const formattedPrice = `₹${parseFloat(rawPrice).toLocaleString('en-IN')}`;

  let rawName = transformed.name || 'Unknown Part';
  let inferredManufacturer = 'Generic';
  let inferredCategory = 'General Spare Parts'; // This will be the Manufacturer/Brand as per user request
  let partType = 'Unknown Spare Part';

  const BRANDS = ['SAMSUNG', 'WHIRLPOOL', 'LG', 'BOSCH', 'IFB', 'GODREJ', 'VIDEOCON', 'PANASONIC', 'HAIER', 'VOLTAS', 'MARUTI', 'MAHINDRA', 'TATA', 'HYUNDAI'];
  const TYPES = ['PULSATOR', 'GEAR BOX', 'MOTOR', 'BELT', 'PUMP', 'VALVE', 'TIMER', 'PCB', 'HEATER', 'THERMOSTAT', 'SWITCH', 'CAP', 'HOSE', 'PIPE', 'FAN', 'COMPRESSOR', 'SENSOR', 'SHELF', 'DRAIN', 'SPIN CAP', 'SPIN LID', 'DOOR LOCK', 'BUFFER', 'CAPACITOR'];
  
  const upperName = rawName.toUpperCase();
  
  // 1. Identify Brand -> This will be our "Category" according to user
  for (const brand of BRANDS) {
    if (upperName.includes(brand)) {
      inferredManufacturer = brand.charAt(0) + brand.slice(1).toLowerCase();
      inferredCategory = inferredManufacturer; // Use Brand as Category
      break;
    }
  }
  
  // 2. Identify Part Type -> This will be our "Name"
  for (const t of TYPES) {
    if (upperName.includes(t)) {
      partType = t.charAt(0) + t.slice(1).toLowerCase();
      break;
    }
  }

  // If we couldn't find a specific type, use the stripped raw name
  if (partType === 'Unknown Spare Part') {
    partType = rawName.replace(/MARUTI|SAMSUNG|WHIRLPOOL|LG|BOSCH|IFB|GODREJ|VIDEOCON|PANASONIC|HAIER|VOLTAS/gi, '').trim();
    if (partType.length < 3) partType = rawName;
  }

  const finalDocument = {
    slug: `part-${partNumberStr.toLowerCase()}`, 
    partNumber: partNumberStr,
    name: partType, // Specific part type
    category: inferredCategory, // Manufacturer as category
    price: formattedPrice,
    image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=800&auto=format&fit=crop', // Placeholder
    description: `High-quality ${partType} compatible with ${inferredManufacturer} appliances. Certified genuine component.`,
    manufacturer: inferredManufacturer
  };

  return finalDocument;
}

// -----------------------------------------------------------------------------
// 4. Main Execution Logic
// -----------------------------------------------------------------------------
async function seedDatabase() {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found at path: ${filePath}`);
    }

    console.log(`🔌 Connecting to MongoDB at ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    // Ensure Indexes are built
    await SparePart.init();
    
    console.log(`\n📖 Reading Excel file: ${filePath}`);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Assuming data is in first sheet
    const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, range: 4 });
    
    console.log(`📊 Found ${rawData.length} rows in the Excel file. Normalizing data...`);

    // Process all rows
    const validDocuments = [];
    for (const row of rawData) {
      const doc = cleanAndTransformRow(row);
      if (doc) validDocuments.push(doc);
    }

    console.log(`🧹 Remaining valid rows after cleanup: ${validDocuments.length}`);

    if (validDocuments.length === 0) {
      console.log('⚠️ No valid data to insert. Exiting.');
      return process.exit(0);
    }

    // Insert using batching and upserts to make the script idempotent
    let insertedCount = 0;
    let updatedCount = 0;

    console.log(`\n🚀 Starting Bulk Upsert in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < validDocuments.length; i += BATCH_SIZE) {
      const batch = validDocuments.slice(i, i + BATCH_SIZE);
      
      // We use bulkWrite with updateOne & upsert: true. 
      // This prevents duplicates based on 'partNumber', making it safe to run multiple times.
      const operations = batch.map(doc => ({
        updateOne: {
          filter: { partNumber: doc.partNumber },
          update: { $set: doc },
          upsert: true
        }
      }));

      const result = await SparePart.bulkWrite(operations, { ordered: false });
      
      insertedCount += result.upsertedCount;
      updatedCount += result.modifiedCount;
      
      console.log(`⏳ Progress: Processed ${i + batch.length} / ${validDocuments.length} records. (Inserted: ${result.upsertedCount}, Updated: ${result.modifiedCount})`);
    }

    console.log('\n🎉 Seeding Complete!');
    console.log(`✅ Total New Records Inserted: ${insertedCount}`);
    console.log(`🔄 Total Existing Records Updated: ${updatedCount}`);

  } catch (error) {
    console.error('\n❌ Error during seeding process:');
    console.error(error.message);
  } finally {
    // Graceful disconnect
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  }
}

// Run the script
seedDatabase();
