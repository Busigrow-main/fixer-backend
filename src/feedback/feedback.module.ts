import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import {
  FeedbackFollowUp,
  FeedbackFollowUpSchema,
} from './schemas/feedback-follow-up.schema';
import { Feedback, FeedbackSchema } from './schemas/feedback.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Feedback.name, schema: FeedbackSchema },
      { name: FeedbackFollowUp.name, schema: FeedbackFollowUpSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
