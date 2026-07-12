import { Body, Controller, Param, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JobCompletionService } from './job-completion.service';
import { TechnicianGuard } from '../common/technician.guard';
import { RequireActiveTechnician } from '../common/require-active.decorator';
import { CurrentTechnician } from '../common/decorators';

@Controller('v1/jobs')
@UseGuards(AuthGuard('jwt'), TechnicianGuard)
@RequireActiveTechnician()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class JobCompletionController {
  constructor(private readonly completionService: JobCompletionService) {}

  @Post(':jobId/generate-otp')
  generateOtp(@CurrentTechnician() technician: any, @Param('jobId') jobId: string) {
    return this.completionService.generateOtp(jobId, technician._id.toString());
  }

  @Post(':jobId/verify-otp')
  verifyOtp(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body('otp') otp: string,
  ) {
    return this.completionService.verifyOtp(jobId, technician._id.toString(), otp);
  }

  @Post(':jobId/customer-signature')
  signature(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body('signatureUrl') signatureUrl: string,
  ) {
    return this.completionService.uploadSignature(
      jobId,
      technician._id.toString(),
      signatureUrl,
    );
  }

  @Post(':jobId/completion')
  completion(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body() body: { labourCharge: number; partsCharge: number; remarks: string; images: string[] },
  ) {
    return this.completionService.submitCompletion(jobId, technician._id.toString(), body);
  }

  @Post(':jobId/payment')
  payment(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body('method') method: 'CASH' | 'UPI' | 'CARD',
  ) {
    return this.completionService.recordPayment(jobId, technician._id.toString(), method);
  }

  @Post(':jobId/close')
  close(@CurrentTechnician() technician: any, @Param('jobId') jobId: string) {
    return this.completionService.closeJob(jobId, technician._id.toString());
  }
}
