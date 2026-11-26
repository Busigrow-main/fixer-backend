import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import {
  CustomerAppliance,
  CustomerApplianceSchema,
} from '../customer-appliances/schemas/customer-appliance.schema';
import { Feedback, FeedbackSchema } from '../feedback/schemas/feedback.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import {
  SparePart,
  SparePartSchema,
} from '../spare-parts/schemas/spare-part.schema';
import {
  Technician,
  TechnicianSchema,
} from '../technicians/schemas/technician.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  SparePartUsage,
  SparePartUsageSchema,
} from '../visits/schemas/spare-part-usage.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import {
  PartInventoryTransaction,
  PartInventoryTransactionSchema,
} from '../visits/schemas/part-inventory-transaction.schema';
import {
  Warranty,
  WarrantySchema,
} from '../warranties/schemas/warranty.schema';
import {
  FeedbackFollowUp,
  FeedbackFollowUpSchema,
} from '../feedback/schemas/feedback-follow-up.schema';
import { CustomerServiceHistoryService } from './customer-service-history.service';

describe('CustomerServiceHistoryService', () => {
  jest.setTimeout(30000);
  let service: CustomerServiceHistoryService;
  let mongod: MongoMemoryServer;
  let module: TestingModule;
  let models: Record<string, Model<any>>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: Booking.name, schema: BookingSchema },
          { name: CustomerAppliance.name, schema: CustomerApplianceSchema },
          { name: Visit.name, schema: VisitSchema },
          {
            name: PartInventoryTransaction.name,
            schema: PartInventoryTransactionSchema,
          },
          { name: SparePartUsage.name, schema: SparePartUsageSchema },
          { name: Feedback.name, schema: FeedbackSchema },
          { name: Warranty.name, schema: WarrantySchema },
          { name: FeedbackFollowUp.name, schema: FeedbackFollowUpSchema },
          { name: Technician.name, schema: TechnicianSchema },
          { name: Service.name, schema: ServiceSchema },
          { name: SparePart.name, schema: SparePartSchema },
        ]),
      ],
      providers: [CustomerServiceHistoryService],
    }).compile();
    service = module.get(CustomerServiceHistoryService);
    models = {
      user: module.get(getModelToken(User.name)),
      booking: module.get(getModelToken(Booking.name)),
      appliance: module.get(getModelToken(CustomerAppliance.name)),
      visit: module.get(getModelToken(Visit.name)),
      transaction: module.get(getModelToken(PartInventoryTransaction.name)),
      usage: module.get(getModelToken(SparePartUsage.name)),
      feedback: module.get(getModelToken(Feedback.name)),
      warranty: module.get(getModelToken(Warranty.name)),
      followUp: module.get(getModelToken(FeedbackFollowUp.name)),
      technician: module.get(getModelToken(Technician.name)),
      service: module.get(getModelToken(Service.name)),
      part: module.get(getModelToken(SparePart.name)),
    };
  });

  afterEach(async () => {
    await Promise.all(
      Object.values(models || {}).map((model) => model.deleteMany({})),
    );
  });

  afterAll(async () => {
    await module.close();
    await mongod.stop();
  });

  it('returns customer-owned bookings, mapped appliances, visits, parts, feedback, and warranties', async () => {
    const customer = await models.user.create({
      fullName: 'Customer One',
      phone: '9000000001',
      role: 'CUSTOMER',
      passwordHash: 'hidden',
    });
    const other = await models.user.create({
      fullName: 'Customer Two',
      phone: '9000000002',
      role: 'CUSTOMER',
      passwordHash: 'hidden',
    });
    const serviceDoc = await models.service.create({
      slug: 'repair',
      name: 'Repair',
      title: 'Repair',
      startingPrice: '100',
      description: 'Repair service',
      image: 'repair.png',
      icon: 'wrench',
      subCategories: [],
    });
    const technician = await models.technician.create({
      name: 'Tech One',
      phone: '9000000010',
    });
    const booking = await models.booking.create({
      userId: customer._id,
      serviceId: serviceDoc._id,
      subCategoryId: new Types.ObjectId(),
      contactPhone: customer.phone,
      addressData: { text: 'Service address', zip: '100001' },
      status: 'COMPLETED',
      productDetails: {
        brand: 'Acme',
        modelNumber: 'A1',
        serialNumber: 'AC-100',
      },
      jobClosed: true,
      jobClosedAt: new Date('2026-01-05T10:00:00Z'),
    });
    const foreignBooking = await models.booking.create({
      userId: other._id,
      serviceId: serviceDoc._id,
      subCategoryId: new Types.ObjectId(),
      contactPhone: other.phone,
      addressData: { text: 'Other address', zip: '100002' },
      status: 'COMPLETED',
      productDetails: { serialNumber: 'AC-OTHER' },
    });
    await models.appliance.create({
      serialNumber: 'AC-100',
      brand: 'Acme',
      modelNumber: 'A1',
      phones: [other.phone],
      bookingIds: [booking._id, foreignBooking._id],
      primaryBookingId: booking._id,
      mappedAt: new Date('2025-12-01T00:00:00Z'),
    });
    const part = await models.part.create({
      name: 'Compressor',
      sku: 'COMP-1',
      slug: 'compressor',
      applianceTypeSlug: 'air-conditioner',
      price: 5000,
      partNumber: 'C1',
    });
    const firstVisit = await models.visit.create({
      bookingId: booking._id,
      technicianId: technician._id,
      visitOrder: 1,
      status: 'COMPLETED',
      scheduledDate: new Date('2026-01-02T00:00:00Z'),
      timeIn: new Date('2026-01-02T09:00:00Z'),
      timeOut: new Date('2026-01-02T10:00:00Z'),
    });
    const secondVisit = await models.visit.create({
      bookingId: booking._id,
      technicianId: technician._id,
      visitOrder: 2,
      status: 'COMPLETED',
    });
    const usage = await models.usage.create({
      visitId: firstVisit._id,
      isThirdParty: false,
      sparePartId: part._id,
      quantity: 1,
      serialNumber: 'PART-100',
      installedAt: new Date('2026-01-02T09:30:00Z'),
    });
    firstVisit.partsUsed = [usage._id];
    await firstVisit.save();
    await models.transaction.create({
      technicianId: technician._id,
      bookingId: booking._id,
      visitId: firstVisit._id,
      sparePartId: part._id,
      sparePartUsageId: usage._id,
      quantity: 1,
      type: 'ISSUE',
      idempotencyKey: 'history-issue-1',
    });
    await models.feedback.create({
      bookingId: booking._id,
      userId: customer._id,
      rating: 5,
      resolved: true,
      comment: 'Fixed',
    });
    await models.warranty.create({
      bookingId: booking._id,
      visitId: firstVisit._id,
      sparePartUsageId: usage._id,
      type: 'PART',
      warrantyType: 'IN_HOUSE',
      description: 'Part warranty',
      serialNumber: 'PART-100',
      startDate: new Date('2026-01-02'),
      endDate: new Date('2027-01-02'),
      status: 'ACTIVE',
    });

    const result = await service.getCustomerServiceHistory(
      String(customer._id),
    );
    expect(result.customer).toMatchObject({ fullName: 'Customer One' });
    expect((result.customer as any).passwordHash).toBeUndefined();
    expect(result.bookings).toHaveLength(1);
    expect(
      result.bookings[0].visits.map((visit: any) => visit.visitOrder),
    ).toEqual([1, 2]);
    expect(result.bookings[0].partsHistory.data[0]).toMatchObject({
      partName: 'Compressor',
      quantity: 1,
      serialNumber: 'PART-100',
      visitOrder: 1,
    });
    expect(result.bookings[0].partsHistory.inventoryTransactions[0].type).toBe(
      'ISSUE',
    );
    expect(result.bookings[0].feedback).toMatchObject({
      rating: 5,
      comment: 'Fixed',
    });
    expect(result.bookings[0].warranties).toHaveLength(1);
    expect(result.bookings[0].jobCompletion.jobClosed).toBe(true);
    expect(result.appliances).toHaveLength(1);
    expect(result.appliances[0].serviceBookingIds).toEqual([
      String(booking._id),
    ]);
    expect(String(result.bookings[0]._id)).not.toBe(String(foreignBooking._id));
  });

  it('returns empty history sections and stable pagination metadata when optional records are absent', async () => {
    const customer = await models.user.create({
      role: 'CUSTOMER',
      passwordHash: 'hidden',
    });
    const result = await service.getCustomerServiceHistory(
      String(customer._id),
    );
    expect(result).toMatchObject({
      appliances: [],
      bookings: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('returns an appliance-scoped timeline using exact serial and explicit booking links', async () => {
    const customer = await models.user.create({
      fullName: 'Appliance Owner',
      phone: '9000000011',
      role: 'CUSTOMER',
      passwordHash: 'hidden',
    });
    const serviceDoc = await models.service.create({
      slug: 'repair',
      name: 'Repair',
      title: 'Repair',
      startingPrice: '100',
      description: 'Repair service',
      image: 'repair.png',
      icon: 'wrench',
    });
    const serialBooking = await models.booking.create({
      userId: customer._id,
      serviceId: serviceDoc._id,
      subCategoryId: new Types.ObjectId(),
      contactPhone: customer.phone,
      addressData: { text: 'Service address', zip: '100001' },
      status: 'COMPLETED',
      serviceType: 'REPAIR',
      productDetails: { serialNumber: 'AC-TIMELINE-1' },
    });
    const explicitlyLinkedBooking = await models.booking.create({
      userId: customer._id,
      serviceId: serviceDoc._id,
      subCategoryId: new Types.ObjectId(),
      contactPhone: customer.phone,
      addressData: { text: 'Service address', zip: '100001' },
      status: 'PENDING',
      productDetails: {},
    });
    const phoneOnlyBooking = await models.booking.create({
      userId: customer._id,
      serviceId: serviceDoc._id,
      subCategoryId: new Types.ObjectId(),
      contactPhone: customer.phone,
      addressData: { text: 'Service address', zip: '100001' },
      status: 'PENDING',
      productDetails: { serialNumber: 'OTHER-APPLIANCE' },
    });
    await models.appliance.create({
      serialNumber: 'AC-TIMELINE-1',
      phones: [customer.phone],
      bookingIds: [explicitlyLinkedBooking._id],
      primaryBookingId: explicitlyLinkedBooking._id,
    });

    const result = await service.getApplianceServiceTimeline(
      'ac-timeline-1',
      1,
      10,
    );

    expect(result.appliance).toMatchObject({
      serialNumber: 'AC-TIMELINE-1',
      primaryBookingId: String(explicitlyLinkedBooking._id),
      phones: [customer.phone],
    });
    expect(result.customers.map((row: any) => String(row._id))).toContain(
      String(customer._id),
    );
    expect(result.primaryBooking?._id.toString()).toBe(
      String(explicitlyLinkedBooking._id),
    );
    expect(result.pagination).toMatchObject({ page: 1, limit: 10, total: 2 });
    expect(result.bookings.map((row: any) => String(row._id))).toEqual(
      expect.arrayContaining([
        String(serialBooking._id),
        String(explicitlyLinkedBooking._id),
      ]),
    );
    expect(result.bookings.map((row: any) => String(row._id))).not.toContain(
      String(phoneOnlyBooking._id),
    );
  });

  it('uses a deterministic booking ID tie-breaker when timestamps match across pages', async () => {
    const customer = await models.user.create({
      role: 'CUSTOMER',
      passwordHash: 'hidden',
    });
    const serviceDoc = await models.service.create({
      slug: 'repair',
      name: 'Repair',
      title: 'Repair',
      startingPrice: '100',
      description: 'Repair service',
      image: 'repair.png',
      icon: 'wrench',
    });
    const createdAt = new Date('2026-02-01T00:00:00.000Z');
    const common = {
      userId: customer._id,
      serviceId: serviceDoc._id,
      subCategoryId: new Types.ObjectId(),
      contactPhone: '9000000001',
      addressData: { text: 'Service address', zip: '100001' },
      status: 'PENDING',
      createdAt,
    };
    const firstId = new Types.ObjectId('650000000000000000000001');
    const secondId = new Types.ObjectId('650000000000000000000002');
    await models.booking.create([
      { ...common, _id: firstId },
      { ...common, _id: secondId },
    ]);

    const pageOne = await service.getCustomerServiceHistory(
      String(customer._id),
      1,
      1,
    );
    const pageTwo = await service.getCustomerServiceHistory(
      String(customer._id),
      2,
      1,
    );
    expect(pageOne.bookings[0]._id.toString()).toBe(String(secondId));
    expect(pageTwo.bookings[0]._id.toString()).toBe(String(firstId));
    expect(pageOne.pagination.total).toBe(2);
  });

  it('rejects invalid or nonexistent customers and invalid pagination', async () => {
    await expect(
      service.getCustomerServiceHistory('invalid'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getCustomerServiceHistory(String(new Types.ObjectId())),
    ).rejects.toBeInstanceOf(NotFoundException);
    const customer = await models.user.create({
      role: 'CUSTOMER',
      passwordHash: 'hidden',
    });
    await expect(
      service.getCustomerServiceHistory(String(customer._id), 0),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('includes invoice events in the unified timeline', async () => {
    const customer = await models.user.create({
      fullName: 'Invoice Customer',
      phone: '9000000021',
      role: 'CUSTOMER',
      passwordHash: 'hidden',
    });
    const serviceDoc = await models.service.create({
      slug: 'repair',
      name: 'Repair',
      title: 'Repair',
      startingPrice: '100',
      description: 'Repair service',
      image: 'repair.png',
      icon: 'wrench',
      subCategories: [],
    });
    const booking = await models.booking.create({
      userId: customer._id,
      serviceId: serviceDoc._id,
      subCategoryId: new Types.ObjectId(),
      contactPhone: customer.phone,
      addressData: { text: 'Service address', zip: '100001' },
      status: 'COMPLETED',
      productDetails: { serialNumber: 'INV-100' },
      jobClosed: true,
      jobClosedAt: new Date('2026-01-05T10:00:00Z'),
      invoiceData: {
        url: 'https://example.com/inv-1.pdf',
        serviceTotal: 5000,
        partsTotal: 2000,
        totalAmount: 7000,
        taxAmount: 1260,
        technicianNet: 3000,
        fixxerNet: 4000,
        generatedAt: new Date('2026-01-05T11:00:00Z'),
      },
    });

    const result = await service.getCustomerServiceHistory(
      String(customer._id),
    );

    const invoiceEvents = result.unifiedTimeline.filter(
      (e: any) => e.type === 'invoice',
    );
    expect(invoiceEvents).toHaveLength(1);
    expect(new Date(invoiceEvents[0].timestamp).toISOString()).toBe(new Date('2026-01-05T11:00:00Z').toISOString());
    expect(invoiceEvents[0].data.invoiceNumber).toBeNull();
    expect(invoiceEvents[0].data.totalAmount).toBe(7000);
    expect(invoiceEvents[0].data.technicianNet).toBe(3000);
    expect(invoiceEvents[0].data.fixxerNet).toBe(4000);
  });

  it('includes follow-up events in the unified timeline', async () => {
    const customer = await models.user.create({
      fullName: 'Follow-up Customer',
      phone: '9000000022',
      role: 'CUSTOMER',
      passwordHash: 'hidden',
    });
    const serviceDoc = await models.service.create({
      slug: 'repair',
      name: 'Repair',
      title: 'Repair',
      startingPrice: '100',
      description: 'Repair service',
      image: 'repair.png',
      icon: 'wrench',
      subCategories: [],
    });
    const booking = await models.booking.create({
      userId: customer._id,
      serviceId: serviceDoc._id,
      subCategoryId: new Types.ObjectId(),
      contactPhone: customer.phone,
      addressData: { text: 'Service address', zip: '100001' },
      status: 'COMPLETED',
      productDetails: { serialNumber: 'FU-100' },
    });
    const feedbackDoc = await models.feedback.create({
      bookingId: booking._id,
      userId: customer._id,
      rating: 2,
      resolved: false,
      comment: 'Not happy',
    });
    await models.followUp.create({
      feedbackId: feedbackDoc._id,
      bookingId: booking._id,
      ownerId: new Types.ObjectId(),
      dueDate: new Date('2026-01-10T00:00:00Z'),
      status: 'OPEN',
      resolution: null,
    });

    const result = await service.getCustomerServiceHistory(
      String(customer._id),
    );

    const followUpEvents = result.unifiedTimeline.filter(
      (e: any) => e.type === 'follow_up',
    );
    expect(followUpEvents).toHaveLength(1);
    expect(followUpEvents[0].data.status).toBe('OPEN');
    expect(followUpEvents[0].data.ownerId).toBeDefined();
    expect(new Date(followUpEvents[0].data.dueDate).toISOString()).toBe(new Date('2026-01-10T00:00:00Z').toISOString());
  });

  it('unified timeline is sorted newest first', async () => {
    const customer = await models.user.create({
      fullName: 'Sort Customer',
      phone: '9000000041',
      role: 'CUSTOMER',
      passwordHash: 'hidden',
    });
    const serviceDoc = await models.service.create({
      slug: 'repair',
      name: 'Repair',
      title: 'Repair',
      startingPrice: '100',
      description: 'Repair service',
      image: 'repair.png',
      icon: 'wrench',
      subCategories: [],
    });
    const booking1 = await models.booking.create({
      userId: customer._id,
      serviceId: serviceDoc._id,
      subCategoryId: new Types.ObjectId(),
      contactPhone: customer.phone,
      addressData: { text: 'Address', zip: '100001' },
      status: 'COMPLETED',
      productDetails: { serialNumber: 'SORT-1' },
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const booking2 = await models.booking.create({
      userId: customer._id,
      serviceId: serviceDoc._id,
      subCategoryId: new Types.ObjectId(),
      contactPhone: customer.phone,
      addressData: { text: 'Address', zip: '100001' },
      status: 'COMPLETED',
      productDetails: { serialNumber: 'SORT-2' },
      createdAt: new Date('2026-01-03T00:00:00Z'),
    });

    const result = await service.getCustomerServiceHistory(
      String(customer._id),
    );

    const bookingEvents = result.unifiedTimeline.filter(
      (e: any) => e.type === 'booking',
    );
    expect(bookingEvents).toHaveLength(2);
    expect(bookingEvents[0].bookingId).toBe(String(booking2._id));
    expect(bookingEvents[1].bookingId).toBe(String(booking1._id));
  });
});
