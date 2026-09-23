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

describe('BookingsService – Pricing', () => {
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
        { provide: CustomerAppliancesService, useValue: { syncFromBooking: jest.fn(), linkBookingByPhone: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get(BookingsService);
    bookingModel = module.get(getModelToken(Booking.name));
    serviceModel = module.get(getModelToken(Service.name));
  });

  afterAll(async () => {
    if (module) await module.close();
    if (mongod) await mongod.stop();
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

  it('should reject create with invalid subCategoryId', async () => {
    await expect(
      service.create(
        {
          serviceId: testService._id.toString(),
          subCategoryId: new Types.ObjectId().toString(),
          contactPhone: '9999999999',
          addressData: { zip: '110001', text: 'Test' },
        },
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(/subCategoryId/);
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

  it('should freeze estimatedAmount on first invoice generation', async () => {
    const subCat = testService.subCategories[0];
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'PENDING',
    });

    const first = await service.generateInvoiceData(booking._id.toString(), {
      returnDetail: false,
    });
    expect(first.estimatedAmount).toBe(1199);
    expect(first.invoiceData.serviceTotal).toBe(1199);

    // Simulate catalogue price change after booking
    await serviceModel.findByIdAndUpdate(testService._id, {
      $set: { 'subCategories.0.priceNumeric': 199900 },
    });

    const second = await service.generateInvoiceData(booking._id.toString(), {
      returnDetail: false,
    });
    expect(second.invoiceData.serviceTotal).toBe(1999);
    expect(second.estimatedAmount).toBe(1199); // frozen quote
  });

  it('should expose technician, schedule, statusView and pricing on findAllByUser', async () => {
    const techModel = module.get(getModelToken(Technician.name)) as Model<any>;
    const userId = new Types.ObjectId();
    const tech = await techModel.create({
      name: 'Anita Devi',
      phone: '9000011111',
      skills: ['ac'],
    });
    const subCat = testService.subCategories[0];
    const booking = await bookingModel.create({
      userId,
      serviceId: testService._id,
      subCategoryId: subCat._id,
      technicianId: tech._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'ASSIGNED',
      preferredVisitDate: '2026-09-24',
      preferredVisitSlot: 'MORNING',
      invoiceData: { serviceTotal: 1199, partsTotal: 0, totalAmount: 1199 },
      estimatedAmount: 1199,
    });

    mockVisits.findByBooking.mockResolvedValueOnce([
      {
        toObject: () => ({
          _id: new Types.ObjectId(),
          visitOrder: 1,
          scheduledDate: new Date('2026-09-24T10:00:00.000Z'),
          status: 'SCHEDULED',
        }),
      },
    ]);

    const list = await service.findAllByUser(userId.toString());
    expect(list).toHaveLength(1);
    expect(list[0]._id.toString()).toBe(booking._id.toString());
    expect(list[0].technician).toEqual({
      _id: tech._id.toString(),
      name: 'Anita Devi',
      phone: '9000011111',
    });
    expect(list[0].statusView.label).toBe('Master technician assigned');
    expect(list[0].pricing.displayLabel).toBe('Estimated');
    expect(list[0].pricing.estimatedAmount).toBe(1199);
    expect(list[0].schedule.source).toBe('visit');
    expect(list[0].upcomingVisit).toBeTruthy();
  });

  it('findAllByUser: pending booking without technician uses preferred schedule', async () => {
    const userId = new Types.ObjectId();
    const subCat = testService.subCategories[0];
    await bookingModel.create({
      userId,
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9888888888',
      addressData: { zip: '110001', text: 'Pending address' },
      status: 'PENDING',
      preferredVisitDate: '2026-09-30',
      preferredVisitSlot: 'EVENING',
      invoiceData: { serviceTotal: 249, partsTotal: 0, totalAmount: 249 },
      estimatedAmount: 249,
    });

    mockVisits.findByBooking.mockResolvedValueOnce([]);

    const list = await service.findAllByUser(userId.toString());
    expect(list).toHaveLength(1);
    expect(list[0].technician).toBeNull();
    expect(list[0].statusView.label).toBe('Finding a master technician');
    expect(list[0].statusView.tone).toBe('pending');
    expect(list[0].schedule).toMatchObject({
      source: 'preferred',
      preferredVisitDate: '2026-09-30',
      preferredVisitSlot: 'EVENING',
    });
    expect(list[0].upcomingVisit).toBeNull();
  });

  it('findAllByUser: cancelled + extras marks danger status and current total', async () => {
    const userId = new Types.ObjectId();
    const subCat = testService.subCategories[0];
    await bookingModel.create({
      userId,
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9777777777',
      addressData: { zip: '110002', text: 'Cancelled' },
      status: 'CANCELLED',
      invoiceData: {
        serviceTotal: 499,
        partsTotal: 200,
        additionalCharges: [{ label: 'Call-out', amount: 50 }],
        totalAmount: 749,
      },
      estimatedAmount: 499,
    });

    mockVisits.findByBooking.mockResolvedValueOnce([]);

    const [row] = await service.findAllByUser(userId.toString());
    expect(row.statusView).toMatchObject({ label: 'Cancelled', tone: 'danger' });
    expect(row.pricing).toMatchObject({
      displayLabel: 'Current total',
      hasExtras: true,
      totalAmount: 749,
      estimatedAmount: 499,
    });
  });

  it('findAllByUser: warranty claim with arrival shows claim status and final pricing', async () => {
    const userId = new Types.ObjectId();
    const parentId = new Types.ObjectId();
    const subCat = testService.subCategories[0];
    await bookingModel.create({
      userId,
      serviceId: testService._id,
      subCategoryId: subCat._id,
      parentId,
      serviceType: 'WARRANTY_CHECK',
      contactPhone: '9666666666',
      addressData: { zip: '110003', text: 'Warranty' },
      status: 'EN_ROUTE',
      arrivalAt: new Date('2026-09-23T09:00:00.000Z'),
      isBilled: true,
      invoiceData: { serviceTotal: 0, partsTotal: 0, totalAmount: 0 },
      estimatedAmount: 0,
    });

    mockVisits.findByBooking.mockResolvedValueOnce([]);

    const [row] = await service.findAllByUser(userId.toString());
    expect(row.isWarrantyClaim).toBe(true);
    expect(row.statusView.label).toBe('Warranty claim');
    expect(row.pricing.displayLabel).toBe('Final');
    expect(row.pricing.serviceTotal).toBe(0);
  });

  it('findAllByUser: EN_ROUTE without arrivalAt stays on-the-way', async () => {
    const userId = new Types.ObjectId();
    const subCat = testService.subCategories[0];
    await bookingModel.create({
      userId,
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9555555555',
      addressData: { zip: '110004', text: 'En route' },
      status: 'EN_ROUTE',
      invoiceData: { serviceTotal: 1199, totalAmount: 1199 },
      estimatedAmount: 1199,
    });

    mockVisits.findByBooking.mockResolvedValueOnce([]);

    const [row] = await service.findAllByUser(userId.toString());
    expect(row.statusView.label).toBe('Technician is on the way');
  });

  it('findAllByUser: expectedArrivalAt wins over visit schedule', async () => {
    const userId = new Types.ObjectId();
    const subCat = testService.subCategories[0];
    await bookingModel.create({
      userId,
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9444444444',
      addressData: { zip: '110005', text: 'ETA' },
      status: 'ASSIGNED',
      expectedArrivalAt: new Date('2026-09-28T14:00:00.000Z'),
      preferredVisitDate: '2026-09-29',
      invoiceData: { serviceTotal: 1199, totalAmount: 1199 },
      estimatedAmount: 1199,
    });

    mockVisits.findByBooking.mockResolvedValueOnce([
      {
        toObject: () => ({
          _id: new Types.ObjectId(),
          visitOrder: 1,
          scheduledDate: new Date('2026-09-30T10:00:00.000Z'),
          status: 'SCHEDULED',
        }),
      },
    ]);

    const [row] = await service.findAllByUser(userId.toString());
    expect(row.schedule.source).toBe('expected');
    expect(new Date(row.schedule.expectedArrivalAt).toISOString()).toBe(
      '2026-09-28T14:00:00.000Z',
    );
  });

  it('keeps estimatedAmount frozen at zero for warranty invoices', async () => {
    const subCat = testService.subCategories[0];
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9333333333',
      addressData: { zip: '110001', text: 'Test' },
      status: 'PENDING',
      serviceType: 'WARRANTY_CHECK',
    });

    const first = await service.generateInvoiceData(booking._id.toString(), {
      returnDetail: false,
    });
    expect(first.estimatedAmount).toBe(0);
    expect(first.invoiceData.serviceTotal).toBe(0);

    const second = await service.generateInvoiceData(booking._id.toString(), {
      returnDetail: false,
    });
    expect(second.estimatedAmount).toBe(0);
  });

  it('findAllByUser returns empty list for unknown user', async () => {
    const list = await service.findAllByUser(new Types.ObjectId().toString());
    expect(list).toEqual([]);
  });

  it('findAllByUser matches legacy string userId documents', async () => {
    const userId = new Types.ObjectId();
    const subCat = testService.subCategories[0];
    // Bypass mongoose cast to mimic production docs where userId is a plain string
    await bookingModel.collection.insertOne({
      userId: userId.toString(),
      serviceId: testService._id,
      subCategoryId: subCat._id,
      contactPhone: '9111222333',
      addressData: { zip: '110001', text: 'Legacy string userId' },
      status: 'PENDING',
      invoiceData: { serviceTotal: 1199, partsTotal: 0, totalAmount: 1199 },
      estimatedAmount: 1199,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockVisits.findByBooking.mockResolvedValueOnce([]);

    const list = await service.findAllByUser(userId.toString());
    expect(list).toHaveLength(1);
    expect(list[0].addressData.text).toBe('Legacy string userId');
    expect(list[0].statusView.label).toBe('Finding a master technician');
  });

  it('findAllByUser resolves technician name when technicianId is a legacy string', async () => {
    const techModel = module.get(getModelToken(Technician.name)) as Model<any>;
    const userId = new Types.ObjectId();
    const tech = await techModel.create({
      name: 'Amit Sharma',
      phone: '9000099999',
      skills: ['fridge'],
    });
    const subCat = testService.subCategories[0];
    await bookingModel.collection.insertOne({
      userId: userId.toString(),
      serviceId: testService._id,
      subCategoryId: subCat._id,
      technicianId: tech._id.toString(), // legacy string ref
      contactPhone: '9000012345',
      addressData: { zip: '110001', text: 'String tech id' },
      status: 'ASSIGNED',
      invoiceData: { serviceTotal: 1199, partsTotal: 0, totalAmount: 1199 },
      estimatedAmount: 1199,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockVisits.findByBooking.mockResolvedValueOnce([]);

    const [row] = await service.findAllByUser(userId.toString());
    expect(row.technician).toEqual({
      _id: tech._id.toString(),
      name: 'Amit Sharma',
      phone: '9000099999',
    });
    expect(row.hasTechnicianAssigned).toBe(true);
    expect(row.statusView.label).toBe('Master technician assigned');
  });
});
