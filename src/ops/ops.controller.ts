import {
  Body,
  Controller,
  Get,
  Param,
  Put,
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
import { UpdateOpsPendingWorkDto } from './dtos/update-ops-pending-work.dto';
import { UpdateOpsSettingsDto } from './dtos/update-ops-settings.dto';
import { OpsQueueService } from './ops-queue.service';
import { OpsSettingsService } from './ops-settings.service';

@ApiTags('Ops')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('api/v1/admin/ops')
export class OpsController {
  constructor(
    private readonly opsQueue: OpsQueueService,
    private readonly opsSettings: OpsSettingsService,
  ) {}

  @Get('overdue')
  @ApiOperation({ summary: 'List overdue / pending ops queue rows' })
  listOverdue(@Query('reason') reason?: string) {
    return this.opsQueue.listOverdue(reason);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get configurable ops overdue thresholds' })
  getSettings() {
    return this.opsSettings.getSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update ops overdue thresholds' })
  updateSettings(@Body() body: UpdateOpsSettingsDto, @Req() req: any) {
    return this.opsSettings.updateSettings({
      ...body,
      updatedBy: req.user?.userId || req.user?.sub,
    });
  }

  @Put('bookings/:id/pending-work')
  @ApiOperation({
    summary:
      'Update pending reason / next action / owner / dueAt without resetting job age',
  })
  updatePendingWork(
    @Param('id') id: string,
    @Body() body: UpdateOpsPendingWorkDto,
  ) {
    return this.opsQueue.updatePendingWork(id, body);
  }
}
