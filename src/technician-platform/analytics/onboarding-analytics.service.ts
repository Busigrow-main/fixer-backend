import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  OnboardingEvent,
  OnboardingEventDocument,
} from '../schemas/onboarding-event.schema';
import {
  OnboardingCall,
  OnboardingCallDocument,
} from '../schemas/onboarding-call.schema';
import { Technician, TechnicianDocument } from '../../technicians/schemas/technician.schema';
import { ONBOARDING_CALL_COST } from '../constants';

@Injectable()
export class OnboardingAnalyticsService {
  constructor(
    @InjectModel(OnboardingEvent.name)
    private eventModel: Model<OnboardingEventDocument>,
    @InjectModel(OnboardingCall.name)
    private callModel: Model<OnboardingCallDocument>,
    @InjectModel(Technician.name)
    private technicianModel: Model<TechnicianDocument>,
  ) {}

  logEvent(
    technicianId: string,
    event: string,
    step?: number,
    metadata: Record<string, unknown> = {},
  ) {
    return this.eventModel.create({
      technicianId: new Types.ObjectId(technicianId),
      event,
      step,
      metadata,
    });
  }

  logCall(data: {
    technicianId: string;
    duration: number;
    outcome: string;
    calledBy?: string;
    notes?: string;
  }) {
    return this.callModel.create({
      technicianId: new Types.ObjectId(data.technicianId),
      duration: data.duration,
      outcome: data.outcome,
      calledBy: data.calledBy ? new Types.ObjectId(data.calledBy) : undefined,
      notes: data.notes,
    });
  }

  async getAnalytics() {
    const [
      totalRegistrations,
      otpVerified,
      profileCompleted,
      joiningFeePaid,
      idVerified,
      activated,
      calls,
      events,
      technicians,
    ] = await Promise.all([
      this.technicianModel.countDocuments().exec(),
      this.eventModel.countDocuments({ event: 'OTP_VERIFIED' }).exec(),
      this.technicianModel.countDocuments({ profileCompleted: true }).exec(),
      this.technicianModel.countDocuments({ joiningFeePaid: true }).exec(),
      this.technicianModel.countDocuments({ idVerified: true }).exec(),
      this.technicianModel.countDocuments({ isActive: true }).exec(),
      this.callModel.find().exec(),
      this.eventModel.find().sort({ createdAt: 1 }).exec(),
      this.technicianModel.find().exec(),
    ]);

    const otpSent = await this.eventModel.countDocuments({ event: 'OTP_SENT' }).exec();
    const totalCalls = calls.length;
    const totalOnboardingCost = totalCalls * ONBOARDING_CALL_COST;
    const activationRate = totalRegistrations
      ? Math.round((activated / totalRegistrations) * 100)
      : 0;
    const costPerActivated = activated
      ? Math.round(totalOnboardingCost / activated)
      : 0;

    const dropOffByStep = this.computeDropOff(events, technicians);
    const activationByPincode = this.activationByPincode(technicians);

    const avgOnboardingTimeMs = this.averageOnboardingTime(technicians);

    return {
      totalRegistrations,
      otpVerificationRate: otpSent ? Math.round((otpVerified / otpSent) * 100) : 0,
      profileCompletionRate: totalRegistrations
        ? Math.round((profileCompleted / totalRegistrations) * 100)
        : 0,
      joiningFeeConversionRate: profileCompleted
        ? Math.round((joiningFeePaid / profileCompleted) * 100)
        : 0,
      idVerificationRate: joiningFeePaid
        ? Math.round((idVerified / joiningFeePaid) * 100)
        : 0,
      averageOnboardingTimeHours: Math.round(avgOnboardingTimeMs / (1000 * 60 * 60)),
      callsMadePerTechnician: totalRegistrations
        ? +(totalCalls / totalRegistrations).toFixed(2)
        : 0,
      totalOnboardingCost,
      costPerActivatedTechnician: costPerActivated,
      activationRate,
      dropOffByOnboardingStep: dropOffByStep,
      activationRateByPincode: activationByPincode,
      activatedTechnicians: activated,
    };
  }

  private computeDropOff(events: OnboardingEventDocument[], technicians: TechnicianDocument[]) {
    const stepEvents = ['OTP_VERIFIED', 'PROFILE_COMPLETED', 'JOINING_FEE_SUCCESS', 'ID_VERIFIED'];
    const counts: Record<string, number> = {};
    for (const e of stepEvents) {
      counts[e] = events.filter((ev) => ev.event === e).length;
    }
    return {
      afterOtp: technicians.length - (counts.OTP_VERIFIED || 0),
      afterProfile: (counts.OTP_VERIFIED || 0) - (counts.PROFILE_COMPLETED || 0),
      afterJoiningFee: (counts.PROFILE_COMPLETED || 0) - (counts.JOINING_FEE_SUCCESS || 0),
      afterIdVerification: (counts.JOINING_FEE_SUCCESS || 0) - (counts.ID_VERIFIED || 0),
    };
  }

  private activationByPincode(technicians: TechnicianDocument[]) {
    const map: Record<string, { total: number; active: number }> = {};
    for (const tech of technicians) {
      const pin = tech.pincode || 'unknown';
      if (!map[pin]) map[pin] = { total: 0, active: 0 };
      map[pin].total += 1;
      if (tech.isActive) map[pin].active += 1;
    }
    return Object.entries(map).map(([pincode, data]) => ({
      pincode,
      total: data.total,
      active: data.active,
      rate: data.total ? Math.round((data.active / data.total) * 100) : 0,
    }));
  }

  private averageOnboardingTime(technicians: TechnicianDocument[]) {
    const completed = technicians.filter(
      (t) => t.onboardingCompletedAt && (t as any).createdAt,
    );
    if (!completed.length) return 0;
    const total = completed.reduce((sum, t) => {
      const start = new Date((t as any).createdAt).getTime();
      const end = new Date(t.onboardingCompletedAt!).getTime();
      return sum + (end - start);
    }, 0);
    return total / completed.length;
  }
}
