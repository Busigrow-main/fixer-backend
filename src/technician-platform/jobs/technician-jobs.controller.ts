import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TechnicianJobsService } from './technician-jobs.service';
import { JobCompletionService } from '../job-completion/job-completion.service';
import { JobSheetService } from '../job-sheet/job-sheet.service';
import { TechnicianGuard } from '../common/technician.guard';
import { RequireActiveTechnician } from '../common/require-active.decorator';
import { CurrentTechnician } from '../common/decorators';

@Controller('v1/jobs')
@UseGuards(AuthGuard('jwt'), TechnicianGuard)
@RequireActiveTechnician()
export class TechnicianJobsController {
  constructor(
    private readonly jobsService: TechnicianJobsService,
    private readonly completionService: JobCompletionService,
    private readonly jobSheetService: JobSheetService,
  ) {}

  @Get()
  list(
    @CurrentTechnician() technician: any,
    @Query('filter') filter?: string,
  ) {
    return this.jobsService.listJobs(technician._id.toString(), filter);
  }

  @Get('available')
  available(@CurrentTechnician() technician: any) {
    return this.jobsService.listAvailableJobs(technician._id.toString());
  }

  @Get(':jobId/job-sheet')
  getJobSheet(@CurrentTechnician() technician: any, @Param('jobId') jobId: string) {
    return this.jobSheetService.getJobSheet(jobId, technician._id.toString());
  }

  @Put(':jobId/job-sheet')
  saveJobSheet(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body() body: any,
  ) {
    return this.jobSheetService.saveJobSheet(jobId, technician._id.toString(), body);
  }

  @Post(':jobId/visits')
  createVisit(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body() body: any,
  ) {
    return this.jobSheetService.createOrUpdateVisit(
      jobId,
      technician._id.toString(),
      body,
    );
  }

  @Post(':jobId/visits/:visitId/parts')
  addPart(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Param('visitId') visitId: string,
    @Body() body: any,
  ) {
    return this.jobSheetService.addPart(
      jobId,
      technician._id.toString(),
      visitId,
      body,
    );
  }

  @Delete(':jobId/visits/:visitId/parts/:usageId')
  removePart(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Param('visitId') visitId: string,
    @Param('usageId') usageId: string,
  ) {
    return this.jobSheetService.removePart(
      jobId,
      technician._id.toString(),
      visitId,
      usageId,
    );
  }

  @Get(':jobId')
  get(@CurrentTechnician() technician: any, @Param('jobId') jobId: string) {
    return this.jobsService.getJob(technician._id.toString(), jobId);
  }

  @Post(':jobId/claim')
  claim(@CurrentTechnician() technician: any, @Param('jobId') jobId: string) {
    return this.jobsService.claimJob(technician._id.toString(), jobId);
  }

  @Post(':jobId/accept')
  accept(@CurrentTechnician() technician: any, @Param('jobId') jobId: string) {
    return this.jobsService.acceptJob(technician._id.toString(), jobId);
  }

  @Post(':jobId/reject')
  reject(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body('reason') reason: string,
  ) {
    return this.jobsService.rejectJob(technician._id.toString(), jobId, reason);
  }

  @Post(':jobId/status')
  updateStatus(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body('status') status: string,
  ) {
    return this.jobsService.updateStatus(technician._id.toString(), jobId, status);
  }

  @Post(':jobId/arrival')
  arrival(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.jobsService.markArrival(
      technician._id.toString(),
      jobId,
      body.lat,
      body.lng,
    );
  }

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
