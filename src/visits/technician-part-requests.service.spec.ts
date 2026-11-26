import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingSchema } from '../bookings/schemas/booking.schema';
import { SparePart, SparePartDocument, SparePartSchema } from '../spare-parts/schemas/spare-part.schema';
import { TechnicianPartRequestsService } from './technician-part-requests.service';
import { Visit, VisitDocument, VisitSchema } from './schemas/visit.schema';
import { SparePartUsage, SparePartUsageDocument, SparePartUsageSchema } from './schemas/spare-part-usage.schema';
import { PartInventoryTransaction, PartInventoryTransactionDocument, PartInventoryTransactionSchema } from './schemas/part-inventory-transaction.schema';
import { TechnicianPartRequest, TechnicianPartRequestDocument, TechnicianPartRequestSchema } from './schemas/technician-part-request.schema';
import { VisitsService } from './visits.service';

describe('TechnicianPartRequestsService', () => {
  jest.setTimeout(120_000);
  let replicaSet: MongoMemoryReplSet;
  let moduleRef: TestingModule;
  let service: TechnicianPartRequestsService;
  let bookingModel: Model<BookingDocument>;
  let visitModel: Model<VisitDocument>;
  let sparePartModel: Model<SparePartDocument>;
  let requestModel: Model<TechnicianPartRequestDocument>;
  let transactionModel: Model<PartInventoryTransactionDocument>;
  let usageModel: Model<SparePartUsageDocument>;

  const visitsServiceMock = {
    addSparePartToVisit: jest.fn(async (visitId: string, payload: Record<string, unknown>, _actor: unknown, options?: { session?: any }) => {
      const [usage] = await usageModel.create([{
        ...payload,
        visitId: new Types.ObjectId(visitId),
      }], options?.session ? { session: options.session } : undefined);
      return usage;
    }),
  };

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(replicaSet.getUri()),
        MongooseModule.forFeature([
          { name: Booking.name, schema: BookingSchema },
          { name: Visit.name, schema: VisitSchema },
          { name: SparePart.name, schema: SparePartSchema },
          { name: SparePartUsage.name, schema: SparePartUsageSchema },
          { name: TechnicianPartRequest.name, schema: TechnicianPartRequestSchema },
          { name: PartInventoryTransaction.name, schema: PartInventoryTransactionSchema },
        ]),
      ],
      providers: [
        TechnicianPartRequestsService,
        { provide: VisitsService, useValue: visitsServiceMock },
      ],
    }).compile();
    service = moduleRef.get(TechnicianPartRequestsService);
    bookingModel = moduleRef.get(getModelToken(Booking.name));
    visitModel = moduleRef.get(getModelToken(Visit.name));
    sparePartModel = moduleRef.get(getModelToken(SparePart.name));
    requestModel = moduleRef.get(getModelToken(TechnicianPartRequest.name));
    transactionModel = moduleRef.get(getModelToken(PartInventoryTransaction.name));
    usageModel = moduleRef.get(getModelToken(SparePartUsage.name));
  });

  beforeEach(async () => {
    await Promise.all([
      bookingModel.deleteMany({}), visitModel.deleteMany({}), sparePartModel.deleteMany({}),
      requestModel.deleteMany({}), transactionModel.deleteMany({}), usageModel.deleteMany({}),
    ]);
    visitsServiceMock.addSparePartToVisit.mockClear();
  });

  afterAll(async () => {
    await moduleRef?.close();
    await replicaSet?.stop();
  });

  async function seedJob(technicianId = new Types.ObjectId()) {
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: new Types.ObjectId(),
      subCategoryId: new Types.ObjectId(),
      technicianId,
      assignmentStatus: 'ACCEPTED',
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test location' },
      status: 'IN_PROGRESS',
      isBilled: false,
      jobClosed: false,
    });
    const visit = await visitModel.create({
      bookingId: booking._id,
      technicianId,
      visitOrder: 1,
      status: 'IN_PROGRESS',
    });
    const sparePart = await sparePartModel.create({
      sku: `SP-REQ-${new Types.ObjectId()}`,
      slug: `request-${new Types.ObjectId()}`,
      name: 'Compressor relay',
      applianceTypeSlug: 'refrigerator',
      price: 2500,
      stock: 10,
      isInStock: true,
      isActive: true,
      warrantyMonths: 6,
    });
    return { booking, visit, sparePart, technicianId };
  }

  it('reserves only after approval, reconciles issue/use/returns separately, and quarantines defects', async () => {
    const { booking, visit, sparePart, technicianId } = await seedJob();
    const adminId = new Types.ObjectId();
    const body = { visitId: String(visit._id), sparePartId: String(sparePart._id), quantity: 5, idempotencyKey: 'request-5' };
    const created = await service.create(String(technicianId), String(booking._id), body);
    const duplicate = await service.create(String(technicianId), String(booking._id), body);
    expect(String(duplicate._id)).toBe(String(created._id));
    await expect(sparePartModel.findById(sparePart._id).lean()).resolves.toMatchObject({ stock: 10, reservedStock: 0 });

    await service.approve(String(created._id), String(adminId));
    await expect(sparePartModel.findById(sparePart._id).lean()).resolves.toMatchObject({ stock: 5, reservedStock: 5 });
    await expect(transactionModel.find({ partRequestId: created._id }).lean()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'RESERVE', quantity: 5 }),
    ]));

    const issueBody = { quantity: 3, idempotencyKey: 'issue-3' };
    await service.issue(String(technicianId), String(booking._id), String(created._id), issueBody);
    const consumedBody = { quantity: 1, serialNumber: 'SERIAL-1', idempotencyKey: 'consume-1' };
    const consumed = await service.consume(String(technicianId), String(booking._id), String(created._id), consumedBody);
    const replay = await service.consume(String(technicianId), String(booking._id), String(created._id), consumedBody);
    expect(replay.replayed).toBe(true);
    expect(consumed.request?.consumedQuantity).toBe(1);
    expect(await usageModel.countDocuments({ partRequestId: created._id, quantity: 1 })).toBe(1);

    await service.returnPart(String(technicianId), String(booking._id), String(created._id), {
      quantity: 1, condition: 'UNUSED', idempotencyKey: 'return-unused-1',
    });
    await service.returnPart(String(technicianId), String(booking._id), String(created._id), {
      quantity: 1, condition: 'DEFECTIVE', reason: 'Cracked casing', idempotencyKey: 'return-defective-1',
    });
    await expect(sparePartModel.findById(sparePart._id).lean()).resolves.toMatchObject({
      stock: 6,
      reservedStock: 2,
      quarantinedStock: 1,
    });
    await service.cancel(String(created._id), String(adminId), 'Job no longer needs the remaining parts');
    await expect(sparePartModel.findById(sparePart._id).lean()).resolves.toMatchObject({
      stock: 8,
      reservedStock: 0,
      quarantinedStock: 1,
    });
    await expect(requestModel.findById(created._id).lean()).resolves.toMatchObject({
      status: 'CANCELLED',
      issuedQuantity: 3,
      consumedQuantity: 1,
      unusedReturnedQuantity: 1,
      defectiveReturnedQuantity: 1,
    });
    expect(await transactionModel.countDocuments({ partRequestId: created._id, type: 'ISSUE' })).toBe(1);
    expect(await transactionModel.countDocuments({ partRequestId: created._id, type: 'CONSUME' })).toBe(1);
    expect(await transactionModel.countDocuments({ partRequestId: created._id, type: 'RETURN', returnCondition: 'UNUSED' })).toBe(1);
    expect(await transactionModel.countDocuments({ partRequestId: created._id, type: 'RETURN', returnCondition: 'DEFECTIVE' })).toBe(1);
  });

  it('uses conditional stock reservation so concurrent approvals cannot oversell', async () => {
    const firstJob = await seedJob();
    const secondJob = await seedJob();
    await sparePartModel.updateOne({ _id: firstJob.sparePart._id }, { $set: { stock: 5 } });
    const first = await service.create(String(firstJob.technicianId), String(firstJob.booking._id), {
      visitId: String(firstJob.visit._id), sparePartId: String(firstJob.sparePart._id), quantity: 4, idempotencyKey: 'race-req-1',
    });
    const second = await service.create(String(secondJob.technicianId), String(secondJob.booking._id), {
      visitId: String(secondJob.visit._id), sparePartId: String(firstJob.sparePart._id), quantity: 4, idempotencyKey: 'race-req-2',
    });
    const results = await Promise.allSettled([
      service.approve(String(first._id), String(new Types.ObjectId())),
      service.approve(String(second._id), String(new Types.ObjectId())),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await sparePartModel.findById(firstJob.sparePart._id).lean()).toMatchObject({ stock: 1, reservedStock: 4 });
    expect(await requestModel.countDocuments({ status: 'APPROVED' })).toBe(1);
  });
});
