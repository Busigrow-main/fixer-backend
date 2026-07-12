import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { BookingsService } from '../../bookings/bookings.service';
import { EarningsService } from '../earnings/earnings.service';
import { Booking, BookingDocument } from '../../bookings/schemas/booking.schema';

@Injectable()
export class JobCompletionService {
  constructor(
    private bookingsService: BookingsService,
    private earningsService: EarningsService,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  async generateOtp(jobId: string, technicianId: string) {
    const booking = await this.getOwnedBooking(jobId, technicianId);
    if (!booking.otpRequired) {
      throw new BadRequestException('OTP not required for this job');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const completionOtpHash = await bcrypt.hash(otp, 10);

    await this.bookingModel.findByIdAndUpdate(jobId, {
      completionOtpHash,
      completionOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      completionOtpVerified: false,
    });

    // TODO: send SMS to customer at booking.contactPhone
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[JOB OTP] ${jobId}: ${otp}`);
    }

    return { sent: true, devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined };
  }

  async verifyOtp(jobId: string, technicianId: string, otp: string) {
    const booking = await this.getOwnedBooking(jobId, technicianId);

    if (!booking.completionOtpHash) {
      throw new BadRequestException('OTP not generated');
    }
    if (booking.completionOtpExpiresAt && booking.completionOtpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired');
    }

    const valid = await bcrypt.compare(otp, booking.completionOtpHash);
    if (!valid) throw new BadRequestException('Invalid OTP');

    return this.bookingModel.findByIdAndUpdate(
      jobId,
      {
        completionOtpVerified: true,
        completionOtpVerifiedAt: new Date(),
        status: 'COMPLETED',
      },
      { returnDocument: 'after' },
    );
  }

  async uploadSignature(jobId: string, technicianId: string, signatureUrl: string) {
    await this.getOwnedBooking(jobId, technicianId);
    return this.bookingModel.findByIdAndUpdate(
      jobId,
      { customerSignatureUrl: signatureUrl },
      { returnDocument: 'after' },
    );
  }

  async submitCompletion(
    jobId: string,
    technicianId: string,
    payload: { labourCharge: number; partsCharge: number; remarks: string; images: string[] },
  ) {
    await this.getOwnedBooking(jobId, technicianId);
    return this.bookingModel.findByIdAndUpdate(
      jobId,
      {
        completionData: payload,
        'invoiceData.serviceTotal': payload.labourCharge,
        'invoiceData.partsTotal': payload.partsCharge,
        'invoiceData.totalAmount': payload.labourCharge + payload.partsCharge,
      },
      { returnDocument: 'after' },
    );
  }

  async recordPayment(
    jobId: string,
    technicianId: string,
    method: 'CASH' | 'UPI' | 'CARD',
  ) {
    const booking = await this.getOwnedBooking(jobId, technicianId);

    const paymentStatusMap: Record<string, string> = {
      CASH: 'PAID_CASH',
      UPI: 'PAID_ONLINE',
      CARD: 'PAID_ONLINE',
    };

    const updated = await this.bookingModel.findByIdAndUpdate(
      jobId,
      {
        jobPaymentMethod: method,
        paymentStatus: paymentStatusMap[method],
        status: 'PAYMENT_COLLECTED',
      },
      { returnDocument: 'after' },
    );

    const total =
      (booking.completionData?.labourCharge || 0) +
      (booking.completionData?.partsCharge || 0);

    if (total > 0) {
      await this.earningsService.recordEarning({
        technicianId,
        bookingId: jobId,
        amount: total,
        type: 'LABOUR',
        paymentMethod: method,
        description: `Job payment for ${jobId}`,
      });
    }

    return updated;
  }

  async closeJob(jobId: string, technicianId: string) {
    const booking = await this.getOwnedBooking(jobId, technicianId);

    const verified = booking.completionOtpVerified || !!booking.customerSignatureUrl;
    const paymentDone = ['PAID_CASH', 'PAID_ONLINE'].includes(booking.paymentStatus);

    if (!verified || !paymentDone) {
      throw new BadRequestException(
        'Cannot close job: OTP/signature and payment must be completed',
      );
    }

    return this.bookingModel.findByIdAndUpdate(
      jobId,
      { jobClosed: true, jobClosedAt: new Date() },
      { returnDocument: 'after' },
    );
  }

  private async getOwnedBooking(jobId: string, technicianId: string) {
    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    if (booking.technicianId?.toString() !== technicianId) {
      throw new BadRequestException('Job not assigned to you');
    }
    return booking;
  }
}
