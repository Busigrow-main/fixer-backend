import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TechniciansService } from './technicians.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RejectApplicationDto } from '../technician-platform/dtos/reject-application.dto';

@Controller('api/v1/admin/technicians')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Post()
  create(@Body() createData: any) {
    return this.techniciansService.create({
      ...createData,
      onboardingStatus: 'APPROVED',
      isActive: true,
      approvedAt: new Date(),
    });
  }

  @Get('applications')
  findApplications(@Query('status') status?: string) {
    return this.techniciansService.findApplications(status);
  }

  @Get('verifications')
  listVerifications(@Query('status') status?: string) {
    return this.techniciansService.listVerifications(status);
  }

  @Post('verifications/:documentId/approve')
  approveVerificationDocument(
    @Param('documentId') documentId: string,
    @Request() req: any,
  ) {
    return this.techniciansService.approveVerificationDocument(
      documentId,
      req.user?.userId,
    );
  }

  @Post('verifications/:documentId/reject')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  rejectVerificationDocument(
    @Param('documentId') documentId: string,
    @Body() dto: RejectApplicationDto,
    @Request() req: any,
  ) {
    return this.techniciansService.rejectVerificationDocument(
      documentId,
      dto.reason,
      req.user?.userId,
    );
  }

  @Get()
  findAll() {
    return this.techniciansService.findAll();
  }

  @Get(':id/details')
  getDetails(@Param('id') id: string) {
    return this.techniciansService.getTechnicianWithJobs(id);
  }

  @Get(':id/verification')
  getVerification(@Param('id') id: string) {
    return this.techniciansService.getVerification(id);
  }

  @Post(':id/verification/request')
  requestVerification(@Param('id') id: string) {
    return this.techniciansService.requestVerification(id);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.techniciansService.activate(id);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.techniciansService.deactivate(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.techniciansService.findOne(id);
  }

  @Put(':id/approve')
  approveApplication(@Param('id') id: string) {
    return this.techniciansService.approveApplication(id);
  }

  @Put(':id/reject')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  rejectApplication(@Param('id') id: string, @Body() dto: RejectApplicationDto) {
    return this.techniciansService.rejectApplication(id, dto.reason);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.techniciansService.update(id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.techniciansService.remove(id);
  }
}
