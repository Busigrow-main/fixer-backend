import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { AppliancesService } from '../appliances/appliances.service';
import { Appliance, ApplianceDocument, ApplianceSchema } from '../appliances/schemas/appliance.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { OffersService } from '../offers/offers.service';
import { PartOrder, PartOrderSchema } from '../part-orders/schemas/part-order.schema';
import { PartOrdersService } from '../part-orders/part-orders.service';
import { ServiceablePincode, ServiceablePincodeSchema } from '../serviceable-pincodes/schemas/serviceable-pincode.schema';
import { ServiceablePincodesService } from '../serviceable-pincodes/serviceable-pincodes.service';
import { SparePart, SparePartDocument, SparePartSchema } from '../spare-parts/schemas/spare-part.schema';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { CartService } from './cart.service';
import { CheckoutService } from './checkout.service';
import { InstallationService } from './installation.service';
import { ShopCart, ShopCartSchema } from './schemas/cart.schema';
import { ShopService } from './shop.service';

describe('Fixxer shop APIs', () => {
  jest.setTimeout(60000);

  let mongod: MongoMemoryServer;
  let module: TestingModule;
  let shopService: ShopService;
  let appliancesService: AppliancesService;
  let cartService: CartService;
  let checkoutService: CheckoutService;
  let installationService: InstallationService;
  let partOrdersService: PartOrdersService;
  let applianceModel: Model<ApplianceDocument>;
  let sparePartModel: Model<SparePartDocument>;
  let userId: string;
  let otherUserId: string;
  let fridge: ApplianceDocument;
  let part: SparePartDocument;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Appliance.name, schema: ApplianceSchema },
          { name: SparePart.name, schema: SparePartSchema },
          { name: ShopCart.name, schema: ShopCartSchema },
          { name: Offer.name, schema: OfferSchema },
          { name: PartOrder.name, schema: PartOrderSchema },
          { name: ServiceablePincode.name, schema: ServiceablePincodeSchema },
        ]),
      ],
      providers: [
        AppliancesService,
        OffersService,
        PartOrdersService,
        ServiceablePincodesService,
        InstallationService,
        CartService,
        CheckoutService,
        ShopService,
        {
          provide: SparePartsService,
          useFactory: (model: Model<SparePartDocument>) => ({
            findById: (id: string) => model.findById(id).exec(),
            listForShop: async (limit = 8, page = 1) => {
              const filter = { isActive: true };
              const [items, total] = await Promise.all([
                model
                  .find(filter)
                  .sort({ isFeatured: -1, soldCount: -1, createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(limit)
                  .lean()
                  .exec(),
                model.countDocuments(filter).exec(),
              ]);
              return { items, total };
            },
          }),
          inject: [getModelToken(SparePart.name)],
        },
      ],
    }).compile();

    shopService = module.get(ShopService);
    appliancesService = module.get(AppliancesService);
    cartService = module.get(CartService);
    checkoutService = module.get(CheckoutService);
    installationService = module.get(InstallationService);
    partOrdersService = module.get(PartOrdersService);
    applianceModel = module.get(getModelToken(Appliance.name));
    sparePartModel = module.get(getModelToken(SparePart.name));
    await Promise.all([
      applianceModel.init(),
      sparePartModel.init(),
      module.get(getModelToken(ShopCart.name)).init(),
    ]);
  });

  afterAll(async () => {
    if (module) await module.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    userId = new Types.ObjectId().toString();
    otherUserId = new Types.ObjectId().toString();
    await Promise.all([
      applianceModel.deleteMany({}),
      sparePartModel.deleteMany({}),
      module.get(getModelToken(ShopCart.name)).deleteMany({}),
      module.get(getModelToken(Offer.name)).deleteMany({}),
      module.get(getModelToken(PartOrder.name)).deleteMany({}),
      module.get(getModelToken(ServiceablePincode.name)).deleteMany({}),
    ]);

    fridge = await applianceModel.create({
      slug: 'samsung-fridge',
      name: 'Samsung 265L Fridge',
      brand: 'Samsung',
      modelNumber: 'RT28',
      sku: 'FR-1',
      price: 28990,
      originalPrice: 32990,
      nlcPrice: 20000,
      images: ['https://img.example/fridge.jpg'],
      applianceCategory: 'refrigerator',
      inStock: true,
      productWarrantyYears: 1,
      isActive: true,
      isBestseller: true,
      customerRating: { average: 4.5, count: 18 },
    });

    await applianceModel.create({
      slug: 'voltas-ac',
      name: 'Voltas 1.5 Ton',
      brand: 'Voltas',
      modelNumber: '185V',
      sku: 'AC-1',
      price: 32990,
      originalPrice: 39990,
      nlcPrice: 25000,
      capacityTon: 1.5,
      starRating: 5,
      acType: 'split',
      isInverter: true,
      images: ['https://img.example/ac.jpg'],
      applianceCategory: 'ac',
      inStock: true,
      isActive: true,
      installationIncluded: true,
    });

    part = await sparePartModel.create({
      sku: 'SP-1',
      slug: 'compressor-relay',
      name: 'Compressor relay',
      applianceTypeSlug: 'refrigerator',
      price: 125000,
      mrp: 150000,
      stock: 4,
      isInStock: true,
      warrantyMonths: 6,
      isActive: true,
      isFeatured: true,
      soldCount: 12,
      imageUrls: ['https://img.example/part.jpg'],
      rating: { average: 4.2, count: 9 },
      installationDifficulty: { type: 'Hard' },
    });

    await module.get(getModelToken(ServiceablePincode.name)).create({
      pincode: '800001',
      city: 'Patna',
      state: 'Bihar',
      isActive: true,
    });

    await module.get(getModelToken(Offer.name)).create({
      title: 'Shop 10',
      discountText: '10% OFF',
      couponCode: 'SHOP10',
      audience: 'SHOP',
      isActive: true,
    });
  });

  it('GET shop home returns appliances and parts together as cards', async () => {
    const home = await shopService.getHome();
    expect(home.products.length).toBe(3);
    expect(home.appliances).toHaveLength(2);
    expect(home.parts).toHaveLength(1);
    expect(home.pagination).toMatchObject({
      page: 1,
      applianceTotal: 2,
      partTotal: 1,
      hasMore: false,
    });
    expect(home.applianceCategories).toEqual([
      { slug: 'ac', productCount: 1 },
      { slug: 'refrigerator', productCount: 1 },
    ]);
    const fridgeCard = home.products.find((card) => card.slug === 'samsung-fridge');
    expect(fridgeCard).toMatchObject({
      productType: 'appliance',
      applianceCategory: 'refrigerator',
      name: 'Samsung 265L Fridge',
      price: 28990,
      originalPrice: 32990,
      discount: 12,
      rating: 4.5,
      reviewCount: 18,
      isBestseller: true,
      image: 'https://img.example/fridge.jpg',
      brand: 'Samsung',
      isInStock: true,
      warrantyMonths: 12,
    });
    expect(home.parts[0]).toMatchObject({
      productType: 'part',
      name: 'Compressor relay',
      price: 1250,
      originalPrice: 1500,
      discount: 17,
      isBestseller: true,
      isInStock: true,
      stock: 4,
      warrantyMonths: 6,
    });
  });

  it('lists refrigerators through the generic catalog and loads detail by slug', async () => {
    const listed = await appliancesService.findCatalog({
      type: 'refrigerators',
      sort: 'price_asc',
      page: 1,
      limit: 12,
    });
    expect(listed.total).toBe(1);
    expect(listed.products[0].applianceCategory).toBe('refrigerator');
    expect(listed.products[0].slug).toBe('samsung-fridge');

    const detail = await appliancesService.findBySlug('samsung-fridge');
    expect(detail.product.applianceCategory).toBe('refrigerator');
    expect(detail.product.price).toBe(28990);

    await expect(
      appliancesService.findCatalog({ type: 'toaster' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns installation options and charges for a pincode', async () => {
    const options = await installationService.getOptions(
      String(fridge._id),
      '800001',
      'appliance',
    );
    expect(options.serviceable).toBe(true);
    expect(options.options.some((row) => row.id === 'standard' && row.charge === 499)).toBe(
      true,
    );
  });

  it('adds, updates, coupons, and clears a cart', async () => {
    const added = await cartService.addItem(userId, {
      productType: 'part',
      productId: String(part._id),
      quantity: 2,
      installationOptionId: 'professional',
    });
    expect(added.items).toHaveLength(1);
    expect(added.items[0].unitPrice).toBe(1250);
    expect(added.items[0].installationCharge).toBe(499);
    expect(added.itemsSubtotal).toBe(2500);

    const itemId = added.items[0].itemId;
    const updated = await cartService.updateItem(userId, itemId, { quantity: 1 });
    expect(updated.items[0].quantity).toBe(1);

    const withCoupon = await cartService.applyCoupon(userId, 'shop10');
    expect(withCoupon.coupons[0].code).toBe('SHOP10');
    expect(withCoupon.discount).toBe(125);

    const cleared = await cartService.clear(userId);
    expect(cleared.items).toHaveLength(0);
    expect(cleared.coupons).toHaveLength(0);
  });

  it('quotes checkout totals and creates a COD order from the cart', async () => {
    await cartService.addItem(userId, {
      productType: 'appliance',
      productId: String(fridge._id),
      quantity: 1,
      installationOptionId: 'standard',
    });

    const quote = await checkoutService.quote(userId, '800001');
    expect(quote.serviceable).toBe(true);
    expect(quote.items[0].unitPrice).toBe(28990);
    expect(quote.installationCharge).toBe(499);
    expect(quote.total).toBe(28990 + 499);

    await expect(checkoutService.quote(userId, '999999')).resolves.toMatchObject({
      serviceable: false,
    });

    const placed = await checkoutService.checkout(userId, {
      pincode: '800001',
      paymentMethod: 'COD',
      contactData: {
        name: 'Asha',
        phone: '9876543210',
        address: 'Patna',
      },
    });
    expect(placed.orders).toHaveLength(1);
    expect(placed.paymentMethod).toBe('COD');
    expect((placed.orders[0] as any).paymentMethod).toBe('COD');
    expect((placed.orders[0] as any).orderType).toBe('appliance');

    const cart = await cartService.getCart(userId);
    expect(cart.items).toHaveLength(0);

    const orderId = String((placed.orders[0] as any)._id);
    const mine = await partOrdersService.findOneForUser(orderId, userId);
    expect(String((mine as any)._id)).toBe(orderId);
    await expect(
      partOrdersService.findOneForUser(orderId, otherUserId),
    ).rejects.toBeInstanceOf(NotFoundException);

    const tracking = await partOrdersService.findTrackingForUser(orderId, userId);
    expect(tracking.status).toBe('PENDING');
    expect(tracking.courierTracking).toBeNull();
  });
});
