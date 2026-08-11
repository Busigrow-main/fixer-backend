import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { WarrantiesService } from '../warranties/warranties.service';
import { JobDispatchService } from '../technician-platform/dispatch/job-dispatch.service';
import { NotificationDispatchService } from '../technician-platform/common/notification-dispatch.service';
import { VisitsService } from '../visits/visits.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
    private warrantiesService: WarrantiesService,
    private jobDispatch: JobDispatchService,
    private notificationDispatch: NotificationDispatchService,
    private visitsService: VisitsService,
  ) {}

  /** Full booking detail for admin/customer — always includes populated visits/parts. */
  async populateBookingDetail(id: string): Promise<any> {
    const booking = await this.bookingModel
      .findById(id)
      .populate('userId serviceId technicianId')
      .lean()
      .exec();

    if (!booking) throw new NotFoundException('Booking not found');

    const visits = await this.visitsService.findByBooking(id);
    const visitsPlain = visits.map((v) =>
      typeof (v as any).toObject === 'function' ? (v as any).toObject() : v,
    );

    return {
      ...booking,
      visits: visitsPlain,
    };
  }

  async findAllByUser(userId: string): Promise<Booking[]> {
    return this.bookingModel.find({ userId })
      .populate('userId serviceId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllForAdmin(
    page = 1,
    limit = 20,
    status?: string,
    dispatchStatus?: string,
  ): Promise<{ data: Booking[]; total: number }> {
    const filter: any = {};
    if (status && status !== 'ALL') {
      if (status === 'NEEDS_ASSIGNMENT') {
        filter.dispatchStatus = 'NEEDS_ADMIN';
        filter.technicianId = null;
      } else {
        filter.status = status;
      }
    }
    if (dispatchStatus && dispatchStatus !== 'ALL') {
      filter.dispatchStatus = dispatchStatus;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .populate('userId serviceId technicianId')
        .skip(skip)
        .limit(limit)
        .sort({ adminEscalatedAt: -1, createdAt: -1 })
        .exec(),
      this.bookingModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }

  async countNeedsAdminAssignment(): Promise<number> {
    return this.bookingModel.countDocuments({
      dispatchStatus: 'NEEDS_ADMIN',
      technicianId: null,
    });
  }

  async findOne(id: string): Promise<any> {
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) throw new NotFoundException('Booking not found');

    // Auto-repair invoice totals, then always return fully populated detail
    if (!booking.invoiceData?.serviceTotal || booking.invoiceData.serviceTotal === 0) {
      await this.generateInvoiceData(id, { returnDetail: false });
    }

    return this.populateBookingDetail(id);
  }

  async create(createBookingDto: any, userId: string): Promise<Booking> {
    const createdBooking = new this.bookingModel({
      ...createBookingDto,
      userId,
      dispatchStatus: 'OPEN',
    });
    const savedBooking = await createdBooking.save();

    // Immediately calculate initial price from catalog
    const withInvoice = await this.generateInvoiceData(savedBooking._id.toString());

    // Broadcast to eligible technicians (non-blocking for create success)
    void this.jobDispatch.broadcastJob(savedBooking._id.toString());

    return withInvoice;
  }

  private async lockServiceWarranty(id: string) {
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking?.jobDetails?.warrantyPeriod) return;

    const daysMatch = booking.jobDetails.warrantyPeriod.match(/(\d+)/);
    if (!daysMatch) return;

    const days = parseInt(daysMatch[1], 10);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    await this.bookingModel.findByIdAndUpdate(id, { warrantyExpiry: expiryDate }).exec();

    const existingService = await this.warrantiesService.findByBooking(id);
    if (existingService.some((w) => w.type === 'SERVICE')) return;

    await this.warrantiesService.create({
      bookingId: booking._id,
      warrantyType: 'IN_HOUSE',
      type: 'SERVICE',
      description: `Base Service Warranty (${booking.jobDetails.warrantyPeriod})`,
      startDate: new Date(),
      endDate: expiryDate,
      status: 'ACTIVE',
    });
  }

  async registerWarrantiesOnComplete(id: string) {
    await this.lockServiceWarranty(id);
    await this.warrantiesService.registerPartsForBooking(id);
  }

  async updateStatus(id: string, status: string): Promise<any> {
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(id, { status }, { returnDocument: 'after' }).exec();
    if (!updatedBooking) throw new NotFoundException('Booking not found');
    
    if (status === 'COMPLETED') {
      try {
        await this.generateInvoiceData(id, { returnDetail: false });
        await this.registerWarrantiesOnComplete(id);
      } catch (err) {
        console.error('Invoice/Warranty lock failed:', err);
      }
    }
    
    return this.populateBookingDetail(id);
  }

  async assignTechnician(id: string, technicianId: string): Promise<any> {
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      id,
      {
        technicianId: new Types.ObjectId(technicianId),
        status: 'ASSIGNED',
        assignmentStatus: 'PENDING_ACCEPTANCE',
        assignedAt: new Date(),
        acceptedAt: null,
        declinedAt: null,
        declineReason: null,
        dispatchStatus: 'ADMIN_ASSIGNED',
      },
      { returnDocument: 'after' },
    ).exec();
    if (!updatedBooking) throw new NotFoundException('Booking not found');

    await this.notificationDispatch.notify(
      technicianId,
      'NEW_JOB',
      'New job assigned',
      'You have been assigned a new service job.',
      { bookingId: id },
    );

    return this.populateBookingDetail(id);
  }

  private jobDetailsHasContent(details: Record<string, any> | null | undefined): boolean {
    if (!details) return false;
    return Object.values(details).some(
      (v) => typeof v === 'string' && v.trim().length > 0 && v.trim() !== '60 Days',
    );
  }

  private productDetailsHasContent(details: Record<string, any> | null | undefined): boolean {
    if (!details) return false;
    return Object.values(details).some(
      (v) => typeof v === 'string' && v.trim().length > 0,
    );
  }

  async updateJobDetails(id: string, details: any): Promise<any> {
    const existing = await this.bookingModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Booking not found');

    const incomingEmpty = !this.jobDetailsHasContent(details);
    const existingHasContent = this.jobDetailsHasContent(existing.jobDetails as any);
    if (incomingEmpty && existingHasContent) {
      throw new BadRequestException(
        'Refusing to overwrite job sheet with empty details',
      );
    }

    await this.bookingModel.findByIdAndUpdate(
      id,
      {
        $set: {
          jobDetails: details,
          jobSheetUpdatedAt: new Date(),
          jobSheetUpdatedBy: 'ADMIN',
        },
        $inc: { jobSheetRevision: 1 },
      },
      { returnDocument: 'after' },
    ).exec();

    return this.populateBookingDetail(id);
  }

  async updateProductDetails(id: string, details: any): Promise<any> {
    const existing = await this.bookingModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Booking not found');

    const incomingEmpty = !this.productDetailsHasContent(details);
    const existingHasContent = this.productDetailsHasContent(existing.productDetails as any);
    if (incomingEmpty && existingHasContent) {
      throw new BadRequestException(
        'Refusing to overwrite product details with empty values',
      );
    }

    await this.bookingModel.findByIdAndUpdate(
      id,
      {
        $set: {
          productDetails: details,
          jobSheetUpdatedAt: new Date(),
          jobSheetUpdatedBy: 'ADMIN',
        },
        $inc: { jobSheetRevision: 1 },
      },
    ).exec();
    
    await this.generateInvoiceData(id, { returnDetail: false });
    
    return this.populateBookingDetail(id);
  }

  async updateServiceProperties(id: string, data: { serviceType?: string; paymentStatus?: string }): Promise<any> {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      data,
      { returnDocument: 'after' }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return this.populateBookingDetail(id);
  }

  private parseNumericPrice(price: string | number): number {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    // Extract numeric part from strings like "Starting at ₹249" or "₹1,499.00"
    const cleaned = price.toString().replace(/,/g, '');
    const match = cleaned.match(/(\d+)/);
    return match ? parseFloat(match[1]) : 0;
  }

  async updateInvoiceManual(id: string, data: { serviceTotal?: number; additionalCharges?: any[] }): Promise<any> {
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) throw new NotFoundException('Booking not found');

    const invoiceData = { ...(booking.invoiceData || {}) } as any;
    
    if (data.serviceTotal !== undefined) {
      invoiceData.serviceTotal = data.serviceTotal;
    } else if (invoiceData.serviceTotal === undefined || invoiceData.serviceTotal === 0) {
      const service = await this.serviceModel.findById(booking.serviceId).exec();
      if (service) {
        const subCat = service.subCategories.id(booking.subCategoryId);
        if (subCat) {
          invoiceData.serviceTotal = this.parseNumericPrice(subCat.price);
        }
      }
    }

    if (data.additionalCharges !== undefined) invoiceData.additionalCharges = data.additionalCharges;

    booking.invoiceData = invoiceData as any;
    await booking.save();
    return this.generateInvoiceData(id);
  }

  async finalizeInvoice(id: string): Promise<any> {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      { isBilled: true, status: 'COMPLETED' },
      { returnDocument: 'after' }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');

    try {
      await this.registerWarrantiesOnComplete(id);
    } catch (err) {
      console.error('Warranty registration on finalize failed:', err);
    }
    
    return this.generateInvoiceData(id);
  }

  async addAdminNote(id: string, note: string): Promise<Booking> {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      { $push: { adminNotes: note } },
      { returnDocument: 'after' }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async generateInvoiceData(
    id: string,
    opts: { returnDetail?: boolean } = { returnDetail: true },
  ): Promise<any> {
    const visits = await this.visitsService.findByBooking(id);
    const booking = await this.bookingModel.findById(id).populate('serviceId').exec();
    
    if (!booking) throw new NotFoundException('Booking not found');
    
    let partsTotal = 0;
    const sparePartsSummary: { partName: string, quantity: number, cost: number, isThirdParty: boolean }[] = [];
    let serviceTotal = booking.invoiceData?.serviceTotal;

    const additionalCharges = booking.invoiceData?.additionalCharges || [];

    if (serviceTotal === undefined || serviceTotal === 0) {
      if (booking.serviceType === 'WARRANTY_CHECK') {
        serviceTotal = 0;
      } else {
        const service = await this.serviceModel.findById(booking.serviceId).exec();
        if (service) {
          const subCat = service.subCategories.id(booking.subCategoryId);
          if (subCat && subCat.price) {
            serviceTotal = this.parseNumericPrice(subCat.price);
          }
          
          if (!serviceTotal && service.startingPrice) {
            serviceTotal = this.parseNumericPrice(service.startingPrice);
          }
        }
      }
    }
    if (serviceTotal === undefined) serviceTotal = 0;

    for (const visit of visits as any[]) {
      if (!visit.partsUsed) continue;
      for (const usage of visit.partsUsed) {
        let partName = "";
        let cost = 0;
        const quantity = usage.quantity || 1;

        if (usage.isThirdParty) {
          partName = usage.partName || "Generic Part";
          cost = usage.cost || 0;
          partsTotal += cost * quantity;
        } else if (usage.sparePartId) {
          partName = usage.partName || usage.sparePartId.name || "Spare Part";
          const catalogPaise = this.parseNumericPrice(usage.sparePartId.price);
          const catalogRupees = Math.round((catalogPaise / 100) * 100) / 100;
          const stored = usage.cost != null ? Number(usage.cost) : null;
          cost =
            stored != null && stored !== catalogPaise
              ? stored
              : catalogRupees;
          partsTotal += cost * quantity;
        }

        sparePartsSummary.push({
          partName,
          quantity,
          cost,
          isThirdParty: !!usage.isThirdParty
        });
      }
    }

    const additionalTotal = additionalCharges.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
    const totalAmount = (serviceTotal || 0) + partsTotal + additionalTotal;

    await this.bookingModel.findByIdAndUpdate(
      id,
      {
        $set: {
          'invoiceData.generatedAt': new Date(),
          'invoiceData.partsTotal': partsTotal,
          'invoiceData.serviceTotal': serviceTotal,
          'invoiceData.additionalCharges': additionalCharges,
          'invoiceData.spareParts': sparePartsSummary,
          'invoiceData.totalAmount': totalAmount,
          'invoiceData.url': `/api/v1/user/bookings/${id}/invoice`
        }
      },
    ).exec();

    if (opts.returnDetail === false) {
      return this.bookingModel.findById(id).exec() as any;
    }

    return this.populateBookingDetail(id);
  }

  async claimWarranty(id: string): Promise<any> {
    const originalBooking = await this.bookingModel.findById(id).exec();
    if (!originalBooking) throw new NotFoundException('Booking not found');

    if (originalBooking.status !== 'COMPLETED') {
      throw new BadRequestException('Warranty can only be claimed for completed services');
    }

    if (!originalBooking.warrantyExpiry || new Date() > originalBooking.warrantyExpiry) {
      throw new BadRequestException('Warranty has expired or is not applicable');
    }

    if (originalBooking.claimBookingIds && originalBooking.claimBookingIds.length > 0) {
      throw new BadRequestException('A warranty claim has already been initiated for this booking.');
    }

    const claimBooking = new this.bookingModel({
      userId: originalBooking.userId,
      serviceId: originalBooking.serviceId,
      subCategoryId: originalBooking.subCategoryId,
      contactPhone: originalBooking.contactPhone,
      addressData: originalBooking.addressData,
      description: `WARRANTY CLAIM for Booking #${id.slice(-6).toUpperCase()}. Original Issue: ${originalBooking.description}`,
      status: 'PENDING',
      serviceType: 'WARRANTY_CHECK',
      paymentStatus: 'WARRANTY_SERVICE',
      parentId: originalBooking._id,
      productDetails: originalBooking.productDetails
    });

    const saved = await claimBooking.save();

    await this.bookingModel.findByIdAndUpdate(id, {
      $push: { claimBookingIds: saved._id }
    }).exec();

    return this.findOne(saved._id.toString());
  }

  async countByStatus(): Promise<Record<string, number>> {
    const results = await this.bookingModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).exec();

    const counts: Record<string, number> = {};
    results.forEach((r: any) => { counts[r._id] = r.count; });
    return counts;
  }

  async countAll(): Promise<number> {
    return this.bookingModel.countDocuments().exec();
  }
}
