import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { TechniciansService } from '../../technicians/technicians.service';
import { OnboardingProgressHelper } from '../common/onboarding-progress.helper';
import { OnboardingAnalyticsService } from '../analytics/onboarding-analytics.service';
import {
  AllowedPincode,
  AllowedPincodeDocument,
} from '../schemas/allowed-pincode.schema';
import {
  PaymentOrder,
  PaymentOrderDocument,
} from '../schemas/payment-order.schema';
import { JOINING_FEE_AMOUNT, PAYMENT_GATEWAY } from '../constants';
import { TechnicianDocument } from '../../technicians/schemas/technician.schema';

@Injectable()
export class TechnicianOnboardingService {
  constructor(
    private techniciansService: TechniciansService,
    private progressHelper: OnboardingProgressHelper,
    private analyticsService: OnboardingAnalyticsService,
    @InjectModel(AllowedPincode.name)
    private pincodeModel: Model<AllowedPincodeDocument>,
    @InjectModel(PaymentOrder.name)
    private paymentOrderModel: Model<PaymentOrderDocument>,
  ) {}

  getStatus(technician: TechnicianDocument) {
    return this.progressHelper.getStatus(technician);
  }

  getProgress(technician: TechnicianDocument) {
    return {
      percent: this.progressHelper.getProgressPercent(technician),
      ...this.progressHelper.getStatus(technician),
    };
  }

  async checkPincode(pincode: string) {
    const normalized = pincode?.trim();
    if (!/^\d{6}$/.test(normalized)) {
      return { allowed: false, city: undefined };
    }

    if (this.isPincodeCheckBypassed()) {
      return { allowed: true, city: 'All areas (development)' };
    }

    const record = await this.pincodeModel
      .findOne({ pincode: normalized, isActive: true })
      .exec();
    return { allowed: !!record, city: record?.city };
  }

  async listAllowedPincodes() {
    const records = await this.pincodeModel
      .find({ isActive: true })
      .sort({ pincode: 1 })
      .exec();

    return {
      bypassActive: this.isPincodeCheckBypassed(),
      pincodes: records.map((r) => ({ pincode: r.pincode, city: r.city })),
    };
  }

  async saveProfile(technicianId: string, body: any) {
    const update: Record<string, unknown> = {
      name: body.name,
      address: body.address,
      city: body.city,
      pincode: body.pincode,
      experienceYears: body.experience,
      aadhaarNumber: body.aadhaarNumber,
      panNumber: body.panNumber,
      serviceCategories: body.serviceCategories || body.categories || [],
      profileCompleted: true,
      onboardingStep: 2,
    };

    if (body.pincode) {
      const { allowed } = await this.checkPincode(body.pincode);
      if (!allowed) {
        throw new BadRequestException('Service not available in this pincode');
      }
      update.serviceAreas = [body.pincode];
    }

    await this.analyticsService.logEvent(technicianId, 'PROFILE_COMPLETED', 2);
    return this.techniciansService.update(technicianId, update);
  }

  async updateServiceCategories(technicianId: string, categories: string[]) {
    if (!categories?.length) {
      throw new BadRequestException('At least one category is required');
    }
    return this.techniciansService.update(technicianId, {
      serviceCategories: categories,
      skills: categories,
      onboardingStep: 3,
    });
  }

  async createJoiningFeeOrder(technicianId: string) {
    const technician = await this.techniciansService.findOne(technicianId);
    if (technician.joiningFeePaid) {
      throw new BadRequestException('Joining fee already paid');
    }

    const gatewayOrderId = `join_${technicianId}_${Date.now()}`;
    const order = await this.paymentOrderModel.create({
      technicianId,
      amount: JOINING_FEE_AMOUNT,
      purpose: 'JOINING_FEE',
      gateway: PAYMENT_GATEWAY,
      gatewayOrderId,
      gatewayPayload: this.buildGatewayPayload(gatewayOrderId, JOINING_FEE_AMOUNT),
    });

    await this.analyticsService.logEvent(
      technicianId,
      'JOINING_FEE_INITIATED',
      3,
      { orderId: order._id },
    );

    return {
      orderId: order._id,
      amount: JOINING_FEE_AMOUNT,
      gateway: PAYMENT_GATEWAY,
      gatewayOrder: order.gatewayPayload,
    };
  }

  async handlePaymentWebhook(payload: any) {
    const orderId = payload.orderId || payload.gatewayOrderId;
    const order = await this.paymentOrderModel
      .findOne({
        $or: [{ _id: orderId }, { gatewayOrderId: orderId }],
      })
      .exec();

    if (!order) throw new NotFoundException('Payment order not found');
    if (order.status === 'PAID') return { success: true, alreadyProcessed: true };

    const status = payload.status || payload.event;
    if (!['PAID', 'payment.captured', 'SUCCESS'].includes(status)) {
      order.status = 'FAILED';
      await order.save();
      return { success: false };
    }

    order.status = 'PAID';
    await order.save();

    if (order.purpose === 'JOINING_FEE') {
      await this.techniciansService.update(order.technicianId.toString(), {
        joiningFeePaid: true,
        onboardingStep: 4,
      });
      await this.analyticsService.logEvent(
        order.technicianId.toString(),
        'JOINING_FEE_SUCCESS',
        3,
        { orderId: order._id },
      );
    }

    return { success: true };
  }

  logEvent(
    technicianId: string,
    event: string,
    step?: number,
    metadata?: Record<string, unknown>,
  ) {
    return this.analyticsService.logEvent(technicianId, event, step, metadata);
  }

  /** In development (or ALLOW_ALL_PINCODES=true), any 6-digit pincode is accepted. */
  private isPincodeCheckBypassed(): boolean {
    const flag = process.env.ALLOW_ALL_PINCODES;
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    return process.env.NODE_ENV !== 'production';
  }

  private buildGatewayPayload(orderId: string, amount: number) {
    const base = { orderId, amount, currency: 'INR' };
    switch (PAYMENT_GATEWAY) {
      case 'PHONEPE':
        return { ...base, merchantTransactionId: orderId, redirectUrl: `/pay/phonepe/${orderId}` };
      case 'CASHFREE':
        return { ...base, cfOrderId: orderId, paymentSessionId: crypto.randomBytes(16).toString('hex') };
      default:
        return { ...base, razorpayOrderId: orderId, key: process.env.RAZORPAY_KEY_ID || 'rzp_test' };
    }
  }
}
