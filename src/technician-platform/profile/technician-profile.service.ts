import { Injectable } from '@nestjs/common';
import { TechniciansService } from '../../technicians/technicians.service';

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
}
