import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TechniciansService } from '../../technicians/technicians.service';
import { BookingsService } from '../../bookings/bookings.service';
import { NotificationDispatchService } from '../common/notification-dispatch.service';
import { Technician, TechnicianDocument } from '../../technicians/schemas/technician.schema';

@Injectable()
export class TechnicianAdminService {
  constructor(
    private techniciansService: TechniciansService,
    private bookingsService: BookingsService,
    private notificationDispatch: NotificationDispatchService,
    @InjectModel(Technician.name)
    private technicianModel: Model<TechnicianDocument>,
  ) {}

  listTechnicians(filters: {
    status?: string;
    city?: string;
    pincode?: string;
  }) {
    const query: Record<string, unknown> = {};

    switch (filters.status?.toUpperCase()) {
      case 'PENDING':
        query.verificationStatus = { $in: ['PENDING', 'REQUESTED'] };
        break;
      case 'VERIFIED':
        query.idVerified = true;
        break;
      case 'ACTIVE':
        query.isActive = true;
        break;
      case 'INACTIVE':
        query.isActive = false;
        break;
      default:
        break;
    }

    if (filters.city) query.city = filters.city;
    if (filters.pincode) query.pincode = filters.pincode;

    return this.technicianModel.find(query).sort({ createdAt: -1 }).exec();
  }

  getTechnician(id: string) {
    return this.techniciansService.getTechnicianWithJobs(id);
  }

  updateTechnician(id: string, data: any) {
    return this.techniciansService.update(id, data);
  }

  activate(id: string) {
    return this.techniciansService.update(id, { isActive: true });
  }

  deactivate(id: string) {
    return this.techniciansService.update(id, { isActive: false });
  }

  async assignJob(technicianId: string, bookingId: string) {
    const technician = await this.techniciansService.findOne(technicianId);
    if (!technician.isActive) {
      throw new BadRequestException('Technician is not active');
    }

    const booking = await this.bookingsService.assignTechnician(bookingId, technicianId);

    await this.notificationDispatch.notify(
      technicianId,
      'NEW_JOB',
      'New job assigned',
      `You have been assigned a new service job.`,
      { bookingId },
    );

    return booking;
  }
}
