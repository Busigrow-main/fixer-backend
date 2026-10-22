import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { OffersController } from './offers/offers.controller';
import { Offer, OfferDocument, OfferSchema } from './offers/schemas/offer.schema';
import { OffersService } from './offers/offers.service';
import { ServicesController } from './services/services.controller';
import { Service, ServiceDocument, ServiceSchema } from './services/schemas/service.schema';
import { ServicesService } from './services/services.service';

describe('Home page data endpoints', () => {
  jest.setTimeout(60_000);

  let mongo: MongoMemoryServer;
  let module: TestingModule;
  let services: ServicesController;
  let offers: OffersController;
  let serviceModel: Model<ServiceDocument>;
  let offerModel: Model<OfferDocument>;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri()),
        MongooseModule.forFeature([
          { name: Service.name, schema: ServiceSchema },
          { name: Offer.name, schema: OfferSchema },
        ]),
      ],
      controllers: [ServicesController, OffersController],
      providers: [ServicesService, OffersService],
    }).compile();

    services = module.get(ServicesController);
    offers = module.get(OffersController);
    serviceModel = module.get(getModelToken(Service.name));
    offerModel = module.get(getModelToken(Offer.name));
  });

  afterAll(async () => {
    await module?.close();
    await mongo?.stop();
  });

  it('returns service catalog documents from MongoDB with the fields Home needs', async () => {
    await serviceModel.create({
      slug: 'washing-machine',
      name: 'Washing Machine',
      title: 'Washing machine repair',
      startingPrice: 'â‚¹249',
      icon: 'local_laundry_service',
      image: 'https://example.com/washing-machine.jpg',
      description: 'Repair service',
      features: ['Repair'],
      subCategories: [{ name: 'Front Load', price: 'â‚¹449' }],
    });

    const response = await services.findAll();

    expect(response).toHaveLength(1);
    expect(response[0]).toMatchObject({
      slug: 'washing-machine',
      name: 'Washing Machine',
      image: 'https://example.com/washing-machine.jpg',
      startingPrice: 'â‚¹249',
    });
    expect(response[0]._id).toBeDefined();
  });

  it('returns active, in-window offers from MongoDB for frontend audience filtering', async () => {
    await offerModel.create([
      {
        title: 'Home repair offer',
        discountText: '10% OFF',
        imageUrl: 'https://example.com/repair.jpg',
        ctaLabel: 'Book now',
        ctaHref: '/services',
        audience: 'SERVICES',
        isActive: true,
        startsAt: null,
        endsAt: null,
        priority: 2,
      },
      {
        title: 'Shop offer',
        discountText: '5% OFF',
        ctaHref: '/shop',
        audience: 'SHOP',
        isActive: true,
        startsAt: null,
        endsAt: null,
        priority: 1,
      },
      {
        title: 'Expired offer',
        discountText: '5% OFF',
        audience: 'ALL',
        isActive: true,
        startsAt: null,
        endsAt: new Date(Date.now() - 60_000),
      },
    ]);

    const response = await offers.liveOffers();

    expect(response).toHaveLength(2);
    expect(response.map((offer) => offer.title)).toEqual([
      'Home repair offer',
      'Shop offer',
    ]);
    expect(response[0]).toMatchObject({
      discountText: '10% OFF',
      imageUrl: 'https://example.com/repair.jpg',
      ctaLabel: 'Book now',
      ctaHref: '/services',
      audience: 'SERVICES',
    });
  });
});
