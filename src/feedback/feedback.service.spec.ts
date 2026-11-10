import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingSchema } from '../bookings/schemas/booking.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { FeedbackService } from './feedback.service';
import {
  FeedbackFollowUp,
  FeedbackFollowUpDocument,
  FeedbackFollowUpSchema,
} from './schemas/feedback-follow-up.schema';
import { Feedback, FeedbackDocument, FeedbackSchema } from './schemas/feedback.schema';

describe('FeedbackService', () => {
  jest.setTimeout(60000);

  let service: FeedbackService;
  let bookingModel: Model<BookingDocument>;
  let feedbackModel: Model<FeedbackDocument>;
  let followUpModel: Model<FeedbackFollowUpDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;
  let userId: Types.ObjectId;
  let otherUserId: Types.ObjectId;
  let bookingId: Types.ObjectId;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Booking.name, schema: BookingSchema },
          { name: Feedback.name, schema: FeedbackSchema },
          { name: FeedbackFollowUp.name, schema: FeedbackFollowUpSchema },
          { name: User.name, schema: UserSchema },
        ]),
      ],
      providers: [FeedbackService],
    }).compile();

    service = module.get(FeedbackService);
    bookingModel = module.get(getModelToken(Booking.name));
    feedbackModel = module.get(getModelToken(Feedback.name));
    followUpModel = module.get(getModelToken(FeedbackFollowUp.name));
    await Promise.all([
      bookingModel.init(),
      feedbackModel.init(),
      followUpModel.init(),
    ]);
  });

  afterAll(async () => {
    if (module) await module.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      bookingModel.deleteMany({}),
      feedbackModel.deleteMany({}),
      followUpModel.deleteMany({}),
    ]);
    userId = new Types.ObjectId();
    otherUserId = new Types.ObjectId();
    const booking = await bookingModel.create({
      userId,
      serviceId: new Types.ObjectId(),
      subCategoryId: new Types.ObjectId(),
      contactPhone: '9876543210',
      addressData: { zip: '800001', text: 'Patna' },
      status: 'COMPLETED',
      jobClosed: true,
      description: 'AC not cooling',
    });
    bookingId = booking._id as Types.ObjectId;
  });

  it('lets only the booking owner submit, keeps one response, and creates one follow-up for unhappy feedback', async () => {
    await expect(
      service.submitForBooking(String(bookingId), String(otherUserId), {
        rating: 1,
        resolved: false,
        comment: 'Still broken',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const first = await service.submitForBooking(String(bookingId), String(userId), {
      rating: 1,
      resolved: false,
      comment: 'Still broken',
    });
    expect(first.rating).toBe(1);
    expect(await feedbackModel.countDocuments()).toBe(1);
    expect(await followUpModel.countDocuments()).toBe(1);

    const booking = await bookingModel.findById(bookingId).exec();
    expect(String(booking?.feedbackId)).toBe(String(first._id));

    const second = await service.submitForBooking(String(bookingId), String(userId), {
      rating: 2,
      resolved: false,
      comment: 'Updated note',
    });
    expect(String(second._id)).toBe(String(first._id));
    expect(second.rating).toBe(2);
    expect(await feedbackModel.countDocuments()).toBe(1);
    expect(await followUpModel.countDocuments()).toBe(1);
  });

  it('does not create a follow-up for happy resolved feedback', async () => {
    await service.submitForBooking(String(bookingId), String(userId), {
      rating: 5,
      resolved: true,
    });
    expect(await followUpModel.countDocuments()).toBe(0);
  });

  it('creates a follow-up when resolved is false even for a high rating', async () => {
    await service.submitForBooking(String(bookingId), String(userId), {
      rating: 4,
      resolved: false,
      comment: 'Issue remains',
    });
    expect(await followUpModel.countDocuments()).toBe(1);
  });

  it('rejects feedback before the job is complete', async () => {
    await bookingModel.updateOne(
      { _id: bookingId },
      { $set: { status: 'IN_PROGRESS', jobClosed: false } },
    );
    await expect(
      service.submitForBooking(String(bookingId), String(userId), {
        rating: 3,
        resolved: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets admin assign owner/due date and resolve a follow-up', async () => {
    await service.submitForBooking(String(bookingId), String(userId), {
      rating: 1,
      resolved: false,
    });
    const listed = await service.listFollowUps(1, 20, 'OPEN');
    expect(listed.total).toBe(1);
    const followUpId = String(listed.data[0]._id);
    const ownerId = new Types.ObjectId();
    const userModel = module.get<Model<any>>(getModelToken(User.name));
    await userModel.create({
      _id: ownerId,
      phone: '9999999999',
      passwordHash: 'hash',
      role: 'ADMIN',
      fullName: 'Ops Owner',
    });

    const updated = await service.updateFollowUp(followUpId, {
      ownerId: String(ownerId),
      dueDate: '2026-11-12T00:00:00.000Z',
      status: 'RESOLVED',
      resolution: 'Called customer and rebooked visit',
    });

    expect(updated.status).toBe('RESOLVED');
    expect(String((updated.ownerId as any)?._id || updated.ownerId)).toBe(
      String(ownerId),
    );
    expect(updated.resolution).toContain('rebooked');
  });
});
