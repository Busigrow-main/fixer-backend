import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TechnicianProfileService } from './technician-profile.service';
import { TechnicianGuard } from '../common/technician.guard';
import { CurrentTechnician } from '../common/decorators';

@Controller('v1/profile')
@UseGuards(AuthGuard('jwt'), TechnicianGuard)
export class TechnicianProfileController {
  constructor(private readonly profileService: TechnicianProfileService) {}

  @Get()
  get(@CurrentTechnician() technician: any) {
    return this.profileService.getProfile(technician._id.toString());
  }

  @Put()
  update(@CurrentTechnician() technician: any, @Body() body: any) {
    return this.profileService.updateProfile(technician._id.toString(), body);
  }

  @Post('profile-picture')
  profilePicture(
    @CurrentTechnician() technician: any,
    @Body('photoUrl') photoUrl: string,
  ) {
    return this.profileService.updateProfilePicture(technician._id.toString(), photoUrl);
  }
}
