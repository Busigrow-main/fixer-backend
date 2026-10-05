import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';
import { Appliance, ApplianceSchema } from '../appliances/schemas/appliance.schema';
import { SparePart, SparePartSchema } from '../spare-parts/schemas/spare-part.schema';
import { ApplianceType, ApplianceTypeSchema } from '../spare-parts/schemas/appliance-type.schema';
import { Brand, BrandSchema } from '../spare-parts/schemas/brand.schema';
import { PartCategory, PartCategorySchema } from '../spare-parts/schemas/part-category.schema';
import { CategoryTree, CategoryTreeSchema } from '../spare-parts/schemas/category-tree.schema';

dotenv.config();

const TARGET_APPLIANCES = 24;
const TARGET_SPARE_PARTS = 120;

const TYPES = [
  { slug: 'refrigerator', name: 'Refrigerator', icon: 'Refrigerator', sortOrder: 1 },
  { slug: 'washing-machine', name: 'Washing Machine', icon: 'WashingMachine', sortOrder: 2 },
  { slug: 'air-conditioner', name: 'Air Conditioner', icon: 'AirConditioner', sortOrder: 3 },
  { slug: 'microwave-oven', name: 'Microwave & OTG', icon: 'Microwave', sortOrder: 4 },
];

const BRANDS = [
  { slug: 'samsung', name: 'Samsung', applianceTypes: TYPES.map((type) => type.slug) },
  { slug: 'lg', name: 'LG', applianceTypes: TYPES.map((type) => type.slug) },
  { slug: 'whirlpool', name: 'Whirlpool', applianceTypes: ['refrigerator', 'washing-machine'] },
  { slug: 'godrej', name: 'Godrej', applianceTypes: ['refrigerator', 'washing-machine', 'air-conditioner'] },
  { slug: 'voltas', name: 'Voltas', applianceTypes: ['air-conditioner'] },
  { slug: 'daikin', name: 'Daikin', applianceTypes: ['air-conditioner'] },
];

const CATEGORIES = [
  ['ref-compressors', 'Compressors', 'refrigerator', 'settings'],
  ['ref-thermostats', 'Thermostats', 'refrigerator', 'thermometer'],
  ['ref-relays', 'Relays & OLP', 'refrigerator', 'bolt'],
  ['ref-gaskets', 'Door Gaskets', 'refrigerator', 'shield'],
  ['wm-motors', 'Wash & Spin Motors', 'washing-machine', 'settings'],
  ['wm-pumps', 'Drain Pumps', 'washing-machine', 'water_drop'],
  ['wm-pcbs', 'Main Control Boards', 'washing-machine', 'memory'],
  ['wm-belts', 'Drive Belts', 'washing-machine', 'sync'],
  ['ac-compressors', 'Compressors', 'air-conditioner', 'settings'],
  ['ac-motors', 'Fan Motors', 'air-conditioner', 'air'],
  ['ac-remotes', 'Remote Controllers', 'air-conditioner', 'tv'],
  ['ac-capacitors', 'Run Capacitors', 'air-conditioner', 'battery'],
  ['mw-magnetrons', 'Magnetrons', 'microwave-oven', 'bolt'],
  ['mw-motors', 'Turntable Motors', 'microwave-oven', 'sync'],
] as const;

const image =
  'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=600';

