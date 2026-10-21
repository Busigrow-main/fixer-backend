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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../../common/swagger';
import {
  PincodeBodyDto,
  ServiceCategoriesDto,
} from '../../common/body.dto';
import { OnboardingEventDto } from '../dtos/technician-api.dto';

@ApiTags('Technician onboarding')
@Controller('v1/onboarding')
export class TechnicianOnboardingController {
  constructor(private readonly onboardingService: TechnicianOnboardingService) {}

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @ApiBearerAuth(JWT_AUTH)
  @Get('status')
  status(@CurrentTechnician() technician: any) {
    return this.onboardingService.getStatus(technician);
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @ApiBearerAuth(JWT_AUTH)
  @Get('progress')
  progress(@CurrentTechnician() technician: any) {
    return this.onboardingService.getProgress(technician);
  }

  @Post('check-pincode')
  @ApiOperation({ summary: 'Check if a pincode is allowed for technicians' })
  checkPincode(@Body() body: PincodeBodyDto) {
    return this.onboardingService.checkPincode(body.pincode);
  }

  @Get('allowed-pincodes')
  listAllowedPincodes() {
    return this.onboardingService.listAllowedPincodes();
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @ApiBearerAuth(JWT_AUTH)
  @Post('profile')
  saveProfile(@CurrentTechnician() technician: any, @Body() body: any) {
    return this.onboardingService.saveProfile(technician._id.toString(), body);
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @ApiBearerAuth(JWT_AUTH)
  @Post('service-categories')
  serviceCategories(
    @CurrentTechnician() technician: any,
    @Body() body: ServiceCategoriesDto,
  ) {
    return this.onboardingService.updateServiceCategories(
      technician._id.toString(),
      body.categories,
    );
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @ApiBearerAuth(JWT_AUTH)
  @Post('pay-joining-fee')
  payJoiningFee(@CurrentTechnician() technician: any) {
    return this.onboardingService.createJoiningFeeOrder(technician._id.toString());
  }

  @Post('payment/webhook')
  paymentWebhook(@Body() payload: any) {
    return this.onboardingService.handlePaymentWebhook(payload);
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @ApiBearerAuth(JWT_AUTH)
  @Post('events')
  logEvent(
    @CurrentTechnician() technician: any,
    @Body() body: OnboardingEventDto,
  ) {
    return this.onboardingService.logEvent(
      technician._id.toString(),
      body.event,
      body.step,
      body.metadata,
    );
  }
}
