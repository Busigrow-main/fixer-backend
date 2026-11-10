import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingSchema } from '../bookings/schemas/booking.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Visit, VisitDocument, VisitSchema } from '../visits/schemas/visit.schema';
import { OpsQueueService } from './ops-queue.service';
import { OpsSettingsService } from './ops-settings.service';
import { OpsSettings, OpsSettingsSchema } from './schemas/ops-settings.schema';

describe('OpsQueueService', () => {
  jest.setTimeout(60000);

  let service: OpsQueueService;
  let bookingModel: Model<BookingDocument>;
  let visitModel: Model<VisitDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Booking.name, schema: BookingSchema },
          { name: Visit.name, schema: VisitSchema },
          { name: OpsSettings.name, schema: OpsSettingsSchema },
          { name: User.name, schema: UserSchema },
        ]),
      ],
      providers: [OpsSettingsService, OpsQueueService],
    }).compile();

    service = module.get(OpsQueueService);
    bookingModel = module.get(getModelToken(Booking.name));
    visitModel = module.get(getModelToken(Visit.name));
    await Promise.all([bookingModel.init(), visitModel.init()]);
  });

  afterAll(async () => {
    if (module) await module.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      bookingModel.deleteMany({}),
      visitModel.deleteMany({}),
    ]);
  });

  const baseBooking = (overrides: Record<string, unknown> = {}) => ({
    userId: new Types.ObjectId(),
    serviceId: new Types.ObjectId(),
    subCategoryId: new Types.ObjectId(),
    contactPhone: '9876543210',
    addressData: { zip: '800001', text: 'Patna' },
    description: 'Test',
    status: 'CONFIRMED',
    ...overrides,
  });

  it('lists unassigned, accepted-not-started, parts, visit and review overdue rows with age/owner/nextAction', async () => {
    const settings = module.get(OpsSettingsService);
    await settings.updateSettings({
      acceptedNotStartedHours: 1,
      partsWaitHours: 1,
      visitOverdueHours: 1,
      reviewOverdueHours: 1,
    });
    const old = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const unassigned = await bookingModel.create(
      baseBooking({
        dispatchStatus: 'NEEDS_ADMIN',
        technicianId: null,
        adminEscalatedAt: old,
        createdAt: old,
        opsOwnerId: new Types.ObjectId(),
      }),
    );
    await bookingModel.create(
      baseBooking({
        status: 'ASSIGNED',
        assignmentStatus: 'ACCEPTED',
        acceptedAt: old,
        technicianId: new Types.ObjectId(),
        dispatchStatus: 'CLAIMED',
      }),
    );
    await bookingModel.create(
      baseBooking({
        status: 'IN_PROGRESS',
        opsPartsWait: true,
        opsFirstPendingAt: old,
        opsDueAt: old,
        dispatchStatus: 'CLAIMED',
        technicianId: new Types.ObjectId(),
      }),
    );
    const visitBooking = await bookingModel.create(
      baseBooking({
        status: 'IN_PROGRESS',
        dispatchStatus: 'CLAIMED',
        technicianId: new Types.ObjectId(),
        createdAt: old,
      }),
    );
    await visitModel.create({
      bookingId: visitBooking._id,
      technicianId: new Types.ObjectId(),
      visitOrder: 1,
      status: 'SCHEDULED',
      scheduledDate: old,
    });
    await bookingModel.create(
      baseBooking({
        status: 'COMPLETED',
        jobClosed: true,
        jobClosedAt: old,
        reviewStatus: 'PENDING',
        dispatchStatus: 'CLAIMED',
      }),
    );

    const listed = await service.listOverdue();
    const reasons = new Set(listed.data.map((row) => row.reason));
    expect(reasons.has('UNASSIGNED')).toBe(true);
    expect(reasons.has('ACCEPTED_NOT_STARTED')).toBe(true);
    expect(reasons.has('PARTS_WAIT')).toBe(true);
    expect(reasons.has('OVERDUE_VISIT')).toBe(true);
    expect(reasons.has('OVERDUE_REVIEW')).toBe(true);
    expect(listed.data.every((row) => row.ageLabel && row.nextAction)).toBe(true);
    expect(listed.data.find((row) => row.bookingId === String(unassigned._id))?.ageMs).toBeGreaterThan(0);
  });

  it('does not reset total job age when pending reason changes', async () => {
    const firstPendingAt = new Date('2026-11-01T08:00:00.000Z');
    const booking = await bookingModel.create(
      baseBooking({
        dispatchStatus: 'NEEDS_ADMIN',
        opsFirstPendingAt: firstPendingAt,
        opsPendingReason: 'UNASSIGNED',
      }),
    );

    await service.updatePendingWork(String(booking._id), {
      reason: 'PARTS_WAIT',
      nextAction: 'Order compressor',
      partsWait: true,
    });

    const updated = await bookingModel.findById(booking._id).lean().exec();
    expect(updated?.opsPendingReason).toBe('PARTS_WAIT');
    expect(updated?.opsNextAction).toBe('Order compressor');
    expect(new Date(updated!.opsFirstPendingAt!).toISOString()).toBe(
      firstPendingAt.toISOString(),
    );
  });

  it('deduplicates notifications within the cooldown window', async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const booking = await bookingModel.create(
      baseBooking({
        dispatchStatus: 'NEEDS_ADMIN',
        technicianId: null,
        adminEscalatedAt: old,
        createdAt: old,
      }),
    );

    const first = await service.syncAndNotify();
    expect(first.notified).toBeGreaterThanOrEqual(1);
    const afterFirst = await bookingModel.findById(booking._id).lean().exec();
    expect(afterFirst?.opsAlertReason).toBe('UNASSIGNED');
    expect(afterFirst?.adminNotes?.some((n) => String(n).includes('[OPS]'))).toBe(
      true,
    );

    const second = await service.syncAndNotify();
    expect(second.notified).toBe(0);
    const afterSecond = await bookingModel.findById(booking._id).lean().exec();
    const opsNotes = (afterSecond?.adminNotes || []).filter((n) =>
      String(n).includes('[OPS] UNASSIGNED'),
    );
    expect(opsNotes).toHaveLength(1);
  });
});