function buildParts() {
  return Array.from({ length: TARGET_SPARE_PARTS }, (_, index) => {
    const category = CATEGORIES[index % CATEGORIES.length];
    const type = TYPES.find((item) => item.slug === category[2])!;
    const brand = BRANDS[index % BRANDS.length];
    const universal = index % 11 === 0;
    const partNumber = `FIX-DEMO-${String(index + 1).padStart(4, '0')}`;

    return {
      sku: `SP-FIX-DEMO-${String(index + 1).padStart(4, '0')}`,
      slug: `fixer-demo-${type.slug}-${category[0]}-${index + 1}`,
      name: universal
        ? `Universal ${category[1]} ${index + 1}`
        : `${brand.name} ${category[1]} ${index + 1}`,
      description: `Demo catalogue listing for ${category[1].toLowerCase()} compatible with ${type.name.toLowerCase()} appliances.`,
      imageUrls: [image],
      applianceTypeSlug: type.slug,
      isUniversal: universal,
      isFeatured: index % 10 === 0,
      brandSlug: universal ? undefined : brand.slug,
      partCategory: category[1],
      partNumber,
      alternatePartNumbers: [],
      partType: { type: universal ? 'Universal' : index % 3 === 0 ? 'OEM' : 'OEM-Equivalent' },
      price: 450 + (index % 18) * 125,
      mrp: 650 + (index % 18) * 150,
      stock: 10 + (index % 40),
      isInStock: true,
      tags: [type.name, category[1], brand.name],
      searchKeywords: [partNumber, type.slug, category[0]],
      installationDifficulty: { type: index % 4 === 0 ? 'Professional Only' : 'Medium' },
      warrantyMonths: index % 5 === 0 ? 12 : 6,
      isActive: true,
    };
  });
}

