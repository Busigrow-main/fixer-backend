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

describe('BookingsService – Invoice Generation', () => {
  jest.setTimeout(30000);

  let service: BookingsService;
  let bookingModel: Model<BookingDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  const mockWarranties = { findByBooking: jest.fn().mockResolvedValue([]), registerPartsForBooking: jest.fn(), listInstalledParts: jest.fn().mockResolvedValue([]), listOriginalPartsForClaim: jest.fn().mockResolvedValue([]) };
  const mockDispatch = { broadcastJob: jest.fn() };
  const mockNotification = { notify: jest.fn() };

  let mockVisits: { findByBooking: jest.Mock };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    mockVisits = { findByBooking: jest.fn().mockResolvedValue([]) };

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
      slug: 'ac-repair',
      name: 'AC Repair',
      title: 'AC Repair',
      startingPrice: '₹499',
      startingPriceNumeric: 49900,
      icon: 'i',
      image: 'i',
      description: 'd',
      subCategories: [{ _id: new Types.ObjectId(), name: 'Gas Refill', price: '₹1199', priceNumeric: 119900 }],
    });
    mockVisits.findByBooking.mockResolvedValue([]);
  });

  it('computes correct totals with parts from visits', async () => {
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: serviceDoc._id,
      subCategoryId: serviceDoc.subCategories[0]._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'IN_PROGRESS',
    });

    mockVisits.findByBooking.mockResolvedValue([
      {
        partsUsed: [
          { isThirdParty: true, partName: 'Capacitor', cost: 150, quantity: 2 },
          { isThirdParty: false, sparePartId: { name: 'Filter' }, cost: 200, quantity: 1 },
        ],
      },
    ]);

    const result = await service.generateInvoiceData(booking._id.toString(), { returnDetail: false });
    expect(result.invoiceData.serviceTotal).toBe(1199);
    expect(result.invoiceData.partsTotal).toBe(500); // 150*2 + 200*1
    expect(result.invoiceData.totalAmount).toBe(1699);
    expect(result.invoiceData.spareParts).toHaveLength(2);
  });

  it('preserves manualOverride serviceTotal', async () => {
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: serviceDoc._id,
      subCategoryId: serviceDoc.subCategories[0]._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'IN_PROGRESS',
      invoiceData: { serviceTotal: 750, manualOverride: true },
    });

    const result = await service.generateInvoiceData(booking._id.toString(), { returnDetail: false });
    expect(result.invoiceData.serviceTotal).toBe(750);
  });

  it('includes additional charges in totalAmount', async () => {
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: serviceDoc._id,
      subCategoryId: serviceDoc.subCategories[0]._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'IN_PROGRESS',
      invoiceData: { additionalCharges: [{ label: 'Travel', amount: 100 }] },
    });

    const result = await service.generateInvoiceData(booking._id.toString(), { returnDetail: false });
    expect(result.invoiceData.serviceTotal).toBe(1199);
    expect(result.invoiceData.totalAmount).toBe(1299); // 1199 + 100
  });

  it('always recomputes (no sticky guard)', async () => {
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: serviceDoc._id,
      subCategoryId: serviceDoc.subCategories[0]._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'IN_PROGRESS',
      invoiceData: { serviceTotal: 249 }, // wrong legacy value, no manualOverride
    });

    const result = await service.generateInvoiceData(booking._id.toString(), { returnDetail: false });
    // Should recompute from catalog since manualOverride is not set
    expect(result.invoiceData.serviceTotal).toBe(1199);
  });
});
