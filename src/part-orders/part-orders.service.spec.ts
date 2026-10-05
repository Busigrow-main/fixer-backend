import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PartOrdersService } from './part-orders.service';
import { PartOrder, PartOrderDocument, PartOrderSchema } from './schemas/part-order.schema';
import { SparePart, SparePartDocument, SparePartSchema } from '../spare-parts/schemas/spare-part.schema';
import { Appliance, ApplianceDocument, ApplianceSchema } from '../appliances/schemas/appliance.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

describe('PartOrdersService Shop compatibility', () => {
  jest.setTimeout(60000);

  let service: PartOrdersService;
  let partOrderModel: Model<PartOrderDocument>;
  let sparePartModel: Model<SparePartDocument>;
  let applianceModel: Model<ApplianceDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: PartOrder.name, schema: PartOrderSchema },
          { name: SparePart.name, schema: SparePartSchema },
          { name: Appliance.name, schema: ApplianceSchema },
          { name: User.name, schema: UserSchema },
        ]),
      ],
      providers: [PartOrdersService],
    }).compile();
    service = module.get(PartOrdersService);
    partOrderModel = module.get(getModelToken(PartOrder.name));
    sparePartModel = module.get(getModelToken(SparePart.name));
    applianceModel = module.get(getModelToken(Appliance.name));
    await Promise.all([partOrderModel.init(), sparePartModel.init(), applianceModel.init()]);
  });

  afterAll(async () => {
    if (module) await module.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([partOrderModel.deleteMany({}), sparePartModel.deleteMany({}), applianceModel.deleteMany({})]);
  });

  const contactData = { name: 'Customer', phone: '9876543210', address: 'Patna' };

  it('creates a part order with catalog warranty and ignores a client warranty value', async () => {
    const part = await sparePartModel.create({
      sku: 'SP-TEST-1', slug: 'part-test-1', name: 'Test part',
      applianceTypeSlug: 'refrigerator', price: 125000, warrantyMonths: 12,
    });
    const order = await service.create({
      orderType: 'part', contactData,
      items: [{ partId: String(part._id), quantity: 2, warrantyMonthsAtPurchase: 99 } as any],
    }, new Types.ObjectId().toString());

    expect(order.items[0].partId.toString()).toBe(String(part._id));
    expect(order.items[0].quantity).toBe(2);
    expect(order.items[0].warrantyMonthsAtPurchase).toBe(12);
  });

  it('snapshots appliance warranty fields from the catalog, not the submitted item', async () => {
    const appliance = await applianceModel.create({
      slug: 'ac-test-1', name: 'Test AC', brand: 'Fixxer', modelNumber: 'M1', sku: 'AC-1',
      price: 30000, nlcPrice: 25000, capacityTon: 1.5, starRating: 5, acType: 'split',
      isInverter: true, images: ['image'], applianceCategory: 'ac',
      productWarrantyYears: 1, compressorWarrantyYears: 10,
    });
    const order = await service.create({
      orderType: 'appliance', contactData,
      applianceItem: {
        applianceId: String(appliance._id), slug: appliance.slug, name: appliance.name,
        quantity: 1, productWarrantyYearsAtPurchase: 90, compressorWarrantyYearsAtPurchase: 90,
      } as any,
    }, new Types.ObjectId().toString());

    expect(order.applianceItem?.productWarrantyYearsAtPurchase).toBe(1);
    expect(order.applianceItem?.compressorWarrantyYearsAtPurchase).toBe(10);
  });

  it('keeps historical orders without snapshots readable and retains customer listing/cancellation', async () => {
    const userId = new Types.ObjectId();
    const part = await sparePartModel.create({
      sku: 'SP-TEST-2', slug: 'part-test-2', name: 'Test part 2',
      applianceTypeSlug: 'refrigerator', price: 5000,
    });
    const historical = await partOrderModel.create({
      userId, orderType: 'part', contactData,
      items: [{ partId: part._id, quantity: 1 }],
    });
    expect(historical.items[0].warrantyMonthsAtPurchase).toBeUndefined();
    expect(await partOrderModel.countDocuments({ userId }).exec()).toBe(1);
    const listed = await service.findAllByUser(String(userId));
    expect(listed).toHaveLength(1);

    const cancelled = await service.cancelOrder(String(historical._id), String(userId), 'Changed my mind');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledBy).toBe('CUSTOMER');
  });

  it('preserves admin billing, mark-paid, and tracking behavior', async () => {
    const part = await sparePartModel.create({
      sku: 'SP-TEST-3', slug: 'part-test-3', name: 'Test part 3',
      applianceTypeSlug: 'refrigerator', price: 12500,
    });
    const order = await service.create({
      contactData, items: [{ partId: String(part._id), quantity: 1 }],
    }, new Types.ObjectId().toString());
    await service.upsertBill(String((order as any)._id), {
      lineItems: [{ description: 'Test part 3', quantity: 1, unitPrice: 125 }],
    });
    const paid = await service.markPaymentComplete(String((order as any)._id));
    expect(paid.paymentStatus).toBe('PAID');
    expect(paid.isBilled).toBe(true);
    expect(paid.status).toBe('PROCESSING');

    const tracked = await service.attachTracking(String((order as any)._id), {
      courierName: 'Courier', trackingNumber: 'TRACK-1',
    });
    expect(tracked.status).toBe('DISPATCHED');
    expect(tracked.courierTracking?.trackingNumber).toBe('TRACK-1');
  });
});
