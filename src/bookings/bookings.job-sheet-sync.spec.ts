import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema, BookingDocument } from './schemas/booking.schema';
import { Service, ServiceSchema, ServiceDocument } from '../services/schemas/service.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Technician, TechnicianSchema } from '../technicians/schemas/technician.schema';
import { WarrantiesService } from '../warranties/warranties.service';
import { JobDispatchService } from '../technician-platform/dispatch/job-dispatch.service';
import { NotificationDispatchService } from '../technician-platform/common/notification-dispatch.service';
import { VisitsService } from '../visits/visits.service';
import { CustomerAppliancesService } from '../customer-appliances/customer-appliances.service';
import { ServiceablePincodesService } from '../serviceable-pincodes/serviceable-pincodes.service';

describe('BookingsService – Job Sheet Sync (Dot-Path Merge)', () => {
  jest.setTimeout(30000);

  let service: BookingsService;
  let bookingModel: Model<BookingDocument>;
  let serviceModel: Model<ServiceDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  const mockWarranties = { findByBooking: jest.fn().mockResolvedValue([]), registerPartsForBooking: jest.fn(), listInstalledParts: jest.fn().mockResolvedValue([]), listOriginalPartsForClaim: jest.fn().mockResolvedValue([]) };
  const mockDispatch = { broadcastJob: jest.fn() };
  const mockNotification = { notify: jest.fn() };
  const mockVisits = { findByBooking: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Booking.name, schema: BookingSchema },
          { name: Service.name, schema: ServiceSchema },
          { name: User.name, schema: UserSchema },
          { name: Technician.name, schema: TechnicianSchema },
        ]),
      ],
      providers: [
        BookingsService,
        { provide: WarrantiesService, useValue: mockWarranties },
        { provide: JobDispatchService, useValue: mockDispatch },
        { provide: NotificationDispatchService, useValue: mockNotification },
        { provide: VisitsService, useValue: mockVisits },
        { provide: CustomerAppliancesService, useValue: { syncFromBooking: jest.fn(), linkBookingByPhone: jest.fn().mockResolvedValue([]) } },
        { provide: ServiceablePincodesService, useValue: { isServiceable: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    service = module.get(BookingsService);
    bookingModel = module.get(getModelToken(Booking.name));
    serviceModel = module.get(getModelToken(Service.name));
  });

  afterAll(async () => {
    await module.close();
    await mongod.stop();
  });

  let testService: any;
  let bookingId: string;

  beforeEach(async () => {
    await bookingModel.deleteMany({});
    await serviceModel.deleteMany({});
    testService = await serviceModel.create({
      slug: 'test-svc',
      name: 'Test',
      title: 'Test',
      startingPrice: '₹100',
      icon: 'i',
      image: 'i',
      description: 'd',
      subCategories: [{ _id: new Types.ObjectId(), name: 'Sub', price: '₹100', priceNumeric: 10000 }],
    });
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: testService._id,
      subCategoryId: testService.subCategories[0]._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Addr' },
      status: 'IN_PROGRESS',
      jobDetails: { diagnosis: 'Initial diagnosis', workDone: '' },
    });
    bookingId = booking._id.toString();
  });

  it('tech write merges without overwriting existing fields', async () => {
    await service.updateJobDetails(bookingId, { workDone: 'Replaced compressor' }, 'TECHNICIAN');
    const doc = await bookingModel.findById(bookingId).lean().exec();
    expect(doc!.jobDetails!.diagnosis).toBe('Initial diagnosis');
    expect(doc!.jobDetails!.workDone).toBe('Replaced compressor');
  });

  it('admin write merges without overwriting tech fields', async () => {
    await service.updateJobDetails(bookingId, { workDone: 'Tech work' }, 'TECHNICIAN');
    await service.updateJobDetails(bookingId, { recommendations: 'Replace unit' }, 'ADMIN');
    const doc = await bookingModel.findById(bookingId).lean().exec();
    expect(doc!.jobDetails!.workDone).toBe('Tech work');
    expect(doc!.jobDetails!.recommendations).toBe('Replace unit');
  });

  it('bumps jobSheetRevision on each write', async () => {
    await service.updateJobDetails(bookingId, { workDone: 'A' }, 'TECHNICIAN');
    await service.updateJobDetails(bookingId, { workDone: 'B' }, 'ADMIN');
    const doc = await bookingModel.findById(bookingId).lean().exec();
    expect(doc!.jobSheetRevision).toBe(2);
  });

  it('sets jobSheetUpdatedBy correctly', async () => {
    await service.updateJobDetails(bookingId, { workDone: 'X' }, 'TECHNICIAN');
    let doc = await bookingModel.findById(bookingId).lean().exec();
    expect(doc!.jobSheetUpdatedBy).toBe('TECHNICIAN');

    await service.updateJobDetails(bookingId, { diagnosis: 'Y' }, 'ADMIN');
    doc = await bookingModel.findById(bookingId).lean().exec();
    expect(doc!.jobSheetUpdatedBy).toBe('ADMIN');
  });

  it('rejects tech write when sheet is locked', async () => {
    await bookingModel.findByIdAndUpdate(bookingId, { sheetLockedAt: new Date(), sheetLockedBy: 'ADMIN' });
    await expect(
      service.updateJobDetails(bookingId, { workDone: 'Nope' }, 'TECHNICIAN'),
    ).rejects.toThrow('locked');
  });

  it('allows admin write when sheet is locked', async () => {
    await bookingModel.findByIdAndUpdate(bookingId, { sheetLockedAt: new Date(), sheetLockedBy: 'ADMIN' });
    await expect(
      service.updateJobDetails(bookingId, { workDone: 'Admin override' }, 'ADMIN'),
    ).resolves.toBeDefined();
    const doc = await bookingModel.findById(bookingId).lean().exec();
    expect(doc!.jobDetails!.workDone).toBe('Admin override');
  });

  it('productDetails dot-path merge preserves other fields', async () => {
    await bookingModel.findByIdAndUpdate(bookingId, {
      $set: { 'productDetails.brand': 'Samsung', 'productDetails.modelNumber': 'X100' },
    });
    await service.updateProductDetails(bookingId, { serialNumber: 'SN123' }, 'TECHNICIAN');
    const doc = await bookingModel.findById(bookingId).lean().exec();
    expect(doc!.productDetails!.brand).toBe('Samsung');
    expect(doc!.productDetails!.serialNumber).toBe('SN123');
  });
});