function buildAppliances() {
  const brands = ['Samsung', 'LG', 'Whirlpool', 'Godrej', 'Voltas', 'Daikin'];
  return Array.from({ length: TARGET_APPLIANCES }, (_, index) => {
    const brand = brands[index % brands.length];
    const capacityTon = 1 + (index % 3) * 0.5;
    const modelNumber = `FIX-${brand.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, '0')}`;
    const sku = `APP-FIX-DEMO-${String(index + 1).padStart(4, '0')}`;
    const price = 28999 + (index % 8) * 3500;

    return {
      slug: `fixer-demo-${brand.toLowerCase()}-${index + 1}`,
      name: `${brand} ${capacityTon} Ton ${index % 2 ? 'Inverter' : 'Fixed Speed'} Split AC`,
      brand,
      modelNumber,
      sku,
      series: 'Fixer Demo Series',
      descriptionCode: modelNumber,
      price,
      originalPrice: price + 5000,
      nlcPrice: price - 3000,
      capacityTon,
      starRating: 3 + (index % 3),
      acType: 'split',
      isInverter: index % 2 === 1,
      roomSizeRecommendation: capacityTon <= 1 ? 'Up to 100 sq. ft.' : '100 – 160 sq. ft.',
      shortDescription: `Demo ${brand} air conditioner listing for the Fixer Shop catalogue.`,
      images: [image],
      descriptionSections: [],
      technicalDescription: { sections: [] },
      specsPerformance: {
        coolingCapacityBtu: `${Math.round(capacityTon * 3400)} BTU/hr`,
        refrigerant: 'R-32',
        compressorType: index % 2 ? 'Inverter' : 'Fixed Speed',
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
      highlights: [],
      whatsInBox: ['Indoor Unit', 'Outdoor Unit', 'Remote Control', 'User Manual'],
      inStock: true,
      installationIncluded: true,
      compressorWarrantyYears: 10,
      productWarrantyYears: 1,
      applianceCategory: 'ac',
      isActive: true,
    };
  });
}

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  await mongoose.connect(uri);

  const ApplianceModel = mongoose.models.Appliance ?? mongoose.model(Appliance.name, ApplianceSchema);
  const SparePartModel = mongoose.models.SparePart ?? mongoose.model(SparePart.name, SparePartSchema);
  const ApplianceTypeModel = mongoose.models.ApplianceType ?? mongoose.model(ApplianceType.name, ApplianceTypeSchema);
  const BrandModel = mongoose.models.Brand ?? mongoose.model(Brand.name, BrandSchema);
  const PartCategoryModel = mongoose.models.PartCategory ?? mongoose.model(PartCategory.name, PartCategorySchema);
  const CategoryTreeModel = mongoose.models.CategoryTree ?? mongoose.model(CategoryTree.name, CategoryTreeSchema);

  const [applianceCount, sparePartCount] = await Promise.all([
    ApplianceModel.countDocuments({ isActive: true }),
    SparePartModel.countDocuments({ isActive: true }),
  ]);

  const appliances = buildAppliances();
  const parts = buildParts();

  if (applianceCount < TARGET_APPLIANCES) {
    await ApplianceModel.bulkWrite(
      appliances.map((doc) => ({
        updateOne: { filter: { sku: doc.sku }, update: { $setOnInsert: doc }, upsert: true },
      })),
    );
  }

  if (sparePartCount < TARGET_SPARE_PARTS) {
    await SparePartModel.bulkWrite(
      parts.map((doc) => ({
        updateOne: { filter: { sku: doc.sku }, update: { $setOnInsert: doc }, upsert: true },
      })),
    );
  }

  for (const type of TYPES) {
    await ApplianceTypeModel.updateOne(
      { slug: type.slug },
      { $setOnInsert: { ...type, description: `${type.name} spare parts catalogue`, isActive: true } },
      { upsert: true },
    );
  }

  for (const brand of BRANDS) {
    await BrandModel.updateOne({ slug: brand.slug }, { $setOnInsert: { ...brand, isActive: true } }, { upsert: true });
  }

  for (const [slug, name, applianceTypeSlug, icon] of CATEGORIES) {
    await PartCategoryModel.updateOne(
      { slug },
      { $setOnInsert: { slug, name, applianceTypeSlug, icon, sortOrder: 1, isActive: true } },
      { upsert: true },
    );
  }

  for (const type of TYPES) {
    const categories = await PartCategoryModel.find({ applianceTypeSlug: type.slug, isActive: true }).sort({ sortOrder: 1 }).lean();
    const brandsForType = BRANDS.filter((brand) => brand.applianceTypes.includes(type.slug));
    const brandCounts = await SparePartModel.aggregate([
      { $match: { applianceTypeSlug: type.slug, isActive: true, brandSlug: { $ne: null } } },
      { $group: { _id: '$brandSlug', partCount: { $sum: 1 } } },
    ]);
    const categoryData = await Promise.all(
      categories.map(async (category) => {
        const categoryParts = await SparePartModel.aggregate([
          { $match: { applianceTypeSlug: type.slug, partCategory: category.name, isActive: true } },
          { $group: { _id: '$brandSlug', partCount: { $sum: 1 } } },
        ]);
        return {
          slug: category.slug,
          name: category.name,
          icon: category.icon || 'category',
          partCount: categoryParts.reduce((sum, item) => sum + item.partCount, 0),
          brands: categoryParts.filter((item) => item._id).map((item) => ({
            brandSlug: item._id,
            brandName: BRANDS.find((brand) => brand.slug === item._id)?.name || item._id,
            partCount: item.partCount,
          })),
        };
      }),
    );
    const typeParts = await SparePartModel.countDocuments({ applianceTypeSlug: type.slug, isActive: true });
    await CategoryTreeModel.updateOne(
      { applianceTypeSlug: type.slug },
      {
        $set: {
          applianceTypeName: type.name,
          applianceTypeIcon: type.icon,
          sortOrder: type.sortOrder,
          partCategories: categoryData,
          brands: brandsForType.map((brand) => ({
            brandSlug: brand.slug,
            brandName: brand.name,
            logoUrl: '',
            partCount: brandCounts.find((item) => item._id === brand.slug)?.partCount || 0,
          })),
          totalPartsCount: typeParts,
          universalPartsCount: await SparePartModel.countDocuments({ applianceTypeSlug: type.slug, isUniversal: true, isActive: true }),
        },
      },
      { upsert: true },
    );
    await ApplianceTypeModel.updateOne({ slug: type.slug }, { $set: { partCount: typeParts } });
  }

  console.log(`Shop catalog checked: ${applianceCount} appliances, ${sparePartCount} spare parts before seeding.`);
  console.log(`Targets: ${TARGET_APPLIANCES} appliances, ${TARGET_SPARE_PARTS} spare parts.`);
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Shop catalog seed failed:', error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
