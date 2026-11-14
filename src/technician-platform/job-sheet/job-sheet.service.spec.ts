import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JobSheetService } from './job-sheet.service';
import { BookingsService } from '../../bookings/bookings.service';
import { Booking, BookingSchema, BookingDocument } from '../../bookings/schemas/booking.schema';
import { Service, ServiceSchema } from '../../services/schemas/service.schema';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { Technician, TechnicianSchema } from '../../technicians/schemas/technician.schema';
import { SparePart, SparePartSchema } from '../../spare-parts/schemas/spare-part.schema';
import { SparePartUsage, SparePartUsageSchema } from '../../visits/schemas/spare-part-usage.schema';
import { Visit, VisitSchema } from '../../visits/schemas/visit.schema';
import { VisitsService } from '../../visits/visits.service';
import { SparePartsService } from '../../spare-parts/spare-parts.service';
import { WarrantiesService } from '../../warranties/warranties.service';
import { CustomerAppliancesService } from '../../customer-appliances/customer-appliances.service';
import { JobDispatchService } from '../dispatch/job-dispatch.service';
import { NotificationDispatchService } from '../common/notification-dispatch.service';
import { ServiceablePincodesService } from '../../serviceable-pincodes/serviceable-pincodes.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GstService } from '../../gst/gst.service';

