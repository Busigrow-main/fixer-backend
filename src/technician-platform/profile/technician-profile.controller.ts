import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TechnicianProfileService } from './technician-profile.service';
import { TechnicianGuard } from '../common/technician.guard';
import { CurrentTechnician } from '../common/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../../common/swagger';
import { AvailabilityDto, PhotoUrlDto } from '../../common/body.dto';

@ApiTags('Technician profile')
@ApiBearerAuth(JWT_AUTH)
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
    @Body() body: PhotoUrlDto,
  ) {
    return this.profileService.updateProfilePicture(technician._id.toString(), body.photoUrl);
  }

  @Post('availability')
  availability(
    @CurrentTechnician() technician: any,
    @Body() body: AvailabilityDto,
  ) {
    return this.profileService.updateAvailability(technician._id.toString(), body.status);
  }
}
