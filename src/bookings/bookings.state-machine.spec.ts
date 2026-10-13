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
import { issueFixxerCode } from './fixxer-code';

process.env.FIXXER_CODE_KEY = Buffer.alloc(32, 7).toString('base64');

describe('BookingsService – State Machine', () => {
  jest.setTimeout(30000);

  let service: BookingsService;
  let bookingModel: Model<BookingDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  const mockWarranties = { findByBooking: jest.fn().mockResolvedValue([]), registerPartsForBooking: jest.fn(), listInstalledParts: jest.fn().mockResolvedValue([]), listOriginalPartsForClaim: jest.fn().mockResolvedValue([]) };
  const mockDispatch = { broadcastJob: jest.fn() };
  const mockNotification = { notify: jest.fn() };
  const mockVisits = {
    findByBooking: jest.fn().mockResolvedValue([]),
    correctCatalogCost: jest.fn(async (usage: any) => Number(usage?.cost) || 0),
  };

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

  async function sealCode(booking: { _id: Types.ObjectId }) {
    const issued = issueFixxerCode();
    await bookingModel.findByIdAndUpdate(booking._id, {
      ...issued.fields,
      technicianId: new Types.ObjectId(),
    });
    return issued.code;
  }

  it('tech can write in IN_PROGRESS', async () => {
    const b = await createBooking();
    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'test' }, 'TECHNICIAN'),
    ).resolves.toBeDefined();
  });

  it('tech rejected after finalize (locked)', async () => {
    const b = await createBooking();
    const code = await sealCode(b);
    await service.finalizeInvoice(b._id.toString(), code);
    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'nope' }, 'TECHNICIAN'),
    ).rejects.toThrow('locked');
  });

  it('admin can still write after finalize', async () => {
    const b = await createBooking();
    const code = await sealCode(b);
    await service.finalizeInvoice(b._id.toString(), code);
    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'admin fix' }, 'ADMIN'),
    ).resolves.toBeDefined();
  });

  it('admin unlock re-enables tech writes', async () => {
    const b = await createBooking();
    const code = await sealCode(b);
    await service.finalizeInvoice(b._id.toString(), code);

    await service.unlockSheet(b._id.toString());

    // Need to set status back to IN_PROGRESS for tech to write
    await bookingModel.findByIdAndUpdate(b._id, { status: 'IN_PROGRESS', isBilled: false, jobClosed: false });

    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'tech again' }, 'TECHNICIAN'),
    ).resolves.toBeDefined();
  });

  it('finalizeInvoice sets sheetLockedAt and isBilled', async () => {
    const b = await createBooking();
    const code = await sealCode(b);
    await service.finalizeInvoice(b._id.toString(), code);
    const doc = await bookingModel.findById(b._id).lean().exec();
    expect(doc!.sheetLockedAt).toBeInstanceOf(Date);
    expect(doc!.sheetLockedBy).toBe('SYSTEM');
    expect(doc!.isBilled).toBe(true);
    expect(doc!.status).toBe('COMPLETED');
  });

  it('assignment stores an encrypted FIXXER CODE and close requires it', async () => {
    const userId = new Types.ObjectId();
    const b = await createBooking({ userId, status: 'CONFIRMED' });
    const techA = new Types.ObjectId().toString();
    const techB = new Types.ObjectId().toString();

    await service.assignTechnician(b._id.toString(), techA);
    const first = await bookingModel.findById(b._id).lean().exec();
    const list = await service.findAllByUser(userId.toString());
    expect(list[0].fixxerCode).toMatch(/^\d{6}$/);
    expect(list[0].fixxerCodeCiphertext).toBeUndefined();
    expect(first!.fixxerCodeCiphertext).toBeTruthy();
    expect(first!.fixxerCodeCiphertext).not.toContain(list[0].fixxerCode);

    const adminView = await service.populateBookingDetail(b._id.toString());
    expect(adminView.fixxerCode).toBeUndefined();
    expect(adminView.fixxerCodeCiphertext).toBeUndefined();

    await service.assignTechnician(b._id.toString(), techA);
    const kept = await bookingModel.findById(b._id).lean().exec();
    expect(kept!.fixxerCodeCiphertext).toBe(first!.fixxerCodeCiphertext);

    await service.assignTechnician(b._id.toString(), techB);
    const rotated = await bookingModel.findById(b._id).lean().exec();
    expect(rotated!.fixxerCodeCiphertext).not.toBe(first!.fixxerCodeCiphertext);
    const after = await service.findAllByUser(userId.toString());
    const wrong = after[0].fixxerCode.replace(/.$/, (digit: string) => (digit === '0' ? '1' : '0'));

    await expect(
      service.finalizeInvoice(b._id.toString(), wrong),
    ).rejects.toThrow('does not match');
    await service.finalizeInvoice(b._id.toString(), after[0].fixxerCode);
    const closed = await service.findAllByUser(userId.toString());
    expect(closed[0].fixxerCode).toBeUndefined();
    expect(closed[0].status).toBe('COMPLETED');
  });

  it('rejects finalize and COMPLETED when the code is missing, wrong, or not issued', async () => {
    const bare = await createBooking();
    await expect(service.finalizeInvoice(bare._id.toString(), '123456')).rejects.toThrow(
      'Assign a technician',
    );
    expect((await bookingModel.findById(bare._id).lean().exec())!.status).toBe('IN_PROGRESS');

    const issued = await createBooking({ technicianId: new Types.ObjectId() });
    await expect(service.finalizeInvoice(issued._id.toString(), '123456')).rejects.toThrow(
      'has not been issued',
    );
    await expect(
      service.updateStatus(issued._id.toString(), 'COMPLETED', undefined, '123456'),
    ).rejects.toThrow('has not been issued');
    expect((await bookingModel.findById(issued._id).lean().exec())!.status).toBe('IN_PROGRESS');

    const code = await sealCode(issued);
    const wrong = code.replace(/.$/, (digit) => (digit === '0' ? '1' : '0'));
    await expect(
      service.updateStatus(issued._id.toString(), 'COMPLETED', undefined, wrong),
    ).rejects.toThrow('does not match');
    await expect(
      service.updateStatus(issued._id.toString(), 'COMPLETED', undefined, ''),
    ).rejects.toThrow('does not match');
    expect((await bookingModel.findById(issued._id).lean().exec())!.status).toBe('IN_PROGRESS');

    await service.updateStatus(issued._id.toString(), 'COMPLETED', undefined, ` ${code.slice(0, 3)} ${code.slice(3)} `);
    const doc = await bookingModel.findById(issued._id).lean().exec();
    expect(doc!.status).toBe('COMPLETED');
    expect(doc!.fixxerCodeVerifiedAt).toBeInstanceOf(Date);
    expect(doc!.fixxerCode).toBeUndefined();

    await service.requireFixxerCode(issued._id.toString());
  });

  it('clears the code when the assignment is removed', async () => {
    const userId = new Types.ObjectId();
    const b = await createBooking({ userId, status: 'CONFIRMED' });
    await service.assignTechnician(b._id.toString(), new Types.ObjectId().toString());
    expect((await service.findAllByUser(userId.toString()))[0].fixxerCode).toMatch(/^\d{6}$/);

    await service.clearAssignmentCode(b._id.toString());
    const doc = await bookingModel.findById(b._id).lean().exec();
    expect(doc!.fixxerCodeCiphertext).toBeUndefined();
    expect(doc!.fixxerCodeIv).toBeUndefined();
    expect(doc!.fixxerCodeAuthTag).toBeUndefined();
    expect(doc!.fixxerCodeVerifiedAt).toBeUndefined();
    expect((await service.findAllByUser(userId.toString()))[0].fixxerCode).toBeUndefined();
    const adminView = await service.populateBookingDetail(b._id.toString());
    expect(adminView.fixxerCodeIv).toBeUndefined();
    expect(adminView.fixxerCodeAuthTag).toBeUndefined();
  });
});
