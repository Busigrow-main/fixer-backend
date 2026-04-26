const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';

// Define Schemas for the standalone script
const ApplianceTypeSchema = new mongoose.Schema({
  slug: String,
  name: String,
  description: String,
  icon: String,
  isActive: { type: Boolean, default: true },
  sortOrder: Number,
  partCount: { type: Number, default: 0 }
});

const PartCategorySchema = new mongoose.Schema({
  slug: String,
  name: String,
  applianceTypeSlug: String,
  icon: String,
  description: String,
  sortOrder: Number,
  partCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
});

const BrandSchema = new mongoose.Schema({
  slug: String,
  name: String,
  logoUrl: String,
  applianceTypes: [String],
  isActive: { type: Boolean, default: true }
});

const SparePartSchema = new mongoose.Schema({
  sku: { type: String, unique: true },
  slug: String,
  name: String,
  description: String,
  imageUrls: [String],
  applianceTypeSlug: String,
  isUniversal: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  brandSlug: String,
  partCategory: String,
  partNumber: { type: String, unique: true, sparse: true },
  price: Number,
  mrp: Number,
  stock: { type: Number, default: 0 },
  isInStock: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const CategoryTreeSchema = new mongoose.Schema({
  applianceTypeSlug: String,
  applianceTypeName: String,
  applianceTypeIcon: String,
  sortOrder: Number,
  partCategories: [Object],
  brands: [Object],
  universalPartsCount: Number,
  totalPartsCount: Number
});

const ApplianceType = mongoose.model('ApplianceType', ApplianceTypeSchema);
const PartCategory = mongoose.model('PartCategory', PartCategorySchema);
const Brand = mongoose.model('Brand', BrandSchema);
const SparePart = mongoose.model('SparePart', SparePartSchema);
const CategoryTree = mongoose.model('CategoryTree', CategoryTreeSchema);

const applianceTypes = [
  { slug: "refrigerator", name: "Refrigerator", icon: "Refrigerator", sortOrder: 1 },
  { slug: "washing-machine", name: "Washing Machine", icon: "WashingMachine", sortOrder: 2 },
  { slug: "air-conditioner", name: "Air Conditioner", icon: "AirConditioner", sortOrder: 3 },
  { slug: "microwave-oven", name: "Microwave & OTG", icon: "Microwave", sortOrder: 4 }
];

const partCategories = [
  // Refrigerator
  { slug: "ref-compressors", name: "Compressors", applianceTypeSlug: "refrigerator", icon: "settings", sortOrder: 1 },
  { slug: "ref-thermostats", name: "Thermostats", applianceTypeSlug: "refrigerator", icon: "thermometer", sortOrder: 2 },
  { slug: "ref-relays", name: "Relays & OLP", applianceTypeSlug: "refrigerator", icon: "zap", sortOrder: 3 },
  { slug: "ref-gaskets", name: "Door Gaskets", applianceTypeSlug: "refrigerator", icon: "shield", sortOrder: 4 },
  
  // Washing Machine
  { slug: "wm-motors", name: "Wash & Spin Motors", applianceTypeSlug: "washing-machine", icon: "settings", sortOrder: 1 },
  { slug: "wm-pumps", name: "Drain Pumps", applianceTypeSlug: "washing-machine", icon: "droplets", sortOrder: 2 },
  { slug: "wm-pcbs", name: "Main Control Boards", applianceTypeSlug: "washing-machine", icon: "cpu", sortOrder: 3 },
  { slug: "wm-belts", name: "Drive Belts", applianceTypeSlug: "washing-machine", icon: "repeat", sortOrder: 4 },
  
  // AC
  { slug: "ac-compressors", name: "Compressors", applianceTypeSlug: "air-conditioner", icon: "settings", sortOrder: 1 },
  { slug: "ac-motors", name: "Fan Motors", applianceTypeSlug: "air-conditioner", icon: "wind", sortOrder: 2 },
  { slug: "ac-remotes", name: "Remote Controllers", applianceTypeSlug: "air-conditioner", icon: "tv", sortOrder: 3 },
  { slug: "ac-capacitors", name: "Run Capacitors", applianceTypeSlug: "air-conditioner", icon: "battery", sortOrder: 4 },

  // Microwave
  { slug: "mw-magnetrons", name: "Magnetrons", applianceTypeSlug: "microwave-oven", icon: "zap", sortOrder: 1 },
  { slug: "mw-motors", name: "Turntable Motors", applianceTypeSlug: "microwave-oven", icon: "refresh-cw", sortOrder: 2 }
];

const brands = [
  { slug: "samsung", name: "Samsung", applianceTypes: ["refrigerator", "washing-machine", "air-conditioner", "microwave-oven"] },
  { slug: "lg", name: "LG", applianceTypes: ["refrigerator", "washing-machine", "air-conditioner", "microwave-oven"] },
  { slug: "whirlpool", name: "Whirlpool", applianceTypes: ["refrigerator", "washing-machine", "air-conditioner"] },
  { slug: "godrej", name: "Godrej", applianceTypes: ["refrigerator", "washing-machine"] },
  { slug: "voltas", name: "Voltas", applianceTypes: ["air-conditioner", "refrigerator"] },
  { slug: "daikin", name: "Daikin", applianceTypes: ["air-conditioner"] }
];

const spareParts = [];

const generateParts = () => {
  // Refrigerator Parts
  const refParts = [
    { name: "Samsung Inverter Compressor", cat: "Compressors", brand: "samsung", featured: true },
    { name: "LG Linear Compressor", cat: "Compressors", brand: "lg", featured: true },
    { name: "Whirlpool Single Door Thermostat", cat: "Thermostats", brand: "whirlpool" },
    { name: "Universal PTC Relay 1-Pin", cat: "Relays & OLP", brand: null, universal: true, featured: true },
    { name: "Godrej Double Door Gasket", cat: "Door Gaskets", brand: "godrej" }
  ];

  // Washing Machine Parts
  const wmParts = [
    { name: "LG Semi-Automatic Wash Motor", cat: "Wash & Spin Motors", brand: "lg", featured: true },
    { name: "Samsung Fully Auto Drain Pump", cat: "Drain Pumps", brand: "samsung", featured: true },
    { name: "Whirlpool Top Load PCB", cat: "Main Control Boards", brand: "whirlpool", featured: true },
    { name: "Godrej Pulsator Set", cat: "Wash & Spin Motors", brand: "godrej" },
    { name: "Universal WM Drive Belt M-21", cat: "Drive Belts", brand: null, universal: true }
  ];

  // AC Parts
  const acParts = [
    { name: "Voltas 1.5 Ton Rotary Compressor", cat: "Compressors", brand: "voltas", featured: true },
    { name: "Daikin Inverter Fan Motor", cat: "Fan Motors", brand: "daikin" },
    { name: "Universal AC Remote (100 in 1)", cat: "Remote Controllers", brand: null, universal: true, featured: true },
    { name: "LG AC Run Capacitor 45MFD", cat: "Run Capacitors", brand: "lg" }
  ];

  const allRaw = [...refParts, ...wmParts, ...acParts];

  allRaw.forEach((p, i) => {
    const typeSlug = refParts.includes(p) ? "refrigerator" : (wmParts.includes(p) ? "washing-machine" : "air-conditioner");
    spareParts.push({
      sku: `SP-FIX-${i+100}`,
      slug: p.name.toLowerCase().replace(/ /g, '-'),
      name: p.name,
      description: `High quality ${p.name} for your home appliance. Reliable and durable.`,
      imageUrls: [`https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=400`],
      applianceTypeSlug: typeSlug,
      brandSlug: p.brand,
      partCategory: p.cat,
      isUniversal: !!p.universal,
      isFeatured: !!p.featured,
      partNumber: `PN-${i+5000}`,
      price: 45000 + (i * 1200),
      mrp: 65000 + (i * 1200),
      stock: 50,
      isInStock: true
    });
  });

  // Generate 150+ more generic parts to fill up the sections
  for (let i = 0; i < 160; i++) {
    const type = applianceTypes[i % applianceTypes.length];
    const brand = brands[i % brands.length];
    const cats = partCategories.filter(c => c.applianceTypeSlug === type.slug);
    if (cats.length === 0) continue;
    
    const cat = cats[i % cats.length];

    spareParts.push({
      sku: `SP-AUTO-MASS-${i}`,
      slug: `mass-gen-part-${i}-${brand.slug}`,
      name: `${brand.name} ${cat.name} - Series ${i+200}`,
      description: `Professional grade ${cat.name} compatible with ${brand.name} ${type.name}. Optimized for long-lasting performance in local conditions.`,
      imageUrls: [`https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=400`],
      applianceTypeSlug: type.slug,
      brandSlug: brand.slug,
      partCategory: cat.name,
      isUniversal: i % 15 === 0,
      isFeatured: i % 12 === 0,
      partNumber: `PN-MASS-${i + 10000}`,
      price: 15000 + (i * 450),
      mrp: 25000 + (i * 450),
      stock: 25 + (i % 100),
      isInStock: true
    });
  }
};

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    generateParts();

    await ApplianceType.deleteMany({});
    await PartCategory.deleteMany({});
    await Brand.deleteMany({});
    await SparePart.deleteMany({});
    await CategoryTree.deleteMany({});
    console.log('Cleared existing data');

    await ApplianceType.insertMany(applianceTypes);
    await PartCategory.insertMany(partCategories);
    await Brand.insertMany(brands);
    await SparePart.insertMany(spareParts);
    console.log('Inserted base collections');

    // Generate Tree
    for (const type of applianceTypes) {
      const typePartCategories = await PartCategory.find({ applianceTypeSlug: type.slug }).sort({ sortOrder: 1 });
      
      const partCategoriesWithNested = await Promise.all(typePartCategories.map(async (cat) => {
        const brandsWithParts = await SparePart.aggregate([
          { $match: { applianceTypeSlug: type.slug, partCategory: cat.name, isActive: true, brandSlug: { $ne: null } } },
          { $group: { _id: "$brandSlug", count: { $sum: 1 } } }
        ]);

        const brandBreakdown = await Promise.all(brandsWithParts.map(async (b) => {
          const brandDoc = await Brand.findOne({ slug: b._id });
          return {
            brandSlug: b._id,
            brandName: brandDoc?.name || b._id,
            partCount: b.count
          };
        }));

        const totalCatCount = await SparePart.countDocuments({ applianceTypeSlug: type.slug, partCategory: cat.name, isActive: true });

        return {
          slug: cat.slug,
          name: cat.name,
          icon: cat.icon,
          partCount: totalCatCount,
          brands: brandBreakdown
        };
      }));

      const typeBrandsDocs = brands.filter(b => b.applianceTypes.includes(type.slug));
      const brandsSummary = await Promise.all(typeBrandsDocs.map(async (b) => {
        const count = await SparePart.countDocuments({ applianceTypeSlug: type.slug, brandSlug: b.slug, isActive: true });
        return {
          brandSlug: b.slug,
          brandName: b.name,
          logoUrl: b.logoUrl || "",
          partCount: count
        };
      }));

      const universalCount = await SparePart.countDocuments({ applianceTypeSlug: type.slug, isUniversal: true, isActive: true });
      const totalCount = await SparePart.countDocuments({ applianceTypeSlug: type.slug, isActive: true });

      await CategoryTree.create({
        applianceTypeSlug: type.slug,
        applianceTypeName: type.name,
        applianceTypeIcon: type.icon,
        sortOrder: type.sortOrder,
        partCategories: partCategoriesWithNested,
        brands: brandsSummary,
        universalPartsCount: universalCount,
        totalPartsCount: totalCount
      });
    }

    console.log('Category Tree generated');
    console.log('Seeding completed');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
