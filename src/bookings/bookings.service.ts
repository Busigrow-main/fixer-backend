import { Booking, BookingDocument } from './schemas/booking.schema';
import { Service, ServiceDocument } from '../services/schemas/service.schema';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
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
          populate: 'sparePartId' // Assuming you want deep population of the actual spare part docs
        }
      })
      .exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async create(createBookingDto: any, userId: string): Promise<Booking> {
    const createdBooking = new this.bookingModel({ ...createBookingDto, userId });
    return createdBooking.save();
  }

  async updateStatus(id: string, status: string): Promise<Booking> {
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(id, { status }, { returnDocument: 'after' }).exec();
    if (!updatedBooking) throw new NotFoundException('Booking not found');
    
    // Automatically generate the invoice when completed
    if (status === 'COMPLETED') {
      try {
        await this.generateInvoiceData(id);
      } catch (err) {
        console.error("Failed to generate invoice automatically", err);
      }
    }
    
    return updatedBooking;
  }

  async assignTechnician(id: string, technicianId: string): Promise<Booking> {
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      id,
      { technicianId, status: 'ASSIGNED' },
      { returnDocument: 'after' }
    ).exec();
    if (!updatedBooking) throw new NotFoundException('Booking not found');
    return updatedBooking;
  }

  async updateJobDetails(id: string, details: any): Promise<Booking> {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id, 
      { jobDetails: details },
      { returnDocument: 'after' }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
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
    
    return this.bookingModel.findById(id).populate('userId serviceId technicianId').exec();
  }

  async updateServiceProperties(id: string, data: { serviceType?: string; paymentStatus?: string }): Promise<Booking> {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      data,
      { returnDocument: 'after' }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private parseNumericPrice(price: string | number): number {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    // Better regex to extract the numeric part from strings like "Starting at ₹249"
    const match = price.toString().match(/(\d+)/);
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
    let serviceTotal = booking.invoiceData?.serviceTotal;

    // Preserve existing additional charges
    const additionalCharges = booking.invoiceData?.additionalCharges || [];

    // Default price logic
    if (serviceTotal === undefined || serviceTotal === 0) {
      const service = await this.serviceModel.findById(booking.serviceId).exec();
      if (service) {
        const subCat = service.subCategories.id(booking.subCategoryId);
        if (subCat) {
          serviceTotal = this.parseNumericPrice(subCat.price);
        }
      }
    }
    if (serviceTotal === undefined) serviceTotal = 0;

    // Parts Calculation
    if (booking.visits && booking.visits.length > 0) {
      for (const visit of booking.visits as any[]) {
        if (visit.partsUsed) {
          for (const usage of visit.partsUsed) {
            if (usage.isThirdParty) {
              partsTotal += (usage.cost || 0) * (usage.quantity || 1);
            } else if (usage.sparePartId) {
              partsTotal += this.parseNumericPrice(usage.sparePartId.price) * (usage.quantity || 1);
            }
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
          'invoiceData.totalAmount': totalAmount,
          'invoiceData.url': `/api/v1/user/bookings/${id}/invoice`
        }
      },
      { returnDocument: 'after' }
    ).exec();

    return updatedBooking as Booking;
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
