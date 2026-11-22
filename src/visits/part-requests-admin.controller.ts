import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JWT_AUTH } from '../common/swagger';
import { TechnicianPartRequestReasonDto } from './dtos/technician-part-request.dto';
import { TechnicianPartRequestsService } from './technician-part-requests.service';

@ApiTags('Admin technician part requests')
@ApiBearerAuth(JWT_AUTH)
@Controller('api/v1/admin/part-requests')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AdminPartRequestsController {
  constructor(private readonly partRequestsService: TechnicianPartRequestsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.partRequestsService.listForAdmin(status, Number(page), Number(limit));
  }

  @Post(':requestId/approve')
  @ApiOperation({ summary: 'Approve a technician request and reserve saleable inventory atomically' })
  approve(@Param('requestId') requestId: string, @Req() request: any) {
    return this.partRequestsService.approve(requestId, request.user.userId);
  }

  @Post(':requestId/deny')
  @ApiOperation({ summary: 'Deny a pending technician part request with a reason' })
  deny(
    @Param('requestId') requestId: string,
    @Body() body: TechnicianPartRequestReasonDto,
    @Req() request: any,
  ) {
    return this.partRequestsService.deny(requestId, request.user.userId, body.reason);
  }

  @Post(':requestId/cancel')
  @ApiOperation({ summary: 'Cancel an approved request and release unissued reserved stock' })
  cancel(
    @Param('requestId') requestId: string,
    @Body() body: TechnicianPartRequestReasonDto,
    @Req() request: any,
  ) {
    return this.partRequestsService.cancel(requestId, request.user.userId, body.reason);
  }
}
