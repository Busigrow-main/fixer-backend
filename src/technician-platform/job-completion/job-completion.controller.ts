import { Body, Controller, Param, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JobCompletionService } from './job-completion.service';
import { TechnicianGuard } from '../common/technician.guard';
import { RequireActiveTechnician } from '../common/require-active.decorator';
import { CurrentTechnician } from '../common/decorators';
import { JWT_AUTH } from '../../common/swagger';
import {
  FixxerCodeDto,
  OtpBodyDto,
  PaymentMethodDto,
  SignatureUrlDto,
} from '../../common/body.dto';
import { JobCompletionBodyDto } from '../dtos/technician-api.dto';

@ApiTags('Technician jobs')
@ApiBearerAuth(JWT_AUTH)
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
    @Body() body: OtpBodyDto,
  ) {
    return this.completionService.verifyOtp(jobId, technician._id.toString(), body.otp);
  }

  @Post(':jobId/customer-signature')
  signature(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body() body: SignatureUrlDto,
  ) {
    return this.completionService.uploadSignature(
      jobId,
      technician._id.toString(),
      body.signatureUrl,
    );
  }

  @Post(':jobId/completion')
  completion(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body() body: JobCompletionBodyDto,
  ) {
    return this.completionService.submitCompletion(jobId, technician._id.toString(), {
      labourCharge: body.labourCharge,
      partsCharge: body.partsCharge,
      remarks: body.remarks || '',
      images: body.images || [],
    });
  }

  @Post(':jobId/payment')
  payment(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body() body: PaymentMethodDto,
  ) {
    return this.completionService.recordPayment(jobId, technician._id.toString(), body.method);
  }

  @Post(':jobId/close')
  close(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body() body: FixxerCodeDto,
  ) {
    return this.completionService.closeJob(jobId, technician._id.toString(), body?.fixxerCode);
  }
}
