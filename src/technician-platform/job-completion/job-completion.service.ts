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
import { VisitsService } from '../../visits/visits.service';
import { resolveTechnicianId } from '../common/technician-id.util';
import { SELF_PART_PLATFORM_FEE } from '../constants';
import { Booking, BookingDocument } from '../../bookings/schemas/booking.schema';
import {
  SparePartUsage,
  SparePartUsageDocument,
} from '../../visits/schemas/spare-part-usage.schema';

@Injectable()
export class JobCompletionService {
  constructor(
    private bookingsService: BookingsService,
    private earningsService: EarningsService,
    private visitsService: VisitsService,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(SparePartUsage.name)
    private sparePartUsageModel: Model<SparePartUsageDocument>,
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

    await this.completeVisitsAndDeductStock(jobId);

    try {
      await this.bookingsService.registerWarrantiesOnComplete(jobId);
    } catch (err) {
      console.error('Part warranty registration failed:', err);
    }

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
    const booking = await this.getOwnedBooking(jobId, technicianId);

    // Prefer job-sheet invoice totals when already filled
    const labourCharge =
      booking.invoiceData?.serviceTotal > 0
        ? booking.invoiceData.serviceTotal
        : payload.labourCharge;
    const partsCharge =
      booking.invoiceData?.partsTotal > 0
        ? booking.invoiceData.partsTotal
        : payload.partsCharge;

    const remarks =
      payload.remarks ||
      booking.jobDetails?.diagnosis ||
      booking.completionData?.remarks ||
      '';

    return this.bookingModel.findByIdAndUpdate(
      jobId,
      {
        $set: {
          completionData: {
            labourCharge,
            partsCharge,
            remarks,
            images: payload.images || booking.completionData?.images || [],
          },
          'invoiceData.serviceTotal': labourCharge,
          'invoiceData.partsTotal': partsCharge,
          'invoiceData.totalAmount':
            labourCharge +
            partsCharge +
            (booking.invoiceData?.additionalCharges || []).reduce(
              (s, c) => s + (c.amount || 0),
              0,
            ),
          jobSheetUpdatedAt: new Date(),
          jobSheetUpdatedBy: 'TECHNICIAN',
        },
        $inc: { jobSheetRevision: 1 },
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

    const labour =
      booking.completionData?.labourCharge ||
      booking.invoiceData?.serviceTotal ||
      0;
    const parts =
      booking.completionData?.partsCharge ||
      booking.invoiceData?.partsTotal ||
      0;
    const total = labour + parts;

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

    await this.applySelfPartFees(jobId, technicianId, method);
    await this.completeVisitsAndDeductStock(jobId);

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

    // Safety net if fees somehow missed at payment
    await this.applySelfPartFees(
      jobId,
      technicianId,
      (booking.jobPaymentMethod as 'CASH' | 'UPI' | 'CARD') || 'CASH',
    );

    try {
      await this.bookingsService.registerWarrantiesOnComplete(jobId);
    } catch (err) {
      console.error('Part warranty registration on close failed:', err);
    }

    return this.bookingModel.findByIdAndUpdate(
      jobId,
      { jobClosed: true, jobClosedAt: new Date() },
      { returnDocument: 'after' },
    );
  }

  /** Debit ₹100 per pending self-sourced spare-part line. */
  private async applySelfPartFees(
    jobId: string,
    technicianId: string,
    paymentMethod: string,
  ) {
    const visits = await this.visitsService.findByBooking(jobId);
    for (const visit of visits) {
      for (const usage of (visit.partsUsed || []) as any[]) {
        const isSelf = usage.isThirdParty || usage.sourcedBy === 'SELF';
        if (!isSelf || usage.platformFeeApplied) continue;

        const fee = usage.platformFeeAmount || SELF_PART_PLATFORM_FEE;
        await this.earningsService.recordEarning({
          technicianId,
          bookingId: jobId,
          amount: -Math.abs(fee),
          type: 'SELF_PART_FEE',
          paymentMethod,
          description: `Self-sourced part fee: ${usage.partName || 'part'}`,
        });
        await this.sparePartUsageModel.findByIdAndUpdate(usage._id, {
          platformFeeApplied: true,
          platformFeeAmount: fee,
          sourcedBy: 'SELF',
        });
      }
    }
  }

  /** Mark visits COMPLETED so inventory stock is deducted. */
  private async completeVisitsAndDeductStock(jobId: string) {
    const visits = await this.visitsService.findByBooking(jobId);
    for (const visit of visits as any[]) {
      if (visit.status === 'COMPLETED') continue;
      await this.visitsService.updateStatus(String(visit._id), {
        status: 'COMPLETED',
      });
    }
  }

  private async getOwnedBooking(jobId: string, technicianId: string) {
    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    if (resolveTechnicianId(booking.technicianId) !== technicianId) {
      throw new BadRequestException('Job not assigned to you');
    }
    return booking;
  }
}
