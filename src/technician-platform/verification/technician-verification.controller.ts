import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TechnicianVerificationService } from './technician-verification.service';
import { TechnicianGuard } from '../common/technician.guard';
import { CurrentTechnician } from '../common/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../../common/swagger';
import { UploadVerificationDocumentDto } from '../dtos/technician-api.dto';

@ApiTags('Technician verification')
@Controller('v1/verification')
export class TechnicianVerificationController {
  constructor(private readonly verificationService: TechnicianVerificationService) {}

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @ApiBearerAuth(JWT_AUTH)
  @Post('upload-document')
  uploadDocument(
    @CurrentTechnician() technician: any,
    @Body() body: UploadVerificationDocumentDto,
  ) {
    return this.verificationService.uploadDocument(
      technician._id.toString(),
      body.documentType,
      body.fileUrl,
    );
  }

  @UseGuards(AuthGuard('jwt'), TechnicianGuard)
  @ApiBearerAuth(JWT_AUTH)
  @Get('status')
  status(@CurrentTechnician() technician: any) {
    return this.verificationService.getStatus(technician._id.toString());
  }
}
