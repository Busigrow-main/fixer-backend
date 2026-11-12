import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';

import { Booking, BookingDocument, BookingSchema } from '../../bookings/schemas/booking.schema';
import { Earning, EarningDocument, EarningSchema } from '../schemas/earning.schema';
import {
  Settlement,
  SettlementDocument,
  SettlementReconciliationStatus,
  SettlementSchema,
  SettlementStatus,
} from '../settlements/schemas/settlement.schema';
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

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Booking.name, schema: BookingSchema },
          { name: Earning.name, schema: EarningSchema },
          { name: Settlement.name, schema: SettlementSchema },
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
  });

  beforeEach(async () => {
    await Promise.all([
      bookingModel.deleteMany({}),
      earningModel.deleteMany({}),
      settlementModel.deleteMany({}),
      summaryModel.deleteMany({}),
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
