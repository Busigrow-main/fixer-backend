import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { SubmitFeedbackDto } from './dtos/submit-feedback.dto';
import { UpdateFeedbackFollowUpDto } from './dtos/update-feedback-follow-up.dto';
import {
  FeedbackFollowUp,
  FeedbackFollowUpDocument,
} from './schemas/feedback-follow-up.schema';
import { Feedback, FeedbackDocument } from './schemas/feedback.schema';

const FEEDBACK_ELIGIBLE_STATUSES = new Set([
  'COMPLETED',
  'PAYMENT_COLLECTED',
]);

const DEFAULT_FOLLOW_UP_DAYS = 2;

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<FeedbackDocument>,
    @InjectModel(FeedbackFollowUp.name)
    private readonly followUpModel: Model<FeedbackFollowUpDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
  ) {}

  async submitForBooking(
    bookingId: string,
    userId: string,
    dto: SubmitFeedbackDto,
  ) {
    const booking = await this.findOwnedEligibleBooking(bookingId, userId);
    const bookingObjectId = booking._id as Types.ObjectId;
    const userObjectId = new Types.ObjectId(userId);

    const feedback = await this.feedbackModel
      .findOneAndUpdate(
        { bookingId: bookingObjectId },
        {
          $set: {
            userId: userObjectId,
            rating: dto.rating,
            resolved: dto.resolved,
            comment: dto.comment?.trim() || undefined,
          },
          $setOnInsert: {
            bookingId: bookingObjectId,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();

    if (!feedback) {
      throw new BadRequestException('Could not save feedback');
    }

    await this.bookingModel
      .updateOne(
        { _id: bookingObjectId },
        { $set: { feedbackId: feedback._id } },
      )
      .exec();

    if (this.needsFollowUp(dto.rating, dto.resolved)) {
      await this.ensureFollowUp(
        feedback._id as Types.ObjectId,
        bookingObjectId,
      );
    }

    return feedback;
  }

  async getForBooking(bookingId: string, userId: string) {
    await this.findOwnedBooking(bookingId, userId);
    const feedback = await this.feedbackModel
      .findOne({ bookingId: new Types.ObjectId(bookingId) })
      .exec();
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }
    return feedback;
  }

  async listFollowUps(page = 1, limit = 20, status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.followUpModel
        .find(filter)
        .populate([
          {
            path: 'feedbackId',
            populate: { path: 'userId', select: '-passwordHash' },
          },
          { path: 'bookingId', select: 'status jobClosed addressData serviceId' },
          { path: 'ownerId', select: '-passwordHash' },
        ])
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.followUpModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async updateFollowUp(id: string, dto: UpdateFeedbackFollowUpDto) {
    const followUp = await this.findFollowUp(id);

    if (dto.status === 'RESOLVED') {
      const resolution = (dto.resolution ?? followUp.resolution)?.trim();
      if (!resolution) {
        throw new BadRequestException(
          'Resolution notes are required to close a follow-up',
        );
      }
      followUp.resolution = resolution;
      followUp.status = 'RESOLVED';
      followUp.resolvedAt = new Date();
    } else if (dto.status === 'OPEN') {
      followUp.status = 'OPEN';
      followUp.resolvedAt = undefined;
    }

    if (dto.ownerId !== undefined) {
      followUp.ownerId = new Types.ObjectId(dto.ownerId);
    }
    if (dto.dueDate !== undefined) {
      followUp.dueDate = new Date(dto.dueDate);
    }
    if (dto.resolution !== undefined && dto.status !== 'RESOLVED') {
      followUp.resolution = dto.resolution.trim() || undefined;
    }

    await followUp.save();
    return followUp.populate([
      { path: 'feedbackId' },
      { path: 'bookingId', select: 'status jobClosed addressData serviceId' },
      { path: 'ownerId', select: '-passwordHash' },
    ]);
  }

  needsFollowUp(rating: number, resolved: boolean): boolean {
    return rating <= 2 || resolved === false;
  }

  private async ensureFollowUp(
    feedbackId: Types.ObjectId,
    bookingId: Types.ObjectId,
  ) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DEFAULT_FOLLOW_UP_DAYS);

    // Unique bookingId + $setOnInsert: repeated unhappy submits never spawn duplicates.
    await this.followUpModel
      .updateOne(
        { bookingId },
        {
          $setOnInsert: {
            feedbackId,
            bookingId,
            status: 'OPEN',
            dueDate,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  private async findOwnedEligibleBooking(bookingId: string, userId: string) {
    const booking = await this.findOwnedBooking(bookingId, userId);
    const eligible =
      booking.jobClosed === true ||
      FEEDBACK_ELIGIBLE_STATUSES.has(String(booking.status || '').toUpperCase());
    if (!eligible) {
      throw new BadRequestException(
        'Feedback is only available after the job is completed',
      );
    }
    return booking;
  }

  private async findOwnedBooking(bookingId: string, userId: string) {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new NotFoundException('Booking not found');
    }

    const userFilter =
      Types.ObjectId.isValid(userId) && String(userId).length === 24
        ? {
            $or: [
              { userId: new Types.ObjectId(userId) },
              { userId: String(userId) },
            ],
          }
        : { userId: String(userId) };

    const booking = await this.bookingModel
      .findOne({ _id: bookingId, ...userFilter })
      .exec();

    if (!booking) {
      // Hide existence from non-owners.
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  private async findFollowUp(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Follow-up not found');
    }
    const followUp = await this.followUpModel.findById(id).exec();
    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }
    return followUp;
  }
}
