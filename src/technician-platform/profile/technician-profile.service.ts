import { BadRequestException, Injectable } from '@nestjs/common';
import { TechniciansService } from '../../technicians/technicians.service';

const AVAILABILITY = new Set(['AVAILABLE', 'UNAVAILABLE', 'ON_JOB']);

@Injectable()
export class TechnicianProfileService {
  constructor(private techniciansService: TechniciansService) {}

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

  updateAvailability(technicianId: string, status: string) {
    if (!AVAILABILITY.has(status)) {
      throw new BadRequestException('status must be AVAILABLE, UNAVAILABLE, or ON_JOB');
    }
    return this.techniciansService.update(technicianId, {
      availabilityStatus: status,
    });
  }
}
