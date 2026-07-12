import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { TechnicianGuard } from '../common/technician.guard';
import { CurrentTechnician } from '../common/decorators';

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
    @Body('notificationIds') notificationIds?: string[],
  ) {
    return this.notificationsService.markRead(technician._id.toString(), notificationIds);
  }
}
