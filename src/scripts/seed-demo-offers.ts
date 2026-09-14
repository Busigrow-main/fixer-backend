import 'dotenv/config';
import mongoose from 'mongoose';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';

const DEMO_OFFERS = [
  {
    campaignKey: 'demo-service-picker',
    title: 'Book the repair your appliance needs',
    description:
      'Choose refrigerator, washing machine, AC, or microwave service with verified Fixxer technicians.',
    badge: 'Demo offer',
    discountText: '₹150 OFF',
    couponCode: 'FIX150',
    imageUrl:
      'https://res.cloudinary.com/dlpj4v4ez/image/upload/v1788863645/fixxer/offers/demo-service-carousel.jpg',
    ctaLabel: 'Choose service',
    ctaHref: '/services',
    theme: 'RED',
    audience: 'SERVICES',
    terms: 'Valid on the first completed repair booking. Demo campaign.',
    isActive: true,
    startsAt: new Date(),
    endsAt: null,
    priority: 100,
  },
  {
    campaignKey: 'demo-patna-trust',
    title: 'A special saving for Patna households',
    description:
      'Join the customers who trust Fixxer for professional appliance care at home.',
    badge: 'Patna special',
    discountText: '20% OFF',
    couponCode: 'PATNA20',
    imageUrl:
      'https://res.cloudinary.com/dlpj4v4ez/image/upload/v1788863645/fixxer/offers/demo-customer-served.jpg',
    ctaLabel: 'Book Fixxer',
    ctaHref: '/services',
    theme: 'DARK',
    audience: 'ALL',
    terms: 'Maximum discount ₹300. Demo campaign.',
    isActive: true,
    startsAt: new Date(),
    endsAt: null,
    priority: 90,
  },
] as const;

async function seedDemoOffers() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  await mongoose.connect(uri);

  const OfferModel =
    mongoose.models[Offer.name] ||
    mongoose.model(Offer.name, OfferSchema);

  for (const offer of DEMO_OFFERS) {
    await OfferModel.updateOne(
      { campaignKey: offer.campaignKey },
      { $set: offer },
      { upsert: true },
    );
    console.log(`Seeded offer: ${offer.campaignKey}`);
  }

  await mongoose.disconnect();
}

seedDemoOffers().catch(async (error) => {
  console.error('Failed to seed demo offers:', error);
  await mongoose.disconnect();
  process.exit(1);
});
