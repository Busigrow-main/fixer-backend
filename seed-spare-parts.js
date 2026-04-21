const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';

// Define Schemas manually for the script
const ApplianceTypeSchema = new mongoose.Schema({
  slug: String,
  name: String,
  description: String,
  icon: String,
  isActive: { type: Boolean, default: true },
  sortOrder: Number,
  partCount: { type: Number, default: 0 }
});

const BrandSchema = new mongoose.Schema({
  slug: String,
  name: String,
  logoUrl: String,
  applianceTypes: [String],
  isActive: { type: Boolean, default: true }
});

const ModelSchema = new mongoose.Schema({
  modelNumber: String,
  displayName: String,
  brandId: mongoose.Schema.Types.ObjectId,
  brandSlug: String,
  applianceTypeSlug: String,
  specifications: Object,
  imageUrl: String,
  isActive: { type: Boolean, default: true }
});

const SparePartSchema = new mongoose.Schema({
  sku: String,
  slug: String,
  name: String,
  description: String,
  imageUrls: [String],
  applianceTypeSlug: String,
  isUniversal: { type: Boolean, default: false },
  brandId: mongoose.Schema.Types.ObjectId,
  brandSlug: String,
  compatibleModels: [Object],
  crossBrandCompatibility: [String],
  partCategory: String,
  partNumber: String,
  alternatePartNumbers: [String],
  partType: Object,
  price: Number,
  mrp: Number,
  stock: { type: Number, default: 0 },
  isInStock: { type: Boolean, default: true },
  tags: [String],
  searchKeywords: [String],
  installationDifficulty: Object,
  warrantyMonths: Number,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const CategoryTreeSchema = new mongoose.Schema({
  applianceTypeSlug: String,
  applianceTypeName: String,
  applianceTypeIcon: String,
  sortOrder: Number,
  brands: [Object],
  universalPartsCount: Number,
  totalPartsCount: Number
});

const ApplianceType = mongoose.model('ApplianceType', ApplianceTypeSchema);
const Brand = mongoose.model('Brand', BrandSchema);
const Model = mongoose.model('Model', ModelSchema);
const SparePart = mongoose.model('SparePart', SparePartSchema);
const CategoryTree = mongoose.model('CategoryTree', CategoryTreeSchema);

const applianceTypes = [
  { slug: "refrigerator", name: "Refrigerator", description: "Single door, double door, side-by-side, French door refrigerators", icon: "Refrigerator", isActive: true, sortOrder: 1 },
  { slug: "washing-machine", name: "Washing Machine", description: "Top load, front load, and semi-automatic washing machines", icon: "WashingMachine", isActive: true, sortOrder: 2 },
  { slug: "air-conditioner", name: "Air Conditioner", description: "Split AC, window AC, tower AC, cassette AC", icon: "AirConditioner", isActive: true, sortOrder: 3 },
  { slug: "microwave-oven", name: "Microwave & OTG", description: "Solo microwave, grill, convection, OTG", icon: "Microwave", isActive: true, sortOrder: 4 },
  { slug: "water-purifier", name: "Water Purifier", description: "RO, UV, gravity-based water purifiers", icon: "WaterPurifier", isActive: true, sortOrder: 5 },
  { slug: "television", name: "Television", description: "LED, OLED, QLED and Smart TVs", icon: "Tv", isActive: true, sortOrder: 6 },
  { slug: "geyser", name: "Water Heater / Geyser", description: "Storage, instant and heat pump water heaters", icon: "Droplets", isActive: true, sortOrder: 7 },
  { slug: "ceiling-fan", name: "Ceiling Fan", description: "Standard, BLDC, and decorative ceiling fans", icon: "Fan", isActive: true, sortOrder: 8 }
];

const brandsData = [
  { slug: "samsung", name: "Samsung", applianceTypes: ["refrigerator","washing-machine","air-conditioner","microwave-oven","television"] },
  { slug: "lg", name: "LG", applianceTypes: ["refrigerator","washing-machine","air-conditioner","microwave-oven","television","water-purifier"] },
  { slug: "whirlpool", name: "Whirlpool", applianceTypes: ["refrigerator","washing-machine","air-conditioner","microwave-oven"] },
  { slug: "godrej", name: "Godrej", applianceTypes: ["refrigerator","washing-machine","air-conditioner"] },
  { slug: "haier", name: "Haier", applianceTypes: ["refrigerator","washing-machine","air-conditioner","television"] },
  { slug: "ifb", name: "IFB", applianceTypes: ["washing-machine","microwave-oven","dishwasher"] },
  { slug: "bosch", name: "Bosch", applianceTypes: ["washing-machine","refrigerator","dishwasher"] },
  { slug: "daikin", name: "Daikin", applianceTypes: ["air-conditioner"] },
  { slug: "voltas", name: "Voltas", applianceTypes: ["air-conditioner","refrigerator"] },
  { slug: "hitachi", name: "Hitachi", applianceTypes: ["air-conditioner","refrigerator","washing-machine"] },
  { slug: "panasonic", name: "Panasonic", applianceTypes: ["air-conditioner","washing-machine","microwave-oven","television"] },
  { slug: "kent", name: "Kent", applianceTypes: ["water-purifier"] },
  { slug: "aquaguard", name: "Aquaguard", applianceTypes: ["water-purifier"] },
  { slug: "orient", name: "Orient", applianceTypes: ["ceiling-fan","air-conditioner","television"] },
  { slug: "havells", name: "Havells", applianceTypes: ["ceiling-fan","geyser"] },
  { slug: "bajaj", name: "Bajaj", applianceTypes: ["ceiling-fan","geyser","microwave-oven"] },
  { slug: "ao-smith", name: "AO Smith", applianceTypes: ["geyser","water-purifier"] },
];

const modelsData = [
  {
    modelNumber: "RT28T3722S8",
    displayName: "Samsung 253L Double Door Frost Free",
    brandSlug: "samsung",
    applianceTypeSlug: "refrigerator",
    specifications: { capacity: "253L", type: "Double Door", year: 2022, energyRating: "3 Star" }
  },
  {
    modelNumber: "GL-B201APZD",
    displayName: "LG 190L Single Door Direct Cool",
    brandSlug: "lg",
    applianceTypeSlug: "refrigerator",
    specifications: { capacity: "190L", type: "Single Door", year: 2023, energyRating: "5 Star" }
  },
  {
    modelNumber: "IF INV455ERSC",
    displayName: "Whirlpool 440L French Door",
    brandSlug: "whirlpool",
    applianceTypeSlug: "refrigerator",
    specifications: { capacity: "440L", type: "French Door", year: 2023, energyRating: "3 Star" }
  },
  {
    modelNumber: "WA70A4002GS",
    displayName: "Samsung 7kg Top Load Fully Automatic",
    brandSlug: "samsung",
    applianceTypeSlug: "washing-machine",
    specifications: { capacity: "7kg", type: "Top Load", year: 2022, energyRating: "5 Star" }
  },
  {
    modelNumber: "FHM1408BDL",
    displayName: "LG 8kg Front Load Inverter",
    brandSlug: "lg",
    applianceTypeSlug: "washing-machine",
    specifications: { capacity: "8kg", type: "Front Load", year: 2023, energyRating: "5 Star" }
  }
];

const sparePartsData = [
  {
    sku: "SP-REF-SAM-COMP-001",
    name: "Compressor - Samsung Refrigerator",
    slug: "compressor-samsung-refrigerator",
    description: "Original Samsung rotary compressor for double door frost-free models. R600a refrigerant compatible.",
    applianceTypeSlug: "refrigerator",
    isUniversal: false,
    brandSlug: "samsung",
    compatibleModels: [
      { modelNumber: "RT28T3722S8", displayName: "Samsung 253L Double Door" }
    ],
    partCategory: "Cooling & Compressor",
    partNumber: "DA35-00105K",
    partType: { type: "OEM" },
    price: 450000,
    mrp: 550000,
    stock: 12,
    isInStock: true,
    tags: ["compressor", "cooling", "samsung", "refrigerator"],
    installationDifficulty: { type: "Professional Only" },
    warrantyMonths: 12,
    imageUrls: ["https://images.unsplash.com/photo-1581092160562-40aa08e78837"]
  },
  {
    sku: "SP-REF-SAM-GASKET-001",
    name: "Door Gasket / Seal - Samsung Double Door",
    slug: "door-gasket-samsung-double-door",
    description: "Magnetic door gasket for Samsung RT-series double door refrigerators. Prevents cold air leakage.",
    applianceTypeSlug: "refrigerator",
    isUniversal: false,
    brandSlug: "samsung",
    compatibleModels: [
      { modelNumber: "RT28T3722S8", displayName: "Samsung 253L Double Door" }
    ],
    partCategory: "Seals & Gaskets",
    partNumber: "DA97-07592B",
    partType: { type: "OEM" },
    price: 85000,
    mrp: 110000,
    stock: 28,
    isInStock: true,
    tags: ["gasket", "seal", "door", "samsung", "refrigerator"],
    installationDifficulty: { type: "Medium" },
    warrantyMonths: 6,
    imageUrls: ["https://images.unsplash.com/photo-1584622650111-993a426fbf0a"]
  },
  {
    sku: "SP-REF-UNI-FILTER-001",
    name: "Universal Refrigerator Water Filter",
    slug: "universal-refrigerator-water-filter",
    description: "Universal inline water filter for refrigerators with water dispensers. Fits most brands with 1/4 inch OD tubing.",
    applianceTypeSlug: "refrigerator",
    isUniversal: true,
    brandSlug: null,
    compatibleModels: [],
    crossBrandCompatibility: ["samsung", "lg", "whirlpool", "godrej", "haier"],
    partCategory: "Filters",
    partNumber: "UNI-WF-001",
    partType: { type: "Universal" },
    price: 45000,
    mrp: 65000,
    stock: 150,
    isInStock: true,
    tags: ["filter", "water filter", "universal", "refrigerator", "generic"],
    installationDifficulty: { type: "Easy" },
    warrantyMonths: 3,
    imageUrls: ["https://images.unsplash.com/photo-1595113316349-9fa4ee24f884"]
  },
  {
    sku: "SP-WM-SAM-PUMP-001",
    name: "Drain Pump Motor - Samsung Top Load",
    slug: "drain-pump-motor-samsung-top-load",
    description: "Samsung OEM drain pump for WA-series top load washing machines.",
    applianceTypeSlug: "washing-machine",
    isUniversal: false,
    brandSlug: "samsung",
    compatibleModels: [
      { modelNumber: "WA70A4002GS", displayName: "Samsung 7kg Top Load" }
    ],
    partCategory: "Motors & Pumps",
    partNumber: "DC31-00181A",
    partType: { type: "OEM" },
    price: 125000,
    mrp: 160000,
    stock: 18,
    isInStock: true,
    tags: ["drain pump", "motor", "samsung", "washing machine", "top load"],
    installationDifficulty: { type: "Medium" },
    warrantyMonths: 6,
    imageUrls: ["https://images.unsplash.com/photo-1581092160562-40aa08e78837"]
  },
  {
    sku: "SP-WM-UNI-HOSE-001",
    name: "Universal Washing Machine Inlet Hose (1.5m)",
    slug: "universal-washing-machine-inlet-hose",
    description: "Universal 1.5-meter water inlet hose with standard 3/4 inch BSP fittings.",
    applianceTypeSlug: "washing-machine",
    isUniversal: true,
    brandSlug: null,
    compatibleModels: [],
    crossBrandCompatibility: ["samsung", "lg", "whirlpool", "ifb", "bosch", "haier", "godrej"],
    partCategory: "Motors & Pumps",
    partNumber: "UNI-INLET-HOSE-150",
    partType: { type: "Universal" },
    price: 8000,
    mrp: 15000,
    stock: 300,
    isInStock: true,
    tags: ["hose", "inlet", "water pipe", "universal", "washing machine"],
    installationDifficulty: { type: "Easy" },
    warrantyMonths: 12,
    imageUrls: ["https://images.unsplash.com/photo-1584622650111-993a426fbf0a"]
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Clean existing data
    await ApplianceType.deleteMany({});
    await Brand.deleteMany({});
    await Model.deleteMany({});
    await SparePart.deleteMany({});
    await CategoryTree.deleteMany({});
    console.log('Cleared existing spare parts collections');

    // Insert Appliance Types
    const insertedTypes = await ApplianceType.insertMany(applianceTypes);
    console.log(`Inserted ${insertedTypes.length} appliance types`);

    // Insert Brands
    const insertedBrands = await Brand.insertMany(brandsData);
    console.log(`Inserted ${insertedBrands.length} brands`);

    // Insert Models
    const brandsMap = {};
    insertedBrands.forEach(b => brandsMap[b.slug] = b._id);

    const fullModels = modelsData.map(m => ({
      ...m,
      brandId: brandsMap[m.brandSlug]
    }));
    const insertedModels = await Model.insertMany(fullModels);
    console.log(`Inserted ${insertedModels.length} models`);

    // Insert Spare Parts
    const modelsMap = {};
    insertedModels.forEach(m => modelsMap[m.modelNumber] = m._id);

    const fullParts = sparePartsData.map(p => {
      const part = { ...p };
      if (p.brandSlug) part.brandId = brandsMap[p.brandSlug];
      part.compatibleModels = p.compatibleModels.map(cm => ({
        ...cm,
        modelId: modelsMap[cm.modelNumber]
      }));
      return part;
    });
    const insertedParts = await SparePart.insertMany(fullParts);
    console.log(`Inserted ${insertedParts.length} spare parts`);

    // Generate Category Tree (denormalized)
    console.log('Generating category tree...');
    for (const type of applianceTypes) {
      const typeBrands = brandsData.filter(b => b.applianceTypes.includes(type.slug));
      
      const brandsWithCounts = await Promise.all(typeBrands.map(async (brand) => {
        const count = await SparePart.countDocuments({ 
          applianceTypeSlug: type.slug, 
          brandSlug: brand.slug,
          isActive: true 
        });
        
        const hasUniversal = await SparePart.exists({
          applianceTypeSlug: type.slug,
          brandSlug: brand.slug,
          isUniversal: true,
          isActive: true
        });

        return {
          brandSlug: brand.slug,
          brandName: brand.name,
          logoUrl: brand.logoUrl || "",
          partCount: count,
          hasUniversalParts: !!hasUniversal
        };
      }));

      const universalCount = await SparePart.countDocuments({
        applianceTypeSlug: type.slug,
        isUniversal: true,
        isActive: true
      });

      const totalCount = await SparePart.countDocuments({
        applianceTypeSlug: type.slug,
        isActive: true
      });

      await CategoryTree.create({
        applianceTypeSlug: type.slug,
        applianceTypeName: type.name,
        applianceTypeIcon: type.icon,
        sortOrder: type.sortOrder,
        brands: brandsWithCounts,
        universalPartsCount: universalCount,
        totalPartsCount: totalCount
      });
    }
    console.log('Category tree generated');

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();
