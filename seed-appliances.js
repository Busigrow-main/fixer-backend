/**
 * Seed script for Godrej AC appliances
 * Run: node seed-appliances.js
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';

const applianceSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    brand: { type: String, required: true, index: true },
    modelNumber: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: Number,
    capacityTon: { type: Number, required: true, index: true },
    starRating: { type: Number, required: true, index: true },
    acType: {
      type: String,
      enum: ['split', 'window', 'cassette', 'portable'],
      required: true,
      index: true,
    },
    isInverter: { type: Boolean, required: true },
    description: { type: String, required: true },
    shortDescription: String,
    images: { type: [String], required: true },
    specs: mongoose.Schema.Types.Mixed,
    inStock: { type: Boolean, default: true, index: true },
    warrantyYears: Number,
    installationIncluded: { type: Boolean, default: false },
    applianceCategory: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

const Appliance = mongoose.model('Appliance', applianceSchema);

const godrejACs = [
  {
    slug: 'godrej-1-5t-5s-inverter-split',
    name: 'Godrej 1.5 Ton 5 Star Inverter Split AC',
    brand: 'Godrej',
    modelNumber: 'GIC 18TTC5-WTA',
    price: 38990,
    originalPrice: 45500,
    capacityTon: 1.5,
    starRating: 5,
    acType: 'split',
    isInverter: true,
    description: `<p>The Godrej 1.5 Ton 5 Star Inverter Split AC is engineered for superior cooling efficiency and eco-friendly operation. With a sophisticated inverter compressor, this model adjusts cooling capacity based on room temperature, delivering significant energy savings.</p>
<ul>
<li>Advanced Wi-Fi connectivity for remote control via mobile app</li>
<li>Auto-Clean technology prevents dust and mold accumulation</li>
<li>Energy rating: 5 Star (highest BEE rating)</li>
<li>Whisper-quiet operation at just 32 dB</li>
<li>Advanced filtration system captures particles up to 0.3 microns</li>
<li>Godrej's comprehensive 5-year warranty on compressor</li>
<li>Fixxer installation and 60-day service warranty included</li>
</ul>`,
    shortDescription:
      'Efficient 5-Star inverter split AC with Wi-Fi control and auto-clean technology. Perfect for medium-sized rooms.',
    images: [
      'https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=500&h=500&fit=crop',
    ],
    specs: {
      coolingCapacityBtu: '18000 BTU/hr',
      energyConsumption: '1550 W',
      annualEnergyUnits: '837.44 units',
      refrigerant: 'R32 (Eco-friendly)',
      compressorType: 'Inverter',
      noiseLevelIndoor: '32 dB',
      indoorUnitDimensions: '295 x 1055 x 220 mm',
      outdoorUnitDimensions: '550 x 765 x 290 mm',
      colour: 'White',
      wifiEnabled: 'Yes',
      autoClean: 'Yes',
    },
    inStock: true,
    warrantyYears: 5,
    installationIncluded: true,
    applianceCategory: 'ac',
    isActive: true,
  },
  {
    slug: 'godrej-1-0t-3s-window-ac',
    name: 'Godrej 1.0 Ton 3 Star Window AC',
    brand: 'Godrej',
    modelNumber: 'GIW 12UDC5-WNA',
    price: 22500,
    originalPrice: 28000,
    capacityTon: 1.0,
    starRating: 3,
    acType: 'window',
    isInverter: false,
    description: `<p>The Godrej 1.0 Ton 3 Star Window AC is a budget-friendly cooling solution ideal for small to medium rooms. This model combines reliability with affordability, making it perfect for homes and offices.</p>
<ul>
<li>Powerful cooling for rooms up to 100 sq ft</li>
<li>Energy rating: 3 Star</li>
<li>Advanced filtration system</li>
<li>Compact design for easy installation</li>
<li>3-year warranty on compressor</li>
<li>Godrej's trusted reliability</li>
</ul>`,
    shortDescription:
      'Affordable 3-Star window AC for small to medium rooms. Reliable cooling solution.',
    images: [
      'https://images.unsplash.com/photo-1585323555910-6831094a37e6?w=500&h=500&fit=crop',
    ],
    specs: {
      coolingCapacityBtu: '12000 BTU/hr',
      energyConsumption: '1050 W',
      annualEnergyUnits: '625.20 units',
      refrigerant: 'R410A',
      compressorType: 'Fixed Speed',
      noiseLevelIndoor: '37 dB',
      indoorUnitDimensions: '300 x 800 x 200 mm',
      outdoorUnitDimensions: '600 x 600 x 300 mm',
      colour: 'White',
      wifiEnabled: 'No',
      autoClean: 'Yes',
    },
    inStock: true,
    warrantyYears: 3,
    installationIncluded: true,
    applianceCategory: 'ac',
    isActive: true,
  },
  {
    slug: 'godrej-2-0t-5s-inverter-split',
    name: 'Godrej 2.0 Ton 5 Star Inverter Split AC',
    brand: 'Godrej',
    modelNumber: 'GIC 24TTC5-WTA',
    price: 55000,
    originalPrice: 68000,
    capacityTon: 2.0,
    starRating: 5,
    acType: 'split',
    isInverter: true,
    description: `<p>The Godrej 2.0 Ton 5 Star Inverter Split AC is designed for large rooms and commercial spaces. With premium features and exceptional energy efficiency, it delivers powerful cooling while keeping electricity bills low.</p>
<ul>
<li>5 Star energy rating for maximum efficiency</li>
<li>Inverter compressor adjusts to load conditions</li>
<li>Wi-Fi control with smart scheduling</li>
<li>Auto-Clean technology</li>
<li>Advanced plasma filtration</li>
<li>Whisper-quiet operation</li>
<li>5-year warranty on compressor</li>
</ul>`,
    shortDescription:
      'Premium 2-Ton 5-Star inverter AC for large rooms. Maximum efficiency and performance.',
    images: [
      'https://images.unsplash.com/photo-1616394584738-fc6e612ce4d0?w=500&h=500&fit=crop',
    ],
    specs: {
      coolingCapacityBtu: '24000 BTU/hr',
      energyConsumption: '2100 W',
      annualEnergyUnits: '1125.30 units',
      refrigerant: 'R32',
      compressorType: 'Inverter',
      noiseLevelIndoor: '32 dB',
      indoorUnitDimensions: '300 x 1110 x 250 mm',
      outdoorUnitDimensions: '650 x 850 x 320 mm',
      colour: 'White',
      wifiEnabled: 'Yes',
      autoClean: 'Yes',
    },
    inStock: true,
    warrantyYears: 5,
    installationIncluded: true,
    applianceCategory: 'ac',
    isActive: true,
  },
  {
    slug: 'godrej-1-5t-4s-inverter-split',
    name: 'Godrej 1.5 Ton 4 Star Inverter Split AC',
    brand: 'Godrej',
    modelNumber: 'GIC 18TTC4-WTA',
    price: 32500,
    originalPrice: 40000,
    capacityTon: 1.5,
    starRating: 4,
    acType: 'split',
    isInverter: true,
    description: `<p>The Godrej 1.5 Ton 4 Star Inverter Split AC offers an excellent balance between performance and affordability. Featuring inverter technology, it provides efficient cooling for medium-sized rooms while maintaining low operating costs.</p>
<ul>
<li>4 Star energy rating - excellent efficiency</li>
<li>Inverter compressor for variable cooling</li>
<li>Wi-Fi control capability</li>
<li>Auto-Clean function</li>
<li>Eco-friendly R32 refrigerant</li>
<li>5-year warranty</li>
</ul>`,
    shortDescription:
      'Value-packed 4-Star inverter AC with Wi-Fi control. Great efficiency at affordable price.',
    images: [
      'https://images.unsplash.com/photo-1584703304017-2953219fbe9f?w=500&h=500&fit=crop',
    ],
    specs: {
      coolingCapacityBtu: '18000 BTU/hr',
      energyConsumption: '1650 W',
      annualEnergyUnits: '920.50 units',
      refrigerant: 'R32',
      compressorType: 'Inverter',
      noiseLevelIndoor: '33 dB',
      indoorUnitDimensions: '295 x 1055 x 220 mm',
      outdoorUnitDimensions: '550 x 765 x 290 mm',
      colour: 'White',
      wifiEnabled: 'Yes',
      autoClean: 'Yes',
    },
    inStock: true,
    warrantyYears: 5,
    installationIncluded: true,
    applianceCategory: 'ac',
    isActive: true,
  },
  {
    slug: 'godrej-0-75t-3s-window-ac',
    name: 'Godrej 0.75 Ton 3 Star Window AC',
    brand: 'Godrej',
    modelNumber: 'GIW 09UDC3-WNA',
    price: 18900,
    originalPrice: 23000,
    capacityTon: 0.75,
    starRating: 3,
    acType: 'window',
    isInverter: false,
    description: `<p>The Godrej 0.75 Ton 3 Star Window AC is the most compact and economical cooling solution. Perfect for small rooms, bedrooms, or offices, this model delivers reliable cooling without excessive power consumption.</p>
<ul>
<li>Ideal for rooms up to 80 sq ft</li>
<li>Energy-efficient 3 Star rating</li>
<li>Compact and easy to install</li>
<li>Low noise operation</li>
<li>Advanced cooling technology</li>
<li>3-year warranty</li>
</ul>`,
    shortDescription:
      'Compact 0.75-Ton window AC for small rooms. Energy-efficient and affordable.',
    images: [
      'https://images.unsplash.com/photo-1585419317631-fd1eaae7a01d?w=500&h=500&fit=crop',
    ],
    specs: {
      coolingCapacityBtu: '9000 BTU/hr',
      energyConsumption: '800 W',
      annualEnergyUnits: '475.50 units',
      refrigerant: 'R410A',
      compressorType: 'Fixed Speed',
      noiseLevelIndoor: '37 dB',
      indoorUnitDimensions: '250 x 750 x 190 mm',
      outdoorUnitDimensions: '550 x 520 x 280 mm',
      colour: 'White',
      wifiEnabled: 'No',
      autoClean: 'Yes',
    },
    inStock: true,
    warrantyYears: 3,
    installationIncluded: true,
    applianceCategory: 'ac',
    isActive: true,
  },
  {
    slug: 'godrej-1-5t-5s-portable-ac',
    name: 'Godrej 1.5 Ton 5 Star Portable AC',
    brand: 'Godrej',
    modelNumber: 'GIP 15PPM5-TNA',
    price: 45000,
    originalPrice: 55000,
    capacityTon: 1.5,
    starRating: 5,
    acType: 'portable',
    isInverter: true,
    description: `<p>The Godrej 1.5 Ton 5 Star Portable AC offers flexibility and premium cooling in one unit. Perfect for renters or those who need cooling in multiple rooms, this portable unit moves easily and cools efficiently.</p>
<ul>
<li>Portable design - no permanent installation needed</li>
<li>5 Star energy rating</li>
<li>Works in any room with a window</li>
<li>Whisper-quiet inverter operation</li>
<li>Wi-Fi enabled for smart control</li>
<li>Auto-evaporative technology</li>
<li>5-year warranty</li>
</ul>`,
    shortDescription:
      'Premium portable AC with 5-Star efficiency. Move it anywhere, no installation needed.',
    images: [
      'https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=500&h=500&fit=crop',
    ],
    specs: {
      coolingCapacityBtu: '18000 BTU/hr',
      energyConsumption: '1550 W',
      annualEnergyUnits: '837.44 units',
      refrigerant: 'R32',
      compressorType: 'Inverter',
      noiseLevelIndoor: '28 dB',
      dimensions: '420 x 790 x 375 mm',
      weight: '38 kg',
      colour: 'White',
      wifiEnabled: 'Yes',
      autoEvaporative: 'Yes',
    },
    inStock: true,
    warrantyYears: 5,
    installationIncluded: false,
    applianceCategory: 'ac',
    isActive: true,
  },
  {
    slug: 'godrej-2-0t-4s-inverter-split',
    name: 'Godrej 2.0 Ton 4 Star Inverter Split AC',
    brand: 'Godrej',
    modelNumber: 'GIC 24TTC4-WTA',
    price: 47500,
    originalPrice: 60000,
    capacityTon: 2.0,
    starRating: 4,
    acType: 'split',
    isInverter: true,
    description: `<p>The Godrej 2.0 Ton 4 Star Inverter Split AC provides powerful cooling for large spaces with excellent value. With advanced inverter technology, it maintains comfort while optimizing electricity consumption.</p>
<ul>
<li>4 Star energy rating - high efficiency</li>
<li>Inverter compressor for variable cooling</li>
<li>Suitable for large rooms and halls</li>
<li>Wi-Fi smart control</li>
<li>Auto-Clean feature</li>
<li>Eco-friendly cooling</li>
<li>5-year warranty</li>
</ul>`,
    shortDescription:
      'Powerful 2-Ton inverter AC for large spaces. 4-Star efficiency at great value.',
    images: [
      'https://images.unsplash.com/photo-1616394584738-fc6e612ce4d0?w=500&h=500&fit=crop',
    ],
    specs: {
      coolingCapacityBtu: '24000 BTU/hr',
      energyConsumption: '2200 W',
      annualEnergyUnits: '1230.40 units',
      refrigerant: 'R32',
      compressorType: 'Inverter',
      noiseLevelIndoor: '33 dB',
      indoorUnitDimensions: '300 x 1110 x 250 mm',
      outdoorUnitDimensions: '650 x 850 x 320 mm',
      colour: 'White',
      wifiEnabled: 'Yes',
      autoClean: 'Yes',
    },
    inStock: true,
    warrantyYears: 5,
    installationIncluded: true,
    applianceCategory: 'ac',
    isActive: true,
  },
];

async function seedAppliances() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Clear existing appliances
    const deleted = await Appliance.deleteMany({ applianceCategory: 'ac' });
    console.log(`✓ Deleted ${deleted.deletedCount} existing AC products`);

    // Insert new appliances
    const inserted = await Appliance.insertMany(godrejACs);
    console.log(`✓ Inserted ${inserted.length} Godrej AC products`);

    console.log('\nSeeded Products:');
    inserted.forEach((product) => {
      console.log(`  - ${product.name} (₹${product.price})`);
    });

    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('✗ Seed failed:', error.message);
    process.exit(1);
  }
}

seedAppliances();
