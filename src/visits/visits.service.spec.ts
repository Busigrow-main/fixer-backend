import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VisitsService } from './visits.service';
import { Visit, VisitSchema } from './schemas/visit.schema';
import { SparePartUsage, SparePartUsageSchema } from './schemas/spare-part-usage.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { SparePart, SparePartSchema } from '../spare-parts/schemas/spare-part.schema';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { WarrantiesService } from '../warranties/warranties.service';

describe('VisitsService inventory quantity', () => {
  jest.setTimeout(30000);

  let service: VisitsService;
  let sparePartModel: Model<any>;
  let visitModel: Model<any>;
  let usageModel: Model<any>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  const warranties = {
    resolveInventoryWarrantyMonths: jest.fn().mockReturnValue(0),
    assertSerialAvailable: jest.fn(async (s: string) => s.trim().toUpperCase()),
    applyReplacementCoverage: jest.fn(),
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Visit.name, schema: VisitSchema },
          { name: SparePartUsage.name, schema: SparePartUsageSchema },
          { name: Booking.name, schema: BookingSchema },
          { name: SparePart.name, schema: SparePartSchema },
        ]),
      ],
      providers: [
        VisitsService,
        { provide: SparePartsService, useValue: {} },
        { provide: WarrantiesService, useValue: warranties },
      ],
    }).compile();

    service = module.get(VisitsService);
    sparePartModel = module.get(getModelToken(SparePart.name));
    visitModel = module.get(getModelToken(Visit.name));
    usageModel = module.get(getModelToken(SparePartUsage.name));
  });

  afterAll(async () => {
    await module?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await usageModel.deleteMany({});
    await visitModel.deleteMany({});
    await sparePartModel.deleteMany({});
    warranties.resolveInventoryWarrantyMonths.mockReturnValue(0);
  });

  async function seedPart(stock = 60) {
    return sparePartModel.create({
      sku: `SP-QTY-${new Types.ObjectId().toString()}`,
      slug: `qty-${Date.now()}`,
      name: 'Godrej Turntable Motors - Series 335',
      applianceTypeSlug: 'microwave',
      price: 75750,
      stock,
      isInStock: true,
      isActive: true,
    });
  }

  async function seedVisit(status: string) {
    return visitModel.create({
      bookingId: new Types.ObjectId(),
      technicianId: new Types.ObjectId(),
      visitOrder: 1,
      status,
      jobDescription: 'Parts logging',
    });
  }

  it('uses the entered quantity, not the full stock of 60', async () => {
    const spare = await seedPart(60);
    const visit = await seedVisit('COMPLETED');

    const usage = await service.addSparePartToVisit(String(visit._id), {
      isThirdParty: false,
      sparePartId: String(spare._id),
      quantity: 1,
      cost: 0,
      serialNumber: 'UNIT-SERIAL-001',
    });

    expect(usage.quantity).toBe(1);
    expect(usage.cost).toBe(757.5);
    expect(usage.stockDeducted).toBe(true);

    const after = await sparePartModel.findById(spare._id).lean();
    expect(after!.stock).toBe(59);

    await service.updateStatus(String(visit._id), { status: 'COMPLETED' });
    const still = await sparePartModel.findById(spare._id).lean();
    expect(still!.stock).toBe(59);
  });

  it('defaults a missing quantity to 1', async () => {
    const spare = await seedPart(60);
    const visit = await seedVisit('SCHEDULED');

    const usage = await service.addSparePartToVisit(String(visit._id), {
      isThirdParty: false,
      sparePartId: String(spare._id),
    });

    expect(usage.quantity).toBe(1);
    const untouched = await sparePartModel.findById(spare._id).lean();
    expect(untouched!.stock).toBe(60);

    await service.updateStatus(String(visit._id), { status: 'COMPLETED' });
    const deducted = await sparePartModel.findById(spare._id).lean();
    expect(deducted!.stock).toBe(59);

    await service.updateStatus(String(visit._id), { status: 'COMPLETED' });
    const once = await sparePartModel.findById(spare._id).lean();
    expect(once!.stock).toBe(59);
  });

  it('rejects a quantity above stock and restores stock when the line is removed', async () => {
    const spare = await seedPart(60);
    const visit = await seedVisit('COMPLETED');

    await expect(
      service.addSparePartToVisit(String(visit._id), {
        isThirdParty: false,
        sparePartId: String(spare._id),
        quantity: 60,
      }),
    ).resolves.toMatchObject({ quantity: 60, stockDeducted: true });

    const empty = await sparePartModel.findById(spare._id).lean();
    expect(empty!.stock).toBe(0);

    const spare2 = await seedPart(60);
    const visit2 = await seedVisit('COMPLETED');
    await expect(
      service.addSparePartToVisit(String(visit2._id), {
        isThirdParty: false,
        sparePartId: String(spare2._id),
        quantity: 61,
      }),
    ).rejects.toThrow(/cannot exceed available stock \(60\)/);

    const usage = await service.addSparePartToVisit(String(visit2._id), {
      isThirdParty: false,
      sparePartId: String(spare2._id),
      quantity: 1,
    });
    await service.removeSparePartFromVisit(String(visit2._id), String(usage._id));
    const restored = await sparePartModel.findById(spare2._id).lean();
    expect(restored!.stock).toBe(60);
  });
});
