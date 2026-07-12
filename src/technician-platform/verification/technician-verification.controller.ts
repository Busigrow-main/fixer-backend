import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TechnicianVerificationService } from './technician-verification.service';
import { TechnicianGuard } from '../common/technician.guard';
import { CurrentTechnician } from '../common/decorators';

@Controller('v1/verification')
export class TechnicianVerificationController {
  constructor(private readonly verificationService: TechnicianVerificationService) {}

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @Post('upload-document')
  uploadDocument(
    @CurrentTechnician() technician: any,
    @Body() body: { documentType: string; fileUrl: string },
  ) {
    return this.verificationService.uploadDocument(
      technician._id.toString(),
      body.documentType,
      body.fileUrl,
    );
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @Get('status')
  status(@CurrentTechnician() technician: any) {
    return this.verificationService.getStatus(technician._id.toString());
  }
}
