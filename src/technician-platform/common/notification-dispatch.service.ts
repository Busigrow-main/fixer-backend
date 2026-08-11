import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from '../schemas/notification.schema';
import { Technician, TechnicianDocument } from '../../technicians/schemas/technician.schema';

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(Technician.name)
    private technicianModel: Model<TechnicianDocument>,
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

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[NOTIFY] ${type}: ${title} — ${body}`);
    }

    void this.sendExpoPush(technicianId, title, body, { ...data, type, notificationId: notification._id });

    return notification;
  }

  private async sendExpoPush(
    technicianId: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ) {
    try {
      const tech = await this.technicianModel.findById(technicianId).select('expoPushToken').lean().exec();
      const token = tech?.expoPushToken;
      if (!token || !token.startsWith('ExponentPushToken')) return;

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title,
          body,
          data,
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Expo push failed: ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      this.logger.warn(`Expo push error for tech ${technicianId}: ${(err as Error).message}`);
    }
  }
}
