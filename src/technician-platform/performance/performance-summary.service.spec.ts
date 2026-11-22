import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';

import { Booking, BookingDocument, BookingSchema } from '../../bookings/schemas/booking.schema';
import { Feedback, FeedbackDocument, FeedbackSchema } from '../../feedback/schemas/feedback.schema';
import { Visit, VisitDocument, VisitSchema } from '../../visits/schemas/visit.schema';
import { Earning, EarningDocument, EarningSchema } from '../schemas/earning.schema';
import {
  Settlement,
  SettlementDocument,
  SettlementReconciliationStatus,
  SettlementSchema,
  SettlementStatus,
} from '../settlements/schemas/settlement.schema';
import { SettlementItem, SettlementItemDocument, SettlementItemSchema } from '../settlements/schemas/settlement-item.schema';
import { PerformanceSummaryService } from './performance-summary.service';
import {
  PerformanceSummaryGenerationStatus,
  ServicePerformanceSummary,
  ServicePerformanceSummaryDocument,
  ServicePerformanceSummarySchema,
} from './schemas/service-performance-summary.schema';

jest.setTimeout(120_000);

describe('PerformanceSummaryService', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: PerformanceSummaryService;
  let bookingModel: Model<BookingDocument>;
  let earningModel: Model<EarningDocument>;
  let settlementModel: Model<SettlementDocument>;
  let summaryModel: Model<ServicePerformanceSummaryDocument>;
  let feedbackModel: Model<FeedbackDocument>;
  let visitModel: Model<VisitDocument>;
  let settlementItemModel: Model<SettlementItemDocument>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Booking.name, schema: BookingSchema },
          { name: Earning.name, schema: EarningSchema },
          { name: Settlement.name, schema: SettlementSchema },
          { name: SettlementItem.name, schema: SettlementItemSchema },
          { name: Feedback.name, schema: FeedbackSchema },
          { name: Visit.name, schema: VisitSchema },
          {
            name: ServicePerformanceSummary.name,
            schema: ServicePerformanceSummarySchema,
          },
        ]),
      ],
      providers: [PerformanceSummaryService],
    }).compile();

    service = moduleRef.get(PerformanceSummaryService);
    bookingModel = moduleRef.get(getModelToken(Booking.name));
    earningModel = moduleRef.get(getModelToken(Earning.name));
    settlementModel = moduleRef.get(getModelToken(Settlement.name));
    summaryModel = moduleRef.get(getModelToken(ServicePerformanceSummary.name));
    feedbackModel = moduleRef.get(getModelToken(Feedback.name));
    visitModel = moduleRef.get(getModelToken(Visit.name));
    settlementItemModel = moduleRef.get(getModelToken(SettlementItem.name));
  });

  beforeEach(async () => {
    await Promise.all([
      bookingModel.deleteMany({}),
      earningModel.deleteMany({}),
      settlementModel.deleteMany({}),
      summaryModel.deleteMany({}),
      feedbackModel.deleteMany({}),
      visitModel.deleteMany({}),
      settlementItemModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  function bookingData(overrides: Record<string, unknown> = {}) {
    return {
      userId: new Types.ObjectId(),
      serviceId: new Types.ObjectId(),
      subCategoryId: new Types.ObjectId(),
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test address' },
      ...overrides,
    };
  }

  it('aggregates core metrics using the Asia/Kolkata business-day window', async () => {
    const technicianId = new Types.ObjectId();
    const otherTechnicianId = new Types.ObjectId();
    await bookingModel.create([
      bookingData({
        technicianId,
        serviceType: 'REPAIR',
        status: 'PAYMENT_COLLECTED',
        createdAt: new Date('2026-11-10T19:00:00.000Z'),
        jobClosed: true,
        jobClosedAt: new Date('2026-11-11T04:00:00.000Z'),
        jobClosedByTechnicianId: technicianId,
      }),
      bookingData({
        technicianId,
        serviceType: 'INSTALLATION',
        status: 'IN_PROGRESS',
        createdAt: new Date('2026-11-11T10:00:00.000Z'),
      }),
      bookingData({
        technicianId: otherTechnicianId,
        serviceType: 'REPAIR',
        status: 'CANCELLED',
        createdAt: new Date('2026-11-10T20:00:00.000Z'),
        cancelledAt: new Date('2026-11-11T05:00:00.000Z'),
      }),
      bookingData({
        technicianId,
        serviceType: 'REPAIR',
        status: 'COMPLETED',
        createdAt: new Date('2026-11-09T10:00:00.000Z'),
        jobClosed: true,
        jobClosedAt: new Date('2026-11-11T06:00:00.000Z'),
        jobClosedByTechnicianId: technicianId,
      }),
    ]);
    await earningModel.create([
      {
        technicianId,
        amount: 1000,
        type: 'LABOUR',
        paymentMethod: 'UPI',
        earnedAt: new Date('2026-11-11T03:00:00.000Z'),
      },
      {
        technicianId,
        amount: -100,
        type: 'SELF_PART_FEE',
        paymentMethod: 'UPI',
        earnedAt: new Date('2026-11-11T03:30:00.000Z'),
      },
      {
        technicianId,
        amount: 500,
        type: 'BONUS',
        paymentMethod: 'UPI',
        earnedAt: new Date('2026-11-11T19:00:00.000Z'),
      },
    ]);
    await settlementModel.create([
      {
        technicianId,
        settlementDate: '2026-11-11',
        cutoffAt: new Date('2026-11-11T18:30:00.000Z'),
        status: SettlementStatus.PREPARED,
        paymentStatus: 'NOT_INITIATED',
        reconciliationStatus: SettlementReconciliationStatus.PENDING,
      },
      {
        technicianId: otherTechnicianId,
        settlementDate: '2026-11-11',
        cutoffAt: new Date('2026-11-11T18:30:00.000Z'),
        status: SettlementStatus.APPROVED,
        paymentStatus: 'NOT_INITIATED',
        reconciliationStatus: SettlementReconciliationStatus.DISPUTED,
      },
      {
        technicianId: new Types.ObjectId(),
        settlementDate: '2026-11-11',
        cutoffAt: new Date('2026-11-11T18:30:00.000Z'),
        status: SettlementStatus.PAID,
        paymentStatus: 'SUCCESS',
        reconciliationStatus: SettlementReconciliationStatus.PENDING,
      },
      {
        technicianId: new Types.ObjectId(),
        settlementDate: '2026-11-11',
        cutoffAt: new Date('2026-11-11T18:30:00.000Z'),
        status: SettlementStatus.PREPARATION_FAILED,
        paymentStatus: 'NOT_INITIATED',
        reconciliationStatus: SettlementReconciliationStatus.PENDING,
      },
    ]);

    const summary = await service.generateForDate('2026-11-11');

    expect(summary).toMatchObject({
      businessDate: '2026-11-11',
      timeZone: 'Asia/Kolkata',
      totalJobs: 3,
      completedJobs: 2,
      pendingJobs: 1,
      cancelledJobs: 1,
      // Rate is a created-day cohort: only jobs created in the window and
      // closed by summary generation count in the numerator. The other
      // event-day completion was created before this cohort.
      completionRate: 33.33,
      totalTechnicianEarnings: 900,
      totalSettlementsPrepared: 3,
      totalSettlementsApproved: 2,
      totalSettlementsPaid: 1,
      failedSettlementPreparations: 1,
      disputedSettlements: 1,
    });
    expect(summary.technicianBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          technicianId,
          completedJobs: 2,
          earnings: 900,
        }),
      ]),
    );
    expect(summary.serviceBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceType: 'REPAIR',
          totalJobs: 2,
          completedJobs: 2,
          cancelledJobs: 1,
        }),
        expect.objectContaining({
          serviceType: 'INSTALLATION',
          totalJobs: 1,
          completedJobs: 0,
          cancelledJobs: 0,
        }),
      ]),
    );
  });

  it('is idempotent and does not create duplicate summaries', async () => {
    await bookingModel.create(bookingData({
      status: 'IN_PROGRESS',
      createdAt: new Date('2026-11-11T10:00:00.000Z'),
    }));

    const first = await service.generateForDate('2026-11-11');
    const second = await service.generateForDate('2026-11-11');

    expect(String(second._id)).toBe(String(first._id));
    expect(await summaryModel.countDocuments({ businessDate: '2026-11-11' })).toBe(1);
    expect(second.generationStatus).toBe(PerformanceSummaryGenerationStatus.COMPLETED);
  });

  it('calculates the revised metric cohorts from explicit event sources and leaves legacy parts-wait flags unavailable', async () => {
    const technicianId = new Types.ObjectId();
    const serviceId = new Types.ObjectId();
    const subCategoryId = new Types.ObjectId();
    const start = new Date('2026-11-10T18:30:00.000Z');
    const createdAt = new Date('2026-11-10T19:30:00.000Z');
    const parent = await bookingModel.create(bookingData({
      serviceId,
      subCategoryId,
      serviceType: 'REPAIR',
      status: 'COMPLETED',
      productDetails: { serialNumber: 'UNIT-1' },
      jobClosed: true,
      jobClosedAt: new Date('2026-11-10T17:00:00.000Z'),
      createdAt: new Date('2026-11-09T10:00:00.000Z'),
    }));
    const repeated = await bookingModel.create(bookingData({
      technicianId,
      serviceId,
      subCategoryId,
      serviceType: 'REPAIR',
      status: 'COMPLETED',
      productDetails: { serialNumber: 'UNIT-1' },
      parentId: parent._id,
      jobClosed: true,
      jobClosedAt: new Date('2026-11-11T04:00:00.000Z'),
      acceptedAt: new Date('2026-11-10T20:00:00.000Z'),
      createdAt,
      firstAssignedAt: new Date('2026-11-10T21:30:00.000Z'),
      firstAssignedTechnicianId: technicianId,
    }));
    const unlinkedRepeatCandidate = await bookingModel.create(bookingData({
      technicianId,
      serviceId,
      subCategoryId,
      serviceType: 'REPAIR',
      status: 'COMPLETED',
      productDetails: { serialNumber: 'UNIT-1' },
      jobClosed: true,
      jobClosedAt: new Date('2026-11-11T05:00:00.000Z'),
      acceptedAt: new Date('2026-11-10T20:00:00.000Z'),
      createdAt,
    }));
    const openWithEvents = await bookingModel.create(bookingData({
      technicianId,
      serviceType: 'REPAIR',
      status: 'IN_PROGRESS',
      createdAt,
      partsWaitEvents: [
        { event: 'WAIT_STARTED', at: new Date('2026-11-10T20:00:00.000Z') },
        { event: 'PARTS_AVAILABLE', at: new Date('2026-11-11T01:00:00.000Z') },
        { event: 'WAIT_STARTED', at: new Date('2026-11-11T02:00:00.000Z') },
        { event: 'PARTS_AVAILABLE', at: new Date('2026-11-11T03:00:00.000Z') },
      ],
    }));
    await bookingModel.create(bookingData({
      technicianId,
      serviceType: 'REPAIR',
      status: 'IN_PROGRESS',
      opsPartsWait: true,
      createdAt,
      partsWaitEvents: [],
    }));
    const visit = await visitModel.create({
      bookingId: repeated._id,
      technicianId,
      visitOrder: 1,
      status: 'COMPLETED',
    });
    repeated.visits = [visit._id as Types.ObjectId];
    await repeated.save();
    // Submitted after the reporting day — still counts for the job closed that day.
    await feedbackModel.create({
      bookingId: repeated._id,
      userId: new Types.ObjectId(),
      rating: 5,
      resolved: true,
      createdAt: new Date('2026-11-12T06:00:00.000Z'),
    } as any);
    // Feedback in-window for a job that closed outside the reporting day — excluded.
    const closedEarlier = await bookingModel.create(bookingData({
      technicianId,
      serviceType: 'INSTALLATION',
      status: 'COMPLETED',
      jobClosed: true,
      jobClosedAt: new Date('2026-11-09T12:00:00.000Z'),
      createdAt: new Date('2026-11-08T10:00:00.000Z'),
    }));
    await feedbackModel.create({
      bookingId: closedEarlier._id,
      userId: new Types.ObjectId(),
      rating: 1,
      resolved: true,
      createdAt: new Date('2026-11-11T08:00:00.000Z'),
    } as any);

    const summary = await service.generateForDate('2026-11-11');
    expect(summary.backlogAgeJobs).toBeGreaterThanOrEqual(2);
    expect(summary.assignmentDelayJobs).toBe(1);
    expect(summary.assignmentDelayAverageMs).toBe(2 * 60 * 60 * 1000);
    expect(summary.completionTimeJobs).toBe(2);
    expect(summary.completionTimeAverageMs).toBe(8.5 * 60 * 60 * 1000);
    expect(summary.partsWaitJobs).toBe(1);
    expect(summary.partsWaitIntervals).toBe(2);
    expect(summary.partsWaitAverageMs).toBe(6 * 60 * 60 * 1000);
    expect(summary.repeatRepairEligibleJobs).toBe(2);
    expect(summary.repeatRepairJobs).toBe(1);
    expect(summary.repeatRepairRate).toBe(50);
    expect(summary.firstVisitEligibleJobs).toBe(1);
    expect(summary.firstVisitCompletedJobs).toBe(1);
    expect(summary.firstVisitCompletionRate).toBe(100);
    expect(summary.averageFeedbackRating).toBe(5);
    expect(summary.feedbackRatingCount).toBe(1);

    const filtered = await service.getByDate('2026-11-11', { technicianId: String(technicianId) });
    expect(filtered.assignmentDelayJobs).toBe(1);
    expect(filtered.totalJobs).toBeGreaterThan(0);
    expect(String(openWithEvents._id)).not.toBe(String(repeated._id));
    expect(String(unlinkedRepeatCandidate._id)).not.toBe(String(repeated._id));
    expect(start.getTime()).toBeLessThan(createdAt.getTime());
  });

  it('recovers a failed summary after its previous lease has expired', async () => {
    await summaryModel.create({
      businessDate: '2026-11-11',
      timeZone: 'Asia/Kolkata',
      windowStart: new Date('2026-11-10T18:30:00.000Z'),
      windowEnd: new Date('2026-11-11T18:30:00.000Z'),
      generationStatus: PerformanceSummaryGenerationStatus.FAILED,
      generationFailureReason: 'worker crashed',
      generationLeaseUntil: new Date(Date.now() - 1000),
    });

    const summary = await service.generateForDate('2026-11-11');

    expect(summary.generationStatus).toBe(PerformanceSummaryGenerationStatus.COMPLETED);
    expect(summary.completionRate).toBe(0);
    await expect(summaryModel.findOne({ businessDate: '2026-11-11' }).lean()).resolves.toMatchObject({
      generationStatus: PerformanceSummaryGenerationStatus.COMPLETED,
      totalJobs: 0,
    });
  });

  it('recovers an abandoned preparing summary without duplicating the summary document', async () => {
    await summaryModel.create({
      businessDate: '2026-11-11',
      timeZone: 'Asia/Kolkata',
      windowStart: new Date('2026-11-10T18:30:00.000Z'),
      windowEnd: new Date('2026-11-11T18:30:00.000Z'),
      generationStatus: PerformanceSummaryGenerationStatus.PREPARING,
      generationToken: 'stale-token',
      generationLeaseUntil: new Date(Date.now() - 1000),
    });

    const summary = await service.generateForDate('2026-11-11');

    expect(summary.generationStatus).toBe(PerformanceSummaryGenerationStatus.COMPLETED);
    expect(await summaryModel.countDocuments({ businessDate: '2026-11-11' })).toBe(1);
  });

  it('uses one summary document when workers generate the same date concurrently', async () => {
    await bookingModel.create(bookingData({
      status: 'IN_PROGRESS',
      createdAt: new Date('2026-11-11T10:00:00.000Z'),
    }));

    const results = await Promise.all([
      service.generateForDate('2026-11-11'),
      service.generateForDate('2026-11-11'),
    ]);

    expect(await summaryModel.countDocuments({ businessDate: '2026-11-11' })).toBe(1);
    expect(
      results.some((result) =>
        result.generationStatus === PerformanceSummaryGenerationStatus.COMPLETED,
      ),
    ).toBe(true);
    expect(await summaryModel.countDocuments({
      businessDate: '2026-11-11',
      generationStatus: PerformanceSummaryGenerationStatus.COMPLETED,
    })).toBe(1);
  });
});
