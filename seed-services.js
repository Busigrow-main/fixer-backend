const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://localhost:27017/fixxer';

// Define mini-schemas for seeding (must match NestJS schemas)
const SubCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: String, required: true }
});

const ServiceSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  title: { type: String, required: true },
  startingPrice: { type: String, required: true },
  icon: { type: String, required: true },
  image: { type: String, required: true },
  description: { type: String, required: true },
  features: { type: [String], default: [] },
  subCategories: [SubCategorySchema]
}, { timestamps: true });

const Service = mongoose.model('Service', ServiceSchema);

const SERVICES_DATA = [
  {
    slug: "refrigerator",
    name: "Refrigerator",
    title: "Expert Refrigerator Repair",
    startingPrice: "₹249",
    icon: "ac_unit",
    image: "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=2000&auto=format&fit=crop",
    description: "Professional grade technical mastery for your kitchen's heart. Fixed base service charges depending on appliance type and category.",
    features: ["60 Days Service Warranty", "Up to 30 Days Part Warranty", "Transparent Pricing", "Genuine Spare Parts"],
    subCategories: [
      { name: "Single Door Refrigerator", price: "₹249" },
      { name: "Double Door Refrigerator", price: "₹349" },
      { name: "Deep Freezer", price: "₹449" },
    ],
  },
  {
    slug: "washing-machine",
    name: "Washing Machine",
    title: "Premium Washing Machine Service",
    startingPrice: "₹249",
    icon: "local_laundry_service",
    image: "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?q=80&w=2000&auto=format&fit=crop",
    description: "Don't let laundry pile up. We provide fast, reliable repairs with transparent pricing and standardized service experience.",
    features: ["60 Days Service Warranty", "Up to 30 Days Part Warranty", "Transparent Pricing", "Vibration & Noise Diagnosis"],
    subCategories: [
      { name: "Semi-Automatic Washing Machine", price: "₹249" },
      { name: "Fully Automatic (Top Load)", price: "₹349" },
      { name: "Fully Automatic (Front Load)", price: "₹449–₹549" },
    ],
  },
  {
    slug: "microwave",
    name: "Microwave",
    title: "Professional Microwave Repair",
    startingPrice: "₹249",
    icon: "cooking",
    image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=2000&auto=format&fit=crop",
    description: "Keep your kitchen running perfectly. Service pricing is based on appliance volume and capacity. Our technicians are factory-trained for all models.",
    features: ["60 Days Service Warranty", "Up to 30 Days Part Warranty", "Transparent Pricing", "Safety Radiation Checks"],
    subCategories: [
      { name: "Microwave Repair (Based on Volume)", price: "Starting ₹249" },
    ],
  },
  {
    slug: "ac",
    name: "Air Conditioner",
    title: "Modern AC Recovery",
    startingPrice: "₹249",
    icon: "thermostat",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=2000&auto=format&fit=crop",
    description: "Climate master for your home. From installation to complex repairs, we restore your comfort quickly.",
    features: ["60 Days Service Warranty", "Up to 30 Days Part Warranty", "Transparent Pricing", "Installation & Uninstallation"],
    subCategories: [
      { name: "AC Installation", price: "₹1149" },
      { name: "AC Uninstallation", price: "₹749" },
      { name: "AC Cleaning & Repair", price: "₹549" },
      { name: "AC Service", price: "₹449" },
      { name: "AC Repair", price: "₹249" },
    ],
  },
];

async function seedServices() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    for (const serviceData of SERVICES_DATA) {
      await Service.findOneAndUpdate(
        { slug: serviceData.slug },
        serviceData,
        { upsert: true, new: true }
      );
      console.log(`📦 Seeded: ${serviceData.name}`);
    }

    console.log('🎉 Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected.');
  }
}

seedServices();
