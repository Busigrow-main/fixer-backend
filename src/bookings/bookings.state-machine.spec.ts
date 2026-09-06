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

describe('BookingsService – State Machine', () => {
  jest.setTimeout(30000);

  let service: BookingsService;
  let bookingModel: Model<BookingDocument>;
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
      ],
    }).compile();

    service = module.get(BookingsService);
    bookingModel = module.get(getModelToken(Booking.name));
  });

  afterAll(async () => {
    await module.close();
    await mongod.stop();
  });

  let serviceDoc: any;
  beforeEach(async () => {
    await bookingModel.deleteMany({});
    const serviceModel = module.get<Model<ServiceDocument>>(getModelToken(Service.name));
    await serviceModel.deleteMany({});
    serviceDoc = await serviceModel.create({
      slug: 'test',
      name: 'Test',
      title: 'Test',
      startingPrice: '₹100',
      icon: 'i',
      image: 'i',
      description: 'd',
      subCategories: [{ _id: new Types.ObjectId(), name: 'Sub', price: '₹100', priceNumeric: 10000 }],
    });
  });

  async function createBooking(overrides: any = {}) {
    return bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: serviceDoc._id,
      subCategoryId: serviceDoc.subCategories[0]._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'IN_PROGRESS',
      ...overrides,
    });
  }

  it('tech can write in IN_PROGRESS', async () => {
    const b = await createBooking();
    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'test' }, 'TECHNICIAN'),
    ).resolves.toBeDefined();
  });

  it('tech rejected after finalize (locked)', async () => {
    const b = await createBooking();
    await service.finalizeInvoice(b._id.toString());
    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'nope' }, 'TECHNICIAN'),
    ).rejects.toThrow('locked');
  });

  it('admin can still write after finalize', async () => {
    const b = await createBooking();
    await service.finalizeInvoice(b._id.toString());
    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'admin fix' }, 'ADMIN'),
    ).resolves.toBeDefined();
  });

  it('admin unlock re-enables tech writes', async () => {
    const b = await createBooking();
    await service.finalizeInvoice(b._id.toString());

    await service.unlockSheet(b._id.toString());

    // Need to set status back to IN_PROGRESS for tech to write
    await bookingModel.findByIdAndUpdate(b._id, { status: 'IN_PROGRESS', isBilled: false, jobClosed: false });

    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'tech again' }, 'TECHNICIAN'),
    ).resolves.toBeDefined();
  });

  it('finalizeInvoice sets sheetLockedAt and isBilled', async () => {
    const b = await createBooking();
    await service.finalizeInvoice(b._id.toString());
    const doc = await bookingModel.findById(b._id).lean().exec();
    expect(doc!.sheetLockedAt).toBeInstanceOf(Date);
    expect(doc!.sheetLockedBy).toBe('SYSTEM');
    expect(doc!.isBilled).toBe(true);
    expect(doc!.status).toBe('COMPLETED');
  });
});