describe('JobSheetService', () => {
  jest.setTimeout(30000);

  let service: JobSheetService;
  let bookingModel: Model<BookingDocument>;
  let sparePartModel: Model<any>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  const techId = new Types.ObjectId();
  const mockVisits = {
    findByBooking: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn(),
    createVisit: jest.fn(),
    updateStatus: jest.fn(),
    addSparePartToVisit: jest.fn(),
    findExistingInventoryIssue: jest.fn().mockResolvedValue(null),
    issueInventoryPartToVisit: jest.fn(),
    returnInventoryPart: jest.fn(),
    removeSparePartFromVisit: jest.fn(),
  };
  const mockSpareParts = { searchParts: jest.fn().mockResolvedValue({ data: [] }) };
  const mockWarranties = {
    findByBooking: jest.fn().mockResolvedValue([]),
    registerPartsForBooking: jest.fn(),
    assertSerialAvailable: jest.fn().mockImplementation((s) => s.toUpperCase()),
    resolveInventoryWarrantyMonths: jest.fn().mockReturnValue(12),
    normalizeSerial: (s: string) => s?.trim().toUpperCase() || '',
    listInstalledParts: jest.fn().mockResolvedValue([]),
    listOriginalPartsForClaim: jest.fn().mockResolvedValue([]),
    applyReplacementCoverage: jest.fn().mockResolvedValue({ covered: false }),
  };
  // Make static normalizeSerial available
  (WarrantiesService as any).normalizeSerial = (s: string) => s?.trim().toUpperCase() || '';

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
          { name: SparePart.name, schema: SparePartSchema },
          { name: SparePartUsage.name, schema: SparePartUsageSchema },
          { name: Visit.name, schema: VisitSchema },
        ]),
      ],
      providers: [
        JobSheetService,
        BookingsService,
        GstService,
        { provide: VisitsService, useValue: mockVisits },
        { provide: SparePartsService, useValue: mockSpareParts },
        { provide: WarrantiesService, useValue: mockWarranties },
        { provide: JobDispatchService, useValue: mockDispatch },
        { provide: NotificationDispatchService, useValue: mockNotification },
        { provide: CustomerAppliancesService, useValue: { syncFromBooking: jest.fn(), linkBookingByPhone: jest.fn().mockResolvedValue([]) } },
        {
          provide: ServiceablePincodesService,
          useValue: {
            isServiceable: jest.fn().mockResolvedValue(true),
            assertServiceable: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(JobSheetService);
    bookingModel = module.get(getModelToken(Booking.name));
    sparePartModel = module.get(getModelToken(SparePart.name));
  });

  afterAll(async () => {
    await module.close();
    await mongod.stop();
  });

  let serviceDoc: any;
  let bookingId: string;

  beforeEach(async () => {
    mockVisits.findExistingInventoryIssue.mockReset().mockResolvedValue(null);
    mockVisits.issueInventoryPartToVisit.mockReset();
    mockVisits.returnInventoryPart.mockReset();
    mockWarranties.resolveInventoryWarrantyMonths.mockReturnValue(12);
    await bookingModel.deleteMany({});
    const serviceModel = module.get<Model<any>>(getModelToken(Service.name));
    await serviceModel.deleteMany({});
    await sparePartModel.deleteMany({});

    serviceDoc = await serviceModel.create({
      slug: 'svc',
      name: 'Svc',
      title: 'Svc',
      startingPrice: '₹100',
      icon: 'i',
      image: 'i',
      description: 'd',
      subCategories: [{ _id: new Types.ObjectId(), name: 'Sub', price: '₹100', priceNumeric: 10000 }],
    });

    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: serviceDoc._id,
      subCategoryId: serviceDoc.subCategories[0]._id,
      technicianId: techId,
      assignmentStatus: 'ACCEPTED',
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Addr' },
      status: 'IN_PROGRESS',
    });
    bookingId = booking._id.toString();

    mockVisits.findByBooking.mockResolvedValue([]);
  });

  describe('saveJobSheet merge', () => {
    it('merges jobDetails without wiping existing fields', async () => {
      await bookingModel.findByIdAndUpdate(bookingId, {
        $set: { 'jobDetails.diagnosis': 'Existing diagnosis' },
      });

      await service.saveJobSheet(bookingId, techId.toString(), {
        jobDetails: { workDone: 'Replaced filter' },
      });

      const doc = await bookingModel.findById(bookingId).lean().exec();
      expect(doc!.jobDetails!.diagnosis).toBe('Existing diagnosis');
      expect(doc!.jobDetails!.workDone).toBe('Replaced filter');
    });

    it('bumps revision on each save without demoting job status', async () => {
      await service.saveJobSheet(bookingId, techId.toString(), {
        jobDetails: { diagnosis: 'A' },
      });
      const mid = await bookingModel.findById(bookingId).lean().exec();
      expect(mid!.status).toBe('IN_PROGRESS');
      await service.saveJobSheet(bookingId, techId.toString(), {
        jobDetails: { diagnosis: 'B' },
      });
      const doc = await bookingModel.findById(bookingId).lean().exec();
      expect(doc!.jobSheetRevision).toBe(2);
      expect(doc!.status).toBe('IN_PROGRESS');
    });

    it('does not write completionData.labourCharge', async () => {
      await service.saveJobSheet(bookingId, techId.toString(), {
        invoice: { serviceTotal: 999 },
        jobDetails: { diagnosis: 'test' },
      });
      const doc = await bookingModel.findById(bookingId).lean().exec();
      expect(doc!.completionData?.labourCharge).toBeFalsy();
    });
  });

  describe('addPart serial validation', () => {
    it('returns an existing issue before job, visit, and stock checks on retry', async () => {
      const existingUsage = {
        _id: new Types.ObjectId(),
        quantity: 10,
        stockDeducted: true,
      };
      const visitId = new Types.ObjectId().toString();
      const sparePartId = new Types.ObjectId().toString();
      await bookingModel.findByIdAndUpdate(bookingId, { sheetLockedAt: new Date() });
      mockVisits.findOne.mockReset();
      mockVisits.findExistingInventoryIssue.mockResolvedValue(existingUsage);

      const result = await service.addPart(bookingId, techId.toString(), visitId, {
        sparePartId,
        quantity: 10,
        idempotencyKey: 'retry-after-stock-exhausted',
        isThirdParty: false,
      });

      expect(result).toBe(existingUsage);
      expect(mockVisits.findExistingInventoryIssue).toHaveBeenCalledWith({
        bookingId,
        technicianId: techId.toString(),
        visitId,
        sparePartId,
        quantity: 10,
        idempotencyKey: 'retry-after-stock-exhausted',
      });
      expect(mockVisits.findOne).not.toHaveBeenCalled();
      expect(mockVisits.issueInventoryPartToVisit).not.toHaveBeenCalled();
    });

    it('routes valid inventory part additions through the issue transaction flow', async () => {
      const spare = await sparePartModel.create({
        name: 'Filter',
        sku: 'FLT-ISSUE-001',
        slug: 'filter-issue-001',
        applianceTypeSlug: 'ac',
        price: 12500,
        stock: 10,
        warrantyMonths: 0,
        isActive: true,
      });
      const visitId = new Types.ObjectId().toString();
      mockVisits.findOne.mockResolvedValue({ _id: visitId, bookingId });
      mockVisits.issueInventoryPartToVisit.mockResolvedValue({
        _id: new Types.ObjectId(),
        quantity: 2,
        stockDeducted: true,
      });
      mockWarranties.resolveInventoryWarrantyMonths.mockReturnValue(0);

      await service.addPart(bookingId, techId.toString(), visitId, {
        sparePartId: String(spare._id),
        quantity: 2,
        idempotencyKey: 'mobile-request-123',
        isThirdParty: false,
      });

      expect(mockVisits.issueInventoryPartToVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId,
          technicianId: techId.toString(),
          visitId,
          sparePartId: String(spare._id),
          quantity: 2,
          idempotencyKey: 'mobile-request-123',
        }),
      );
      expect(mockVisits.addSparePartToVisit).not.toHaveBeenCalled();
      mockWarranties.resolveInventoryWarrantyMonths.mockReturnValue(12);
    });

    it.each([undefined, 0, -1, 1.5])(
      'rejects invalid inventory quantity %s',
      async (quantity) => {
        const visitId = new Types.ObjectId().toString();
        mockVisits.findOne.mockResolvedValue({ _id: visitId, bookingId });

        await expect(
          service.addPart(bookingId, techId.toString(), visitId, {
            sparePartId: new Types.ObjectId().toString(),
            quantity,
            isThirdParty: false,
          }),
        ).rejects.toThrow('quantity must be a positive integer');
        expect(mockVisits.issueInventoryPartToVisit).not.toHaveBeenCalled();
      },
    );

    it('rejects inventory part without serial when warranty > 0', async () => {
      const spare = await sparePartModel.create({
        name: 'Compressor',
        sku: 'CMP-001',
        slug: 'compressor-001',
        applianceTypeSlug: 'ac',
        partCategory: 'compressor',
        price: '50000',
        stock: 10,
        warrantyMonths: 12,
      });

      const visitId = new Types.ObjectId().toString();
      mockVisits.findOne.mockResolvedValue({ _id: visitId, bookingId });

      await expect(
        service.addPart(bookingId, techId.toString(), visitId, {
          sparePartId: spare._id.toString(),
          quantity: 1,
          isThirdParty: false,
        }),
      ).rejects.toThrow('Serial number is required');
    });
  });

  describe('inventory returns', () => {
    it('delegates return ownership and replay to the transaction service and refreshes the invoice', async () => {
      const visitId = new Types.ObjectId().toString();
      const usageId = new Types.ObjectId().toString();
      const result = {
        transaction: { _id: new Types.ObjectId(), type: 'RETURN' },
        usage: { _id: usageId, quantity: 3 },
        replayed: true,
      };
      mockVisits.returnInventoryPart.mockResolvedValue(result);
      const generateInvoice = jest
        .spyOn(module.get(BookingsService), 'generateInvoiceData')
        .mockResolvedValue({} as any);

      const response = await service.returnPart(
        bookingId,
        techId.toString(),
        visitId,
        usageId,
        { quantity: 2, idempotencyKey: 'return-retry-key' },
      );

      expect(response).toEqual({ transaction: result.transaction, usage: result.usage });
      expect(mockVisits.returnInventoryPart).toHaveBeenCalledWith({
        bookingId,
        technicianId: techId.toString(),
        visitId,
        usageId,
        quantity: 2,
        idempotencyKey: 'return-retry-key',
      });
      expect(generateInvoice).toHaveBeenCalledWith(bookingId);
      generateInvoice.mockRestore();
    });
  });

  describe('sheet lock', () => {
    it('rejects tech write when sheetLockedAt is set', async () => {
      await bookingModel.findByIdAndUpdate(bookingId, {
        sheetLockedAt: new Date(),
        sheetLockedBy: 'SYSTEM',
      });

      await expect(
        service.saveJobSheet(bookingId, techId.toString(), {
          jobDetails: { diagnosis: 'nope' },
        }),
      ).rejects.toThrow(/locked/i);
    });
  });

  describe('parseVisitTime (via createOrUpdateVisit)', () => {
    it('accepts HH:mm string for timeIn', async () => {
      const fakeVisit = { _id: new Types.ObjectId(), bookingId };
      mockVisits.create.mockResolvedValue(fakeVisit);

      await service.createOrUpdateVisit(bookingId, techId.toString(), {
        jobDescription: 'Visit 1',
        scheduledDate: '2026-08-18',
        timeIn: '10:30',
        timeOut: '11:45',
      });

      expect(mockVisits.create).toHaveBeenCalled();
      const args = mockVisits.create.mock.calls[mockVisits.create.mock.calls.length - 1][0];
      expect(args.timeIn).toBeInstanceOf(Date);
      expect(args.timeIn.getHours()).toBe(10);
      expect(args.timeIn.getMinutes()).toBe(30);
    });

    it('rejects invalid time string', async () => {
      await expect(
        service.createOrUpdateVisit(bookingId, techId.toString(), {
          jobDescription: 'Visit',
          timeIn: '25:99',
        }),
      ).rejects.toThrow('Invalid time');
    });
  });
});
