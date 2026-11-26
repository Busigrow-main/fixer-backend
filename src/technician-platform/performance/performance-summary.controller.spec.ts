import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import request from 'supertest';

import { Booking, BookingSchema } from '../../bookings/schemas/booking.schema';
import { Feedback, FeedbackSchema } from '../../feedback/schemas/feedback.schema';
import { Visit, VisitSchema } from '../../visits/schemas/visit.schema';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Earning, EarningSchema } from '../schemas/earning.schema';
import { Settlement, SettlementSchema } from '../settlements/schemas/settlement.schema';
import { SettlementItem, SettlementItemSchema } from '../settlements/schemas/settlement-item.schema';
import { PerformanceSummaryController } from './performance-summary.controller';
import { PerformanceSummaryService } from './performance-summary.service';
import {
  PerformanceSummaryGenerationStatus,
  ServicePerformanceSummary,
  ServicePerformanceSummaryDocument,
  ServicePerformanceSummarySchema,
} from './schemas/service-performance-summary.schema';

jest.setTimeout(120_000);

describe('PerformanceSummaryController API', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let summaryModel: Model<ServicePerformanceSummaryDocument>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const jwtGuard = AuthGuard('jwt');
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
      controllers: [PerformanceSummaryController],
      providers: [PerformanceSummaryService, RolesGuard],
    })
      .overrideGuard(jwtGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { headers: Record<string, string>; user?: object } };
        }) => {
          const req = context.switchToHttp().getRequest();
          const role = req.headers['x-test-role'];
          if (role) req.user = { userId: new Types.ObjectId().toString(), role };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
    summaryModel = moduleRef.get(getModelToken(ServicePerformanceSummary.name));
  });

  beforeEach(async () => {
    await summaryModel.deleteMany({});
    await summaryModel.create({
      businessDate: '2026-11-11',
      timeZone: 'Asia/Kolkata',
      windowStart: new Date('2026-11-10T18:30:00.000Z'),
      windowEnd: new Date('2026-11-11T18:30:00.000Z'),
      generationStatus: PerformanceSummaryGenerationStatus.COMPLETED,
      totalJobs: 2,
      completedJobs: 1,
      pendingJobs: 1,
      cancelledJobs: 0,
      completionRate: 50,
      totalTechnicianEarnings: 100,
      totalSettlementsPrepared: 1,
      totalSettlementsApproved: 0,
      totalSettlementsPaid: 0,
      failedSettlementPreparations: 0,
      disputedSettlements: 0,
      technicianBreakdown: [],
      serviceBreakdown: [],
    });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('lists and retrieves completed summaries for admins', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/performance-summaries?date=2026-11-11')
      .set('x-test-role', 'ADMIN')
      .expect(200);

    expect(list.body.total).toBe(1);
    expect(list.body.data[0].businessDate).toBe('2026-11-11');

    const detail = await request(app.getHttpServer())
      .get('/api/v1/admin/performance-summaries/2026-11-11')
      .set('x-test-role', 'ADMIN')
      .expect(200);

    expect(detail.body.completionRate).toBe(50);
  });

  it('rejects non-admin access and invalid date filters', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/performance-summaries')
      .set('x-test-role', 'TECHNICIAN')
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/admin/performance-summaries?date=2026-99-99')
      .set('x-test-role', 'ADMIN')
      .expect(400);
  });

  it('applies technician and service-type filters while keeping non-completed reports visible', async () => {
    const technicianId = new Types.ObjectId();
    await summaryModel.deleteMany({});
    await summaryModel.create([
      {
        businessDate: '2026-11-11',
        timeZone: 'Asia/Kolkata',
        windowStart: new Date('2026-11-10T18:30:00.000Z'),
        windowEnd: new Date('2026-11-11T18:30:00.000Z'),
        generationStatus: PerformanceSummaryGenerationStatus.COMPLETED,
        technicianBreakdown: [{ technicianId, completedJobs: 1, earnings: 10 }],
        serviceBreakdown: [{ serviceType: 'REPAIR', totalJobs: 1 }],
        metricsByTechnicianAndServiceType: [{ technicianId, serviceType: 'REPAIR', totalJobs: 1, completedJobs: 1, completionRateNumerator: 1, earnings: 10 }],
      },
      {
        businessDate: '2026-11-12',
        timeZone: 'Asia/Kolkata',
        windowStart: new Date('2026-11-11T18:30:00.000Z'),
        windowEnd: new Date('2026-11-12T18:30:00.000Z'),
        generationStatus: PerformanceSummaryGenerationStatus.PREPARING,
      },
    ]);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/performance-summaries?technicianId=${technicianId}&serviceType=REPAIR`)
      .set('x-test-role', 'ADMIN')
      .expect(200);

    expect(response.body.total).toBe(2);
    expect(response.body.data.map((row: { businessDate: string }) => row.businessDate)).toEqual(['2026-11-12', '2026-11-11']);
    await request(app.getHttpServer())
      .get('/api/v1/admin/performance-summaries/2026-11-12')
      .set('x-test-role', 'ADMIN')
      .expect(200)
      .expect(({ body }) => expect(body.generationStatus).toBe(PerformanceSummaryGenerationStatus.PREPARING));
  });

  it('allows admins to retry a failed report date', async () => {
    await summaryModel.deleteMany({});
    await summaryModel.create({
      businessDate: '2026-11-11',
      timeZone: 'Asia/Kolkata',
      windowStart: new Date('2026-11-10T18:30:00.000Z'),
      windowEnd: new Date('2026-11-11T18:30:00.000Z'),
      generationStatus: PerformanceSummaryGenerationStatus.FAILED,
      generationFailureReason: 'temporary database error',
      generationLeaseUntil: new Date(Date.now() - 1000),
    });
    const result = await request(app.getHttpServer())
      .post('/api/v1/admin/performance-summaries/2026-11-11/generate')
      .set('x-test-role', 'ADMIN')
      .expect(201);
    expect(result.body.generationStatus).toBe(PerformanceSummaryGenerationStatus.COMPLETED);
  });
});
