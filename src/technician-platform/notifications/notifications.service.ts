import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from '../schemas/notification.schema';
import { TechniciansService } from '../../technicians/technicians.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private techniciansService: TechniciansService,
  ) {}

  list(technicianId: string) {
    return this.notificationModel
      .find({ technicianId: new Types.ObjectId(technicianId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markRead(technicianId: string, notificationIds?: string[]) {
    const filter: Record<string, unknown> = {
      technicianId: new Types.ObjectId(technicianId),
      read: false,
    };
    if (notificationIds?.length) {
      filter._id = { $in: notificationIds.map((id) => new Types.ObjectId(id)) };
    }

    await this.notificationModel.updateMany(filter, {
      read: true,
      readAt: new Date(),
    });

    return { success: true };
  }

  registerPushToken(technicianId: string, token: string) {
    return this.techniciansService.update(technicianId, {
      expoPushToken: token,
    });
  }
}
