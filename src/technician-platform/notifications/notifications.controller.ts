import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { TechnicianGuard } from '../common/technician.guard';
import { CurrentTechnician } from '../common/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../../common/swagger';
import { NotificationReadDto, PushTokenDto } from '../../common/body.dto';

@ApiTags('Technician notifications')
@ApiBearerAuth(JWT_AUTH)
@Controller('v1/notifications')
@UseGuards(AuthGuard('jwt'), TechnicianGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentTechnician() technician: any) {
    return this.notificationsService.list(technician._id.toString());
  }

  @Post('read')
  markRead(
    @CurrentTechnician() technician: any,
    @Body() body: NotificationReadDto,
  ) {
    return this.notificationsService.markRead(technician._id.toString(), body.notificationIds);
  }

  @Post('register-token')
  registerToken(
    @CurrentTechnician() technician: any,
    @Body() body: PushTokenDto,
  ) {
    return this.notificationsService.registerPushToken(technician._id.toString(), body.token);
  }
}
