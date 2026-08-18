import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JobCompletionService } from './job-completion.service';
import { BookingsService } from '../../bookings/bookings.service';
import { Booking, BookingSchema, BookingDocument } from '../../bookings/schemas/booking.schema';
import { Service, ServiceSchema } from '../../services/schemas/service.schema';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { Technician, TechnicianSchema } from '../../technicians/schemas/technician.schema';
import { SparePartUsage, SparePartUsageSchema } from '../../visits/schemas/spare-part-usage.schema';
import { EarningsService } from '../earnings/earnings.service';
import { VisitsService } from '../../visits/visits.service';
import { WarrantiesService } from '../../warranties/warranties.service';
import { JobDispatchService } from '../dispatch/job-dispatch.service';
import { NotificationDispatchService } from '../common/notification-dispatch.service';

describe('JobCompletionService – No Dual-Source Writes', () => {
  jest.setTimeout(30000);

  let completionService: JobCompletionService;
  let bookingsService: BookingsService;
  let bookingModel: Model<BookingDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  const techId = new Types.ObjectId().toString();
  const mockEarnings = { recordEarning: jest.fn() };
  const mockVisits = { findByBooking: jest.fn().mockResolvedValue([]) };
  const mockWarranties = { findByBooking: jest.fn().mockResolvedValue([]), registerPartsForBooking: jest.fn() };
  const mockDispatch = { broadcastJob: jest.fn() };
  const mockNotification = { notify: jest.fn() };

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
          { name: SparePartUsage.name, schema: SparePartUsageSchema },
        ]),
      ],
      providers: [
        JobCompletionService,
        BookingsService,
        { provide: EarningsService, useValue: mockEarnings },
        { provide: VisitsService, useValue: mockVisits },
        { provide: WarrantiesService, useValue: mockWarranties },
        { provide: JobDispatchService, useValue: mockDispatch },
        { provide: NotificationDispatchService, useValue: mockNotification },
      ],
    }).compile();

    completionService = module.get(JobCompletionService);
    bookingsService = module.get(BookingsService);
    bookingModel = module.get(getModelToken(Booking.name));
  });

  afterAll(async () => {
    await module.close();
    await mongod.stop();
  });

  let serviceDoc: any;
  beforeEach(async () => {
    await bookingModel.deleteMany({});
    const serviceModel = module.get<Model<any>>(getModelToken(Service.name));
    await serviceModel.deleteMany({});
    serviceDoc = await serviceModel.create({
      slug: 'test',
      name: 'Test',
      title: 'Test',
      startingPrice: '₹500',
      startingPriceNumeric: 50000,
      icon: 'i',
      image: 'i',
      description: 'd',
      subCategories: [{ _id: new Types.ObjectId(), name: 'Sub', price: '₹500', priceNumeric: 50000 }],
    });
  });

  it('submitCompletion does NOT write completionData.labourCharge or partsCharge', async () => {
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: serviceDoc._id,
      subCategoryId: serviceDoc.subCategories[0]._id,
      technicianId: new Types.ObjectId(techId),
      assignmentStatus: 'ACCEPTED',
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'IN_PROGRESS',
    });

    await completionService.submitCompletion(booking._id.toString(), techId, {
      labourCharge: 999,
      partsCharge: 111,
      remarks: 'Done',
      images: ['img.jpg'],
    });

    const doc = await bookingModel.findById(booking._id).lean().exec();
    // labourCharge should NOT be set (or remain 0 from default)
    expect(doc!.completionData?.labourCharge).toBeFalsy();
    expect(doc!.completionData?.partsCharge).toBeFalsy();
    // remarks and images should be set
    expect(doc!.completionData?.remarks).toBe('Done');
    expect(doc!.completionData?.images).toEqual(['img.jpg']);
  });

  it('submitCompletion calls generateInvoiceData for totals', async () => {
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: serviceDoc._id,
      subCategoryId: serviceDoc.subCategories[0]._id,
      technicianId: new Types.ObjectId(techId),
      assignmentStatus: 'ACCEPTED',
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'IN_PROGRESS',
    });

    const result = await completionService.submitCompletion(booking._id.toString(), techId, {
      remarks: 'All good',
      images: [],
    });

    // Invoice should be computed from catalog (₹500)
    expect(result.invoiceData.serviceTotal).toBe(500);
    expect(result.invoiceData.totalAmount).toBe(500);
  });
});
