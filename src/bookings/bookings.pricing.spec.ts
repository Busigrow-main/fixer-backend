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

describe('BookingsService – Pricing', () => {
  jest.setTimeout(30000);
  let service: BookingsService;
  let bookingModel: Model<BookingDocument>;
  let serviceModel: Model<ServiceDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  const mockWarranties = { findByBooking: jest.fn().mockResolvedValue([]), registerPartsForBooking: jest.fn(), listInstalledParts: jest.fn().mockResolvedValue([]) };
  const mockDispatch = { broadcastJob: jest.fn() };
  const mockNotification = { notify: jest.fn() };
  const mockVisits = { findByBooking: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
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

  beforeEach(async () => {
    await bookingModel.deleteMany({});
    await serviceModel.deleteMany({});

    testService = await serviceModel.create({
      slug: 'ac-repair',
      name: 'AC Repair',
      title: 'AC Repair Service',
      startingPrice: 'Starting at ₹499',
      startingPriceNumeric: 49900,
      icon: 'icon.png',
      image: 'image.png',
      description: 'AC repair service',
      features: [],
      subCategories: [
        { _id: new Types.ObjectId(), name: 'Split AC Gas Refill', price: '₹1,199', priceNumeric: 119900 },
        { _id: new Types.ObjectId(), name: 'Window AC Repair', price: '₹249', priceNumeric: null },
      ],
    });
  });

  it('should use priceNumeric (paise) when available', async () => {
    const subCat = testService.subCategories[0];
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'PENDING',
    });

    const result = await service.generateInvoiceData(booking._id.toString(), { returnDetail: false });
    expect(result.invoiceData.serviceTotal).toBe(1199); // 119900 paise = ₹1199
  });

  it('should fall back to parseNumericPrice when priceNumeric is null', async () => {
    const subCat = testService.subCategories[1]; // priceNumeric is null
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'PENDING',
    });

    const result = await service.generateInvoiceData(booking._id.toString(), { returnDetail: false });
    expect(result.invoiceData.serviceTotal).toBe(249);
  });

  it('should fall back to startingPriceNumeric when subCat not found', async () => {
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: testService._id,
      subCategoryId: new Types.ObjectId(), // non-existent
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'PENDING',
    });

    const result = await service.generateInvoiceData(booking._id.toString(), { returnDetail: false });
    expect(result.invoiceData.serviceTotal).toBe(499); // 49900 paise = ₹499
  });

  it('should respect manualOverride and not recompute serviceTotal', async () => {
    const subCat = testService.subCategories[0];
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'PENDING',
      invoiceData: { serviceTotal: 500, manualOverride: true },
    });

    const result = await service.generateInvoiceData(booking._id.toString(), { returnDetail: false });
    expect(result.invoiceData.serviceTotal).toBe(500);
  });

  it('should warn but not reject create with invalid subCategoryId', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await service.create(
      {
        serviceId: testService._id.toString(),
        subCategoryId: new Types.ObjectId().toString(),
        contactPhone: '9999999999',
        addressData: { zip: '110001', text: 'Test' },
      },
      new Types.ObjectId().toString(),
    );
    expect(result).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found in service'));
    warnSpy.mockRestore();
  });

  it('should set serviceTotal=0 for WARRANTY_CHECK bookings', async () => {
    const subCat = testService.subCategories[0];
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'PENDING',
      serviceType: 'WARRANTY_CHECK',
    });

    const result = await service.generateInvoiceData(booking._id.toString(), { returnDetail: false });
    expect(result.invoiceData.serviceTotal).toBe(0);
  });
});
