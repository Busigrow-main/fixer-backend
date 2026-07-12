import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TechnicianOnboardingService } from './technician-onboarding.service';
import { TechnicianGuard } from '../common/technician.guard';
import { CurrentTechnician } from '../common/decorators';

@Controller('v1/onboarding')
export class TechnicianOnboardingController {
  constructor(private readonly onboardingService: TechnicianOnboardingService) {}

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @Get('status')
  status(@CurrentTechnician() technician: any) {
    return this.onboardingService.getStatus(technician);
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @Get('progress')
  progress(@CurrentTechnician() technician: any) {
    return this.onboardingService.getProgress(technician);
  }

  @Post('check-pincode')
  checkPincode(@Body('pincode') pincode: string) {
    return this.onboardingService.checkPincode(pincode);
  }

  @Get('allowed-pincodes')
  listAllowedPincodes() {
    return this.onboardingService.listAllowedPincodes();
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @Post('profile')
  saveProfile(@CurrentTechnician() technician: any, @Body() body: any) {
    return this.onboardingService.saveProfile(technician._id.toString(), body);
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @Post('service-categories')
  serviceCategories(
    @CurrentTechnician() technician: any,
    @Body('categories') categories: string[],
  ) {
    return this.onboardingService.updateServiceCategories(
      technician._id.toString(),
      categories,
    );
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @Post('pay-joining-fee')
  payJoiningFee(@CurrentTechnician() technician: any) {
    return this.onboardingService.createJoiningFeeOrder(technician._id.toString());
  }

  @Post('payment/webhook')
  paymentWebhook(@Body() payload: any) {
    return this.onboardingService.handlePaymentWebhook(payload);
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @Post('events')
  logEvent(
    @CurrentTechnician() technician: any,
    @Body() body: { event: string; step?: number; metadata?: Record<string, unknown> },
  ) {
    return this.onboardingService.logEvent(
      technician._id.toString(),
      body.event,
      body.step,
      body.metadata,
    );
  }
}
