import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from '../schemas/notification.schema';

@Injectable()
export class NotificationDispatchService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async notify(
    technicianId: string,
    type: string,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
  ) {
    const notification = await this.notificationModel.create({
      technicianId: new Types.ObjectId(technicianId),
      type,
      title,
      body,
      data,
    });

    // TODO: push notification + SMS integrations
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[NOTIFY] ${type}: ${title} — ${body}`);
    }

    return notification;
  }
}
