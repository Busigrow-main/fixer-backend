/**
 * Idempotently add sample shop appliances for local development.
 *
 * Run with: npm run seed:shop-appliances
 * Existing appliance records are left untouched. Sample records use the
 * `SHOP-SEED-` SKU prefix so they can be identified in the database.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';
import { Appliance, ApplianceSchema } from '../appliances/schemas/appliance.schema';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type ShopCategory = 'ac' | 'refrigerator' | 'washing-machine' | 'microwave';

type SeedItem = {
  category: ShopCategory;
  brand: string;
  name: string;
  modelNumber: string;
  price: number;
  image: string;
  shortDescription: string;
  capacityTon?: number;
  starRating?: number;
  acType?: 'split' | 'window' | 'cassette' | 'portable';
  isInverter?: boolean;
  roomSizeRecommendation?: string;
  warrantyYears: number;
  highlights: { icon: string; title: string; description: string }[];
  specs: Record<string, string | number | boolean>;
};

const images = {
  ac: 'https://images.unsplash.com/photo-1621619856624-42fd193a0661?w=900&h=900&fit=crop',
  refrigerator: 'https://images.unsplash.com/photo-1571175443880-49e1d5c5b1f9?w=900&h=900&fit=crop',
  washingMachine: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=900&h=900&fit=crop',
  microwave: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=900&h=900&fit=crop',
};

const seedItems: SeedItem[] = [
  {
    category: 'ac', brand: 'LG', name: 'LG 1.5 Ton 5-Star Inverter Split AC', modelNumber: 'SHOP-DEMO-LG-AC15',
    price: 48990, image: images.ac, shortDescription: 'Sample shop listing · 1.5 Ton · 5-Star Inverter',
    capacityTon: 1.5, starRating: 5, acType: 'split', isInverter: true, roomSizeRecommendation: 'Up to 160 sq. ft.',
    warrantyYears: 1, highlights: [{ icon: 'verified', title: '5-Star energy rating', description: 'Efficient cooling for everyday use.' }],
    specs: { coolingCapacityBtu: '5100 BTU/hr', refrigerant: 'R-32', compressorType: 'Inverter' },
  },
  {
    category: 'ac', brand: 'Samsung', name: 'Samsung 1.5 Ton 3-Star Inverter Split AC', modelNumber: 'SHOP-DEMO-SAM-AC15',
    price: 42990, image: images.ac, shortDescription: 'Sample shop listing · 1.5 Ton · Inverter Split AC',
    capacityTon: 1.5, starRating: 3, acType: 'split', isInverter: true, roomSizeRecommendation: 'Up to 160 sq. ft.',
    warrantyYears: 1, highlights: [{ icon: 'ac_unit', title: 'Fast cooling', description: 'Designed for comfortable room temperatures.' }],
    specs: { coolingCapacityBtu: '5000 BTU/hr', refrigerant: 'R-32', compressorType: 'Inverter' },
  },
  {
    category: 'ac', brand: 'Voltas', name: 'Voltas 1.5 Ton 3-Star Window AC', modelNumber: 'SHOP-DEMO-VOL-AC15',
    price: 33990, image: images.ac, shortDescription: 'Sample shop listing · 1.5 Ton · Window AC',
    capacityTon: 1.5, starRating: 3, acType: 'window', isInverter: false, roomSizeRecommendation: 'Up to 160 sq. ft.',
    warrantyYears: 1, highlights: [{ icon: 'ac_unit', title: 'Window AC', description: 'A compact cooling option for compatible windows.' }],
    specs: { coolingCapacityBtu: '4800 BTU/hr', refrigerant: 'R-32', compressorType: 'Fixed Speed' },
  },
  {
    category: 'refrigerator', brand: 'LG', name: 'LG 260 L Frost-Free Double Door Refrigerator', modelNumber: 'SHOP-DEMO-LG-REF260',
    price: 28990, image: images.refrigerator, shortDescription: 'Sample shop listing · 260 L · Frost-Free Double Door',
    warrantyYears: 1, highlights: [{ icon: 'kitchen', title: 'Frost-free cooling', description: 'Even cooling with no manual defrosting.' }],
    specs: { capacity: '260 L', doorType: 'Double Door', energyRating: '3 Star' },
  },
  {
    category: 'refrigerator', brand: 'Samsung', name: 'Samsung 253 L Digital Inverter Refrigerator', modelNumber: 'SHOP-DEMO-SAM-REF253',
    price: 31490, image: images.refrigerator, shortDescription: 'Sample shop listing · 253 L · Digital Inverter',
    warrantyYears: 1, highlights: [{ icon: 'kitchen', title: 'Digital inverter', description: 'Consistent cooling with reduced operating noise.' }],
    specs: { capacity: '253 L', doorType: 'Double Door', energyRating: '3 Star' },
  },
  {
    category: 'refrigerator', brand: 'Whirlpool', name: 'Whirlpool 265 L Frost-Free Refrigerator', modelNumber: 'SHOP-DEMO-WHI-REF265',
    price: 27990, image: images.refrigerator, shortDescription: 'Sample shop listing · 265 L · Frost-Free',
    warrantyYears: 1, highlights: [{ icon: 'kitchen', title: 'Flexible storage', description: 'Room for fresh and frozen groceries.' }],
    specs: { capacity: '265 L', doorType: 'Double Door', energyRating: '2 Star' },
  },
  {
    category: 'washing-machine', brand: 'LG', name: 'LG 8 kg Front Load Washing Machine', modelNumber: 'SHOP-DEMO-LG-WM08F',
    price: 36990, image: images.washingMachine, shortDescription: 'Sample shop listing · 8 kg · Front Load',
    warrantyYears: 2, highlights: [{ icon: 'local_laundry_service', title: 'Front load', description: 'Multiple wash programs for daily laundry.' }],
    specs: { capacity: '8 kg', loadType: 'Front Load', spinSpeed: '1200 RPM' },
  },
  {
    category: 'washing-machine', brand: 'Samsung', name: 'Samsung 8 kg Fully Automatic Top Load Washer', modelNumber: 'SHOP-DEMO-SAM-WM08T',
    price: 21990, image: images.washingMachine, shortDescription: 'Sample shop listing · 8 kg · Fully Automatic Top Load',
    warrantyYears: 2, highlights: [{ icon: 'local_laundry_service', title: 'Top load convenience', description: 'Easy loading with automatic wash programs.' }],
    specs: { capacity: '8 kg', loadType: 'Top Load', spinSpeed: '700 RPM' },
  },
  {
    category: 'washing-machine', brand: 'Whirlpool', name: 'Whirlpool 7.5 kg Semi Automatic Washing Machine', modelNumber: 'SHOP-DEMO-WHI-WM75S',
    price: 11990, image: images.washingMachine, shortDescription: 'Sample shop listing · 7.5 kg · Semi Automatic',
    warrantyYears: 2, highlights: [{ icon: 'local_laundry_service', title: 'Semi automatic', description: 'Separate wash and spin tubs.' }],
    specs: { capacity: '7.5 kg', loadType: 'Semi Automatic', spinSpeed: '1400 RPM' },
  },
  {
    category: 'microwave', brand: 'IFB', name: 'IFB 30 L Convection Microwave Oven', modelNumber: 'SHOP-DEMO-IFB-MW30',
    price: 13990, image: images.microwave, shortDescription: 'Sample shop listing · 30 L · Convection',
    warrantyYears: 1, highlights: [{ icon: 'microwave', title: 'Convection cooking', description: 'Useful for reheating, grilling, and baking.' }],
    specs: { capacity: '30 L', type: 'Convection', power: '900 W' },
  },
  {
    category: 'microwave', brand: 'LG', name: 'LG 28 L Charcoal Convection Microwave', modelNumber: 'SHOP-DEMO-LG-MW28',
    price: 16990, image: images.microwave, shortDescription: 'Sample shop listing · 28 L · Convection',
    warrantyYears: 1, highlights: [{ icon: 'microwave', title: 'Multiple cooking modes', description: 'Convection and grill cooking in one appliance.' }],
    specs: { capacity: '28 L', type: 'Convection', power: '900 W' },
  },
  {
    category: 'microwave', brand: 'Samsung', name: 'Samsung 23 L Solo Microwave Oven', modelNumber: 'SHOP-DEMO-SAM-MW23',
    price: 7490, image: images.microwave, shortDescription: 'Sample shop listing · 23 L · Solo Microwave',
    warrantyYears: 1, highlights: [{ icon: 'microwave', title: 'Simple everyday heating', description: 'Straightforward controls for reheating and defrosting.' }],
    specs: { capacity: '23 L', type: 'Solo', power: '800 W' },
  },
];

function toApplianceDocument(item: SeedItem, index: number) {
  const sku = `SHOP-SEED-${item.category.toUpperCase()}-${String(index + 1).padStart(3, '0')}`;
  const slug = `shop-seed-${item.modelNumber.toLowerCase()}`;
  const price = item.price;
  return {
    slug,
    name: item.name,
    brand: item.brand,
    modelNumber: item.modelNumber,
    sku,
    series: 'Local Development Sample',
    descriptionCode: item.modelNumber,
    price,
    originalPrice: Math.round(price * 1.15),
    nlcPrice: Math.round(price * 0.75),
    capacityTon: item.capacityTon,
    starRating: item.starRating,
    acType: item.acType,
    isInverter: item.isInverter,
    roomSizeRecommendation: item.roomSizeRecommendation,
    shortDescription: item.shortDescription,
    description: `${item.name}. This is sample shop catalog data for local development; confirm current product specifications and availability before purchase.`,
    descriptionSections: [],
    technicalDescription: { sections: [] },
    images: [item.image],
    specsPerformance: item.specs,
    highlights: item.highlights,
    whatsInBox: ['Product unit', 'User manual'],
    inStock: true,
    installationIncluded: item.category === 'ac',
    compressorWarrantyYears: item.category === 'ac' ? 10 : undefined,
    productWarrantyYears: item.warrantyYears,
    applianceCategory: item.category,
    isBestseller: index < 4,
    customerRating: { average: 4.5, count: 12 + index * 3 },
    isActive: true,
  };
}

async function seedShopAppliances() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  await mongoose.connect(uri);

  const ApplianceModel = mongoose.models.Appliance ?? mongoose.model(Appliance.name, ApplianceSchema);
  const operations = seedItems.map((item, index) => {
    const document = toApplianceDocument(item, index);
    return {
      updateOne: {
        filter: { sku: document.sku },
        update: { $setOnInsert: document },
        upsert: true,
      },
    };
  });

  const bulkWrite = ApplianceModel.bulkWrite as unknown as (ops: any[], options: { ordered: boolean }) => Promise<{ upsertedCount: number }>;
  const result = await bulkWrite.call(ApplianceModel, operations, { ordered: true });
  const counts = await ApplianceModel.aggregate([
    { $match: { isActive: true, sku: { $in: operations.map((operation) => operation.updateOne.filter.sku) } } },
    { $group: { _id: '$applianceCategory', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).exec();

  console.log(`Shop appliance seed complete. Inserted ${result.upsertedCount}; already present ${seedItems.length - result.upsertedCount}.`);
  console.log('Sample catalog products by category:', counts);
  await mongoose.disconnect();
}

seedShopAppliances().catch(async (error) => {
  console.error('Shop appliance seed failed:', error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
