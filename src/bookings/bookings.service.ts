import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { WarrantiesService } from '../warranties/warranties.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
    private warrantiesService: WarrantiesService,
  ) {}

  async findAllByUser(userId: string): Promise<Booking[]> {
    return this.bookingModel.find({ userId })
      .populate('userId serviceId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllForAdmin(page = 1, limit = 20, status?: string): Promise<{ data: Booking[]; total: number }> {
    const filter: any = {};
    if (status && status !== 'ALL') filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.bookingModel.find(filter).populate('userId serviceId').skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
      this.bookingModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingModel.findById(id)
      .populate('userId serviceId technicianId')
      .populate({
        path: 'visits',
        populate: {
          path: 'partsUsed',
          populate: 'sparePartId'
        }
      })
      .exec();
    
    if (!booking) throw new NotFoundException('Booking not found');

    // Auto-repair: If serviceTotal is 0 or missing, trigger an auto-fetch from catalog
    if (!booking.invoiceData?.serviceTotal || booking.invoiceData.serviceTotal === 0) {
      return this.generateInvoiceData(id);
    }

    return booking;
  }

  async create(createBookingDto: any, userId: string): Promise<Booking> {
    const createdBooking = new this.bookingModel({ ...createBookingDto, userId });
    const savedBooking = await createdBooking.save();
    
    // Immediately calculate initial price from catalog
    return this.generateInvoiceData(savedBooking._id.toString());
  }

  async updateStatus(id: string, status: string): Promise<Booking> {
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(id, { status }, { returnDocument: 'after' }).exec();
    if (!updatedBooking) throw new NotFoundException('Booking not found');
    
    // Automatically generate the invoice and lock warranty when completed
    if (status === 'COMPLETED') {
      try {
        await this.generateInvoiceData(id);
        
        // Calculate Warranty Expiry
        const booking = await this.bookingModel.findById(id).exec();
        if (booking && booking.jobDetails?.warrantyPeriod) {
          const daysMatch = booking.jobDetails.warrantyPeriod.match(/(\d+)/);
          if (daysMatch) {
            const days = parseInt(daysMatch[1]);
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + days);
            await this.bookingModel.findByIdAndUpdate(id, { warrantyExpiry: expiryDate }).exec();

            // LOG IN WARRANTIES FOLDER (Collection)
            try {
              await this.warrantiesService.create({
                bookingId: booking._id,
                warrantyType: 'IN_HOUSE',
                type: 'SERVICE',
                description: `Base Service Warranty (${booking.jobDetails.warrantyPeriod})`,
                startDate: new Date(),
                endDate: expiryDate,
                status: 'ACTIVE'
              });
            } catch (wErr) {
              console.error('Warranty collection log failed:', wErr);
            }
          }
        }
      } catch (err) {
        console.error('Invoice/Warranty lock failed:', err);
      }
    }
    
    return this.bookingModel.findById(id).populate('userId serviceId technicianId').exec() as any;
  }

  async assignTechnician(id: string, technicianId: string): Promise<Booking> {
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      id,
      { technicianId, status: 'ASSIGNED' },
      { returnDocument: 'after' }
    ).exec();
    if (!updatedBooking) throw new NotFoundException('Booking not found');
    return this.bookingModel.findById(id).populate('userId serviceId technicianId').exec() as any;
  }

  async updateJobDetails(id: string, details: any): Promise<Booking> {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id, 
      { jobDetails: details },
      { returnDocument: 'after' }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return this.bookingModel.findById(id).populate('userId serviceId technicianId').exec() as any;
  }

  async updateProductDetails(id: string, details: any): Promise<Booking> {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      { productDetails: details },
      { returnDocument: 'after' }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    
    // Auto-generate invoice data to ensure serviceTotal is populated from subcategory
    await this.generateInvoiceData(id);
    
    return this.bookingModel.findById(id).populate('userId serviceId technicianId').exec() as any;
  }

  async updateServiceProperties(id: string, data: { serviceType?: string; paymentStatus?: string }): Promise<Booking> {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      data,
      { returnDocument: 'after' }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return this.bookingModel.findById(id).populate('userId serviceId technicianId').exec() as any;
  }

  private parseNumericPrice(price: string | number): number {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    // Extract numeric part from strings like "Starting at ₹249" or "₹1,499.00"
    const cleaned = price.toString().replace(/,/g, '');
    const match = cleaned.match(/(\d+)/);
    return match ? parseFloat(match[1]) : 0;
  }

  async updateInvoiceManual(id: string, data: { serviceTotal?: number; additionalCharges?: any[] }): Promise<Booking> {
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) throw new NotFoundException('Booking not found');

    const invoiceData = { ...(booking.invoiceData || {}) };
    
    // If serviceTotal is provided, use it. Otherwise, if missing, try to fetch from subcategory.
    if (data.serviceTotal !== undefined) {
      invoiceData.serviceTotal = data.serviceTotal;
    } else if (invoiceData.serviceTotal === undefined || invoiceData.serviceTotal === 0) {
      // Fallback to auto-generation for service charge
      const service = await this.serviceModel.findById(booking.serviceId).exec();
      if (service) {
        const subCat = service.subCategories.id(booking.subCategoryId);
        if (subCat) {
          invoiceData.serviceTotal = this.parseNumericPrice(subCat.price);
        }
      }
    }

    if (data.additionalCharges !== undefined) invoiceData.additionalCharges = data.additionalCharges;

    // Persist immediately and return updated doc via generateInvoiceData sync
    booking.invoiceData = invoiceData as any;
    await booking.save();
    return this.generateInvoiceData(id);
  }

  async finalizeInvoice(id: string): Promise<Booking> {
    // Sync logic: update status and trigger final recalc
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      { isBilled: true, status: 'COMPLETED' },
      { returnDocument: 'after' }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    
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

  async generateInvoiceData(id: string): Promise<Booking> {
    const booking = await this.bookingModel.findById(id)
      .populate('serviceId')
      .populate({
        path: 'visits',
        populate: {
          path: 'partsUsed',
          populate: 'sparePartId'
        }
      })
      .exec();
    
    if (!booking) throw new NotFoundException('Booking not found');
    
    let partsTotal = 0;
    const sparePartsSummary: { partName: string, quantity: number, cost: number, isThirdParty: boolean }[] = [];
    let serviceTotal = booking.invoiceData?.serviceTotal;

    // Preserve existing additional charges
    const additionalCharges = booking.invoiceData?.additionalCharges || [];

    // Default price logic with two-tier fallback
    if (serviceTotal === undefined || serviceTotal === 0) {
      if (booking.serviceType === 'WARRANTY_CHECK') {
        serviceTotal = 0; // Warranty claims have zero base service charge
      } else {
        const service = await this.serviceModel.findById(booking.serviceId).exec();
        if (service) {
          // Tier 1: Specific Sub-category price
          const subCat = service.subCategories.id(booking.subCategoryId);
          if (subCat && subCat.price) {
            serviceTotal = this.parseNumericPrice(subCat.price);
          }
          
          // Tier 2: General Service Starting Price (if Tier 1 failed or is 0)
          if (!serviceTotal && service.startingPrice) {
            serviceTotal = this.parseNumericPrice(service.startingPrice);
          }
        }
      }
    }
    if (serviceTotal === undefined) serviceTotal = 0;

    // Parts Calculation
    if (booking.visits && booking.visits.length > 0) {
      for (const visit of booking.visits as any[]) {
        if (visit.partsUsed) {
          for (const usage of visit.partsUsed) {
            let partName = "";
            let cost = 0;
            const quantity = usage.quantity || 1;

            if (usage.isThirdParty) {
              partName = usage.partName || "Generic Part";
              cost = usage.cost || 0;
              partsTotal += cost * quantity;
            } else if (usage.sparePartId) {
              partName = usage.sparePartId.name || "Spare Part";
              cost = this.parseNumericPrice(usage.sparePartId.price);
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
      }
    }

    const additionalTotal = additionalCharges.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
    const totalAmount = (serviceTotal || 0) + partsTotal + additionalTotal;

    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
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
      { returnDocument: 'after' }
    ).exec();

    return this.bookingModel.findById(id).populate('userId serviceId technicianId').exec() as any;
  }

  async claimWarranty(id: string): Promise<Booking> {
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

    // Create a new booking for the warranty check
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

    // Update original booking to include this claim ID
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
