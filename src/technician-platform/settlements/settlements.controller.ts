import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JWT_AUTH } from '../../common/swagger';
import {
  RecordSettlementPaymentDto,
  PrepareSettlementsDto,
  RejectSettlementDto,
  ReconcileSettlementDto,
} from './settlements.dto';
import { SettlementsService } from './settlements.service';

@ApiTags('Admin settlements')
@ApiBearerAuth(JWT_AUTH)
@Controller('v1/admin/settlements')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post('prepare')
  prepare(@Body() body: PrepareSettlementsDto) {
    return this.settlementsService.prepareAll(
      body.cutoffAt ? new Date(body.cutoffAt) : undefined,
    );
  }

  @Get()
  list() {
    return this.settlementsService.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.settlementsService.getById(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Request() request: { user: { userId: string } }) {
    return this.settlementsService.approve(id, request.user);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: RejectSettlementDto,
    @Request() request: { user: { userId: string } },
  ) {
    return this.settlementsService.reject(id, body.reason, request.user);
  }

  @Post(':id/payment')
  recordPayment(
    @Param('id') id: string,
    @Body() body: RecordSettlementPaymentDto,
    @Request() request: { user: { userId: string } },
  ) {
    return this.settlementsService.recordPayment(id, body, request.user);
  }

  @Post(':id/reconcile')
  reconcile(
    @Param('id') id: string,
    @Body() body: ReconcileSettlementDto,
    @Request() request: { user: { userId: string } },
  ) {
    return this.settlementsService.reconcile(id, body, request.user);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: RejectSettlementDto,
    @Request() request: { user: { userId: string } },
  ) {
    return this.settlementsService.cancel(id, body.reason, request.user);
  }
}
