import { BadRequestException } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingSchema } from './schemas/booking.schema';
import { BookingsService } from './bookings.service';

describe('BookingsService quality review', () => {
  jest.setTimeout(60000);

  let service: BookingsService;
  let bookingModel: Model<BookingDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;
  let bookingId: string;
  let reviewerId: Types.ObjectId;
  let paidSnapshot: Record<string, unknown>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Booking.name, schema: BookingSchema },
        ]),
      ],
      providers: [
        {
          provide: BookingsService,
          useFactory: (model: Model<BookingDocument>) => {
            const svc = Object.create(BookingsService.prototype);
            svc.bookingModel = model;
            svc.jobDispatch = { broadcastJob: jest.fn() };
            svc.populateBookingDetail = async (id: string) =>
              model.findById(id).lean().exec();
            return svc as BookingsService;
          },
          inject: [getModelToken(Booking.name)],
        },
      ],
    }).compile();

    service = module.get(BookingsService);
    bookingModel = module.get(getModelToken(Booking.name));
    await bookingModel.init();
  });

  afterAll(async () => {
    if (module) await module.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await bookingModel.deleteMany({});
    reviewerId = new Types.ObjectId();
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: new Types.ObjectId(),
      subCategoryId: new Types.ObjectId(),
      contactPhone: '9876543210',
      addressData: { zip: '800001', text: 'Patna' },
      description: 'Not cooling',
      status: 'PAYMENT_COLLECTED',
      paymentStatus: 'PAID_CASH',
      jobClosed: true,
      isBilled: true,
      paidAt: new Date('2026-11-01T10:00:00.000Z'),
      jobClosedAt: new Date('2026-11-01T10:05:00.000Z'),
    });
    bookingId = String(booking._id);
    paidSnapshot = {
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      jobClosed: booking.jobClosed,
      isBilled: booking.isBilled,
      paidAt: booking.paidAt?.toISOString(),
    };
  });

  it('marks awaiting review only once and never overwrites a decision', async () => {
    await service.markAwaitingQualityReview(bookingId);
    await service.markAwaitingQualityReview(bookingId);
    let booking = await bookingModel.findById(bookingId).exec();
    expect(booking?.reviewStatus).toBe('PENDING');

    await service.submitQualityReview(
      bookingId,
      String(reviewerId),
      'APPROVED',
      'Looks good',
    );
    await service.markAwaitingQualityReview(bookingId);
    booking = await bookingModel.findById(bookingId).exec();
    expect(booking?.reviewStatus).toBe('APPROVED');
  });

  it('records approval/follow-up without resetting paid or completed fields', async () => {
    await service.submitQualityReview(
      bookingId,
      String(reviewerId),
      'NEEDS_FOLLOW_UP',
      'Missed drain cleaning',
    );
    let booking = await bookingModel.findById(bookingId).lean().exec();
    expect(booking?.reviewStatus).toBe('NEEDS_FOLLOW_UP');
    expect(booking?.reviewRemarks).toContain('drain');
    expect(booking?.reviewHistory).toHaveLength(1);
    expect(booking?.status).toBe(paidSnapshot.status);
    expect(booking?.paymentStatus).toBe(paidSnapshot.paymentStatus);
    expect(booking?.jobClosed).toBe(paidSnapshot.jobClosed);
    expect(booking?.isBilled).toBe(paidSnapshot.isBilled);
    expect(booking?.paidAt?.toISOString()).toBe(paidSnapshot.paidAt);

    await service.submitQualityReview(
      bookingId,
      String(reviewerId),
      'APPROVED',
      'Corrective completed',
    );
    booking = await bookingModel.findById(bookingId).lean().exec();
    expect(booking?.reviewStatus).toBe('APPROVED');
    expect(booking?.reviewHistory).toHaveLength(2);
    expect(booking?.paymentStatus).toBe('PAID_CASH');
    expect(booking?.jobClosed).toBe(true);
  });

  it('links corrective booking via parentId without touching original paid state', async () => {
    const corrective = await service.createCorrectiveBooking(bookingId);
    expect(String(corrective.parentId)).toBe(bookingId);
    expect(corrective.status).toBe('PENDING');
    expect(corrective.paymentStatus).toBe('UNPAID');

    const original = await bookingModel.findById(bookingId).lean().exec();
    expect(original?.correctiveBookingIds?.map(String)).toContain(
      String(corrective._id),
    );
    expect(original?.status).toBe(paidSnapshot.status);
    expect(original?.paymentStatus).toBe(paidSnapshot.paymentStatus);
    expect(original?.jobClosed).toBe(true);
    expect(original?.paidAt?.toISOString()).toBe(paidSnapshot.paidAt);
  });

  it('queues finished jobs with PENDING review status for the awaiting-review filter', async () => {
    await service.markAwaitingQualityReview(bookingId);
    const awaiting = await bookingModel
      .find({
        $and: [
          {
            $or: [
              { jobClosed: true },
              { status: { $in: ['COMPLETED', 'PAYMENT_COLLECTED'] } },
            ],
          },
          {
            $or: [
              { reviewStatus: 'PENDING' },
              { reviewStatus: { $exists: false } },
              { reviewStatus: null },
            ],
          },
        ],
      })
      .exec();
    expect(awaiting).toHaveLength(1);
    expect(String(awaiting[0]._id)).toBe(bookingId);
  });

  it('requires remarks for needs-follow-up', async () => {
    await expect(
      service.submitQualityReview(bookingId, String(reviewerId), 'NEEDS_FOLLOW_UP'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
