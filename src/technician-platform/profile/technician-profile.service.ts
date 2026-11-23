import { Injectable } from '@nestjs/common';
import { TechniciansService } from '../../technicians/technicians.service';
import { TechnicianEngineService } from '../../technician-engine/technician-engine.service';

@Injectable()
export class TechnicianProfileService {
  constructor(
    private techniciansService: TechniciansService,
    private technicianEngine: TechnicianEngineService,
  ) {}

  getProfile(technicianId: string) {
    return this.techniciansService.findOne(technicianId);
  }

  updateProfile(technicianId: string, body: any) {
    const allowed = {
      name: body.name,
      address: body.address,
      city: body.city,
      profilePhotoUrl: body.profilePhotoUrl || body.photo,
      bankDetails: body.bankDetails,
      upiId: body.upiId,
      email: body.email,
    };
    return this.techniciansService.update(technicianId, allowed);
  }

  updateProfilePicture(technicianId: string, photoUrl: string) {
    return this.techniciansService.update(technicianId, {
      profilePhotoUrl: photoUrl,
    });
  }

  async updateAvailability(technicianId: string, status: string) {
    // Only going AVAILABLE needs the open-job check; going offline is always allowed.
    const hasActiveJob =
      status === 'AVAILABLE'
        ? await this.techniciansService.hasActiveJob(technicianId)
        : false;
    const availabilityStatus = this.technicianEngine.assertManualAvailability(
      status,
      hasActiveJob,
    );
    return this.techniciansService.update(technicianId, {
      availabilityStatus,
    });
  }
}
