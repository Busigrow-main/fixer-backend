import { Injectable } from '@nestjs/common';
import { Technician } from '../../technicians/schemas/technician.schema';

export interface OnboardingStatusResponse {
  step: number;
  completed: boolean;
  joiningFeePaid: boolean;
  profileCompleted: boolean;
  idVerified: boolean;
  verificationStatus: string;
  onboardingStatus: string;
}

@Injectable()
export class OnboardingProgressHelper {
  getStatus(technician: Technician): OnboardingStatusResponse {
    const step = this.getStep(technician);
    const completed =
      technician.joiningFeePaid &&
      technician.profileCompleted &&
      technician.idVerified &&
      technician.onboardingStatus === 'COMPLETED';

    return {
      step,
      completed,
      joiningFeePaid: technician.joiningFeePaid,
      profileCompleted: technician.profileCompleted,
      idVerified: technician.idVerified,
      verificationStatus: technician.verificationStatus,
      onboardingStatus: technician.onboardingStatus,
    };
  }

  getProgressPercent(technician: Technician): number {
    const flags = [
      !!technician.phone,
      technician.profileCompleted,
      (technician.serviceCategories?.length || 0) > 0,
      technician.joiningFeePaid,
      technician.idVerified,
    ];
    const done = flags.filter(Boolean).length;
    return Math.round((done / flags.length) * 100);
  }

  private getStep(technician: Technician): number {
    if (!technician.profileCompleted) return 1;
    if ((technician.serviceCategories?.length || 0) === 0) return 2;
    if (!technician.joiningFeePaid) return 3;
    if (!technician.idVerified) return 4;
    return 5;
  }
}
