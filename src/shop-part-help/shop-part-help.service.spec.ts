import { BadRequestException, ConflictException, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PartOrder, PartOrderDocument, PartOrderSchema } from '../part-orders/schemas/part-order.schema';
import { PartOrdersService } from '../part-orders/part-orders.service';
import { Appliance, ApplianceSchema } from '../appliances/schemas/appliance.schema';
import { SparePart, SparePartDocument, SparePartSchema } from '../spare-parts/schemas/spare-part.schema';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ShopPartHelpRequest, ShopPartHelpRequestDocument, ShopPartHelpRequestSchema } from './schemas/shop-part-help.schema';
import { ShopPartHelpService } from './shop-part-help.service';

describe('ShopPartHelpService', () => {
  jest.setTimeout(60000);

  let service: ShopPartHelpService;
  let partOrderModel: Model<PartOrderDocument>;
  let sparePartModel: Model<SparePartDocument>;
  let helpModel: Model<ShopPartHelpRequestDocument>;
  let userModel: Model<any>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;
  let userId: Types.ObjectId;
  let otherUserId: Types.ObjectId;
  let part: SparePartDocument;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: PartOrder.name, schema: PartOrderSchema },
          { name: Appliance.name, schema: ApplianceSchema },
          { name: SparePart.name, schema: SparePartSchema },
          { name: ShopPartHelpRequest.name, schema: ShopPartHelpRequestSchema },
          { name: User.name, schema: UserSchema },
        ]),
      ],
      providers: [
        PartOrdersService,
        ShopPartHelpService,
        {
          provide: SparePartsService,
          useFactory: (model: Model<SparePartDocument>) => ({
            findById: (id: string) => model.findById(id).exec(),
          }),
          inject: [getModelToken(SparePart.name)],
        },
      ],
    }).compile();

    service = module.get(ShopPartHelpService);
    partOrderModel = module.get(getModelToken(PartOrder.name));
    sparePartModel = module.get(getModelToken(SparePart.name));
    helpModel = module.get(getModelToken(ShopPartHelpRequest.name));
    userModel = module.get(getModelToken(User.name));
    await Promise.all([partOrderModel.init(), sparePartModel.init(), helpModel.init()]);
  });

  afterAll(async () => {
    if (module) await module.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([partOrderModel.deleteMany({}), sparePartModel.deleteMany({}), helpModel.deleteMany({}), userModel.deleteMany({})]);
    userId = new Types.ObjectId();
    otherUserId = new Types.ObjectId();
    part = await sparePartModel.create({
      sku: `SP-${new Types.ObjectId().toString().slice(-6)}`,
      slug: `part-${new Types.ObjectId().toString().slice(-6)}`,
      name: 'Compressor relay', applianceTypeSlug: 'refrigerator',
      price: 12300, warrantyMonths: 12, isActive: true,
    });
    await userModel.create([
      { _id: userId, phone: '9876543210', passwordHash: 'hash' },
      { _id: otherUserId, phone: '9876543211', passwordHash: 'hash' },
    ]);
  });

  const requestData = {
    contactData: { name: 'Customer', phone: '9876543210', address: 'Patna' },
    applianceType: 'Refrigerator', applianceBrand: 'Brand X',
    applianceModel: 'Model Y', partDescription: 'Compressor relay is faulty',
    quantity: 2, notes: 'Please call first',
  };

  it('creates a customer request using the authenticated owner and scopes reads to that owner', async () => {
    const request = await service.create(requestData, String(userId));
    expect(String(request.userId)).toBe(String(userId));
    expect(request.status).toBe('PENDING');
    await expect(service.findOneForUser(String(request._id), String(otherUserId)))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(await service.findAllForUser(String(otherUserId))).toHaveLength(0);
  });

  it('quotes, accepts, converts to one PartOrder, and returns the same order on repeat acceptance', async () => {
    const request = await service.create(requestData, String(userId));
    await service.quote(String(request._id), {
      suggestedSparePartId: String(part._id), quotedPrice: 250, isAvailable: true,
      adminResponse: 'Part identified and available',
    });

    const [created, simultaneous] = await Promise.all([
      service.accept(String(request._id), String(userId)),
      service.accept(String(request._id), String(userId)),
    ]);
    const repeated = await service.accept(String(request._id), String(userId));
    expect(String((created as any)._id)).toBe(String((simultaneous as any)._id));
    expect(String((created as any)._id)).toBe(String((repeated as any)._id));
    expect(String((created as any).sourceHelpRequestId)).toBe(String(request._id));
    const rawOrder = await partOrderModel.collection.findOne({ _id: (created as any)._id });
    expect(String(rawOrder?.sourceHelpRequestId)).toBe(String(request._id));
    expect((rawOrder?.sourceHelpRequestId as any)?.toHexString()).toBe(String(request._id));
    expect(await module.get(PartOrdersService).findBySourceHelpRequestId(String(request._id))).not.toBeNull();
    expect(await partOrderModel.countDocuments({ sourceHelpRequestId: request._id }).exec()).toBe(1);
    expect(created.orderType).toBe('part');
    expect(created.items?.[0].quantity).toBe(2);
    expect(created.items?.[0].warrantyMonthsAtPurchase).toBe(12);
    expect(created.invoiceData?.lineItems?.[0].unitPrice).toBe(250);

    const converted = await service.findOneForUser(String(request._id), String(userId));
    expect(converted.status).toBe('CONVERTED');
    expect(String((converted.convertedPartOrderId as any)._id ?? converted.convertedPartOrderId))
      .toBe(String((created as any)._id));
  });

  it('rejects a customer accepting another user request and rejects unavailable quotes', async () => {
    const request = await service.create(requestData, String(userId));
    await expect(service.accept(String(request._id), String(otherUserId)))
      .rejects.toBeInstanceOf(NotFoundException);
    await service.quote(String(request._id), {
      isAvailable: false, adminResponse: 'Currently unavailable',
    });
    await expect(service.accept(String(request._id), String(userId)))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('supports decline/cancel transitions and rejects invalid transitions', async () => {
    const pending = await service.create(requestData, String(userId));
    await expect(service.decline(String(pending._id), String(userId)))
      .rejects.toBeInstanceOf(ConflictException);
    const cancelled = await service.cancel(String(pending._id), String(userId));
    expect(cancelled.status).toBe('CANCELLED');
    await expect(service.quote(String(pending._id), {
      isAvailable: false, adminResponse: 'Not available',
    })).rejects.toBeInstanceOf(ConflictException);

    const quoted = await service.create(requestData, String(userId));
    await service.quote(String(quoted._id), {
      suggestedSparePartId: String(part._id), quotedPrice: 10, isAvailable: true,
      adminResponse: 'Available',
    });
    expect((await service.decline(String(quoted._id), String(userId))).status).toBe('DECLINED');
    await expect(service.accept(String(quoted._id), String(userId)))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('allows only ADMIN role through the admin role guard', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) };
    const guard = new RolesGuard(reflector as any);
    const context = (role: string) => ({
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    }) as unknown as ExecutionContext;

    expect(guard.canActivate(context('ADMIN'))).toBe(true);
    expect(() => guard.canActivate(context('CUSTOMER'))).toThrow(ForbiddenException);
  });
});
