import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TechnicianAdminService } from './technician-admin.service';
import { TechnicianVerificationService } from '../verification/technician-verification.service';
import { OnboardingAnalyticsService } from '../analytics/onboarding-analytics.service';

@Controller('v1/admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class TechnicianPlatformAdminController {
  constructor(
    private readonly adminService: TechnicianAdminService,
    private readonly verificationService: TechnicianVerificationService,
    private readonly analyticsService: OnboardingAnalyticsService,
  ) {}

  @Get('technicians')
  listTechnicians(
    @Query('status') status?: string,
    @Query('city') city?: string,
    @Query('pincode') pincode?: string,
  ) {
    return this.adminService.listTechnicians({ status, city, pincode });
  }

  @Get('technicians/:id')
  getTechnician(@Param('id') id: string) {
    return this.adminService.getTechnician(id);
  }

  @Put('technicians/:id')
  updateTechnician(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateTechnician(id, body);
  }

  @Post('technicians/:id/activate')
  activate(@Param('id') id: string) {
    return this.adminService.activate(id);
  }

  @Post('technicians/:id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.adminService.deactivate(id);
  }

  @Post('technicians/:id/assign-job')
  assignJob(@Param('id') id: string, @Body('bookingId') bookingId: string) {
    return this.adminService.assignJob(id, bookingId);
  }

  @Post('verification/request/:technicianId')
  requestVerification(@Param('technicianId') technicianId: string) {
    return this.verificationService.requestUpload(technicianId);
  }

  @Get('verifications')
  listVerifications(@Query('status') status?: string) {
    return this.verificationService.listForAdmin(status);
  }

  @Post('verification/approve/:id')
  approveVerification(@Param('id') id: string, @Request() req: any) {
    return this.verificationService.approve(id, req.user.userId);
  }

  @Post('verification/reject/:id')
  rejectVerification(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.verificationService.reject(id, reason, req.user.userId);
  }

  @Post('onboarding-call')
  logOnboardingCall(
    @Body() body: { technicianId: string; duration: number; outcome: string; notes?: string },
    @Request() req: any,
  ) {
    return this.analyticsService.logCall({
      ...body,
      calledBy: req.user.userId,
    });
  }

  @Get('onboarding-analytics')
  onboardingAnalytics() {
    return this.analyticsService.getAnalytics();
  }
}
