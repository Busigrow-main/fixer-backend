import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CustomerAppliance,
  CustomerApplianceDocument,
} from './schemas/customer-appliance.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

export type MapApplianceInput = {
  phone: string;
  serialNumber: string;
  brand?: string;
  modelNumber?: string;
  bookingId?: string;
  source?: 'ADMIN' | 'TECHNICIAN' | 'SYSTEM';
};

@Injectable()
export class CustomerAppliancesService {
  constructor(
    @InjectModel(CustomerAppliance.name)
    private readonly applianceModel: Model<CustomerApplianceDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  normalizePhone(raw?: string | null): string {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
    return digits;
  }

  normalizeSerial(raw?: string | null): string | undefined {
    if (!raw) return undefined;
    const s = String(raw).trim().toUpperCase();
    return s || undefined;
  }

  private toPublic(doc: CustomerApplianceDocument | any) {
    const plain =
      typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
      ...plain,
      _id: String(plain._id),
      primaryBookingId: plain.primaryBookingId
        ? String(plain.primaryBookingId)
        : null,
      bookingIds: (plain.bookingIds || []).map((id: any) => String(id)),
      phones: plain.phones || [],
    };
  }

  async findBySerial(serialRaw: string) {
    const serialNumber = this.normalizeSerial(serialRaw);
    if (!serialNumber) {
      throw new BadRequestException('Serial number is required');
    }
    const doc = await this.applianceModel.findOne({ serialNumber }).exec();
    if (!doc) {
      throw new NotFoundException(
        `No appliance mapping found for serial ${serialNumber}`,
      );
    }
    return this.toPublic(doc);
  }

  async findByPhone(phoneRaw: string) {
    const phone = this.normalizePhone(phoneRaw);
    if (!phone || phone.length < 10) {
      throw new BadRequestException('A valid 10-digit phone number is required');
    }
    const docs = await this.applianceModel
      .find({ phones: phone })
      .sort({ updatedAt: -1 })
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async list(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.applianceModel
        .find()
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.applianceModel.countDocuments().exec(),
    ]);
    return {
      data: data.map((d) => this.toPublic(d)),
      total,
      page,
      limit,
    };
  }

  /**
   * Admin search: registrations (bookings + user) for a phone,
   * plus any existing appliance mappings.
   */
  async searchByPhone(phoneRaw: string) {
    const phone = this.normalizePhone(phoneRaw);
    if (!phone || phone.length < 10) {
      throw new BadRequestException('A valid 10-digit phone number is required');
    }

    const phoneVariants = [phone, `+91${phone}`, `91${phone}`];

    const [user, bookings, appliances] = await Promise.all([
      this.userModel.findOne({ phone }).lean().exec(),
      this.bookingModel
        .find({
          $or: [
            { contactPhone: { $in: phoneVariants } },
            { contactPhone: phone },
          ],
        })
        .populate('serviceId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec(),
      this.applianceModel.find({ phones: phone }).sort({ updatedAt: -1 }).exec(),
    ]);

    // Also include bookings where contactPhone ends with the same 10 digits
    const extraBookings = await this.bookingModel
      .find({
        contactPhone: { $regex: `${phone}$` },
      })
      .populate('serviceId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();

    const bookingMap = new Map<string, any>();
    for (const b of [...bookings, ...extraBookings]) {
      bookingMap.set(String((b as any)._id), b);
    }

    return {
      phone,
      user: user
        ? {
            _id: String((user as any)._id),
            phone: (user as any).phone,
            fullName: (user as any).fullName || '',
            email: (user as any).email || '',
          }
        : null,
      bookings: Array.from(bookingMap.values()).map((b: any) => ({
        _id: String(b._id),
        status: b.status,
        contactPhone: b.contactPhone,
        serviceName: b.serviceId?.name || '',
        productDetails: b.productDetails || {},
        createdAt: b.createdAt,
      })),
      appliances: appliances.map((d) => this.toPublic(d)),
    };
  }

  /**
   * Map a serial number onto a phone (and optionally a booking).
   * Creates the appliance record if needed; never removes existing phones.
   */
  async mapSerialToPhone(input: MapApplianceInput) {
    const phone = this.normalizePhone(input.phone);
    const serialNumber = this.normalizeSerial(input.serialNumber);
    const source = input.source || 'ADMIN';

    if (!phone || phone.length < 10) {
      throw new BadRequestException('A valid 10-digit phone number is required');
    }
    if (!serialNumber) {
      throw new BadRequestException('Serial number is required');
    }

    let bookingObjectId: Types.ObjectId | null = null;
    if (input.bookingId) {
      if (!Types.ObjectId.isValid(input.bookingId)) {
        throw new BadRequestException('Invalid bookingId');
      }
      bookingObjectId = new Types.ObjectId(input.bookingId);
      const booking = await this.bookingModel.findById(bookingObjectId).exec();
      if (!booking) throw new NotFoundException('Booking not found');

      // Persist serial onto the booking product details (preserve brand/model if provided)
      const setOps: Record<string, any> = {
        'productDetails.serialNumber': serialNumber,
      };
      if (input.brand !== undefined && input.brand !== '') {
        setOps['productDetails.brand'] = input.brand;
      }
      if (input.modelNumber !== undefined && input.modelNumber !== '') {
        setOps['productDetails.modelNumber'] = input.modelNumber;
      }
      await this.bookingModel
        .findByIdAndUpdate(bookingObjectId, { $set: setOps })
        .exec();
    }

    const existing = await this.applianceModel.findOne({ serialNumber }).exec();

    if (existing) {
      const phones = new Set(existing.phones || []);
      phones.add(phone);
      existing.phones = Array.from(phones);

      if (input.brand) existing.brand = input.brand;
      if (input.modelNumber) existing.modelNumber = input.modelNumber;

      if (bookingObjectId) {
        const ids = new Set(
          (existing.bookingIds || []).map((id) => String(id)),
        );
        ids.add(String(bookingObjectId));
        existing.bookingIds = Array.from(ids).map(
          (id) => new Types.ObjectId(id),
        );
        if (!existing.primaryBookingId) {
          existing.primaryBookingId = bookingObjectId;
        }
      }

      if (!existing.mappedAt) {
        existing.mappedAt = new Date();
        existing.mappedBy = source;
      }

      await existing.save();
      return this.toPublic(existing);
    }

    const created = await this.applianceModel.create({
      serialNumber,
      phones: [phone],
      brand: input.brand || '',
      modelNumber: input.modelNumber || '',
      primaryBookingId: bookingObjectId,
      bookingIds: bookingObjectId ? [bookingObjectId] : [],
      mappedBy: source,
      mappedAt: new Date(),
    });

    return this.toPublic(created);
  }

  /** Associate an additional phone with an existing serial mapping. */
  async addPhoneToSerial(serialRaw: string, phoneRaw: string) {
    const serialNumber = this.normalizeSerial(serialRaw);
    const phone = this.normalizePhone(phoneRaw);

    if (!serialNumber) {
      throw new BadRequestException('Serial number is required');
    }
    if (!phone || phone.length < 10) {
      throw new BadRequestException('A valid 10-digit phone number is required');
    }

    const existing = await this.applianceModel.findOne({ serialNumber }).exec();
    if (!existing) {
      throw new NotFoundException(
        `No appliance mapping found for serial ${serialNumber}`,
      );
    }

    const phones = new Set(existing.phones || []);
    phones.add(phone);
    existing.phones = Array.from(phones);
    await existing.save();

    return this.toPublic(existing);
  }

  /**
   * Called when product details (esp. serial) are saved on a booking.
   * Upserts the appliance mapping without blocking the booking write.
   */
  async syncFromBooking(
    booking: {
      _id: any;
      contactPhone?: string;
      productDetails?: {
        brand?: string;
        modelNumber?: string;
        serialNumber?: string;
      };
    },
    source: 'ADMIN' | 'TECHNICIAN' | 'SYSTEM' = 'SYSTEM',
  ) {
    const serialNumber = this.normalizeSerial(
      booking?.productDetails?.serialNumber,
    );
    const phone = this.normalizePhone(booking?.contactPhone);
    if (!serialNumber || !phone || phone.length < 10) return null;

    try {
      return await this.mapSerialToPhone({
        phone,
        serialNumber,
        brand: booking.productDetails?.brand || '',
        modelNumber: booking.productDetails?.modelNumber || '',
        bookingId: String(booking._id),
        source,
      });
    } catch (err) {
      // Never fail the parent booking write because of mapping sync
      console.error(
        '[CustomerAppliances] syncFromBooking failed:',
        (err as Error)?.message,
      );
      return null;
    }
  }

  /** Link a new booking to appliances already mapped to its contact phone. */
  async linkBookingByPhone(bookingId: string, phoneRaw: string) {
    const phone = this.normalizePhone(phoneRaw);
    if (!phone || phone.length < 10 || !Types.ObjectId.isValid(bookingId)) {
      return [];
    }

    const bookingObjectId = new Types.ObjectId(bookingId);
    const appliances = await this.applianceModel.find({ phones: phone }).exec();
    const updated: any[] = [];

    for (const appliance of appliances) {
      const ids = new Set((appliance.bookingIds || []).map((id) => String(id)));
      if (!ids.has(bookingId)) {
        ids.add(bookingId);
        appliance.bookingIds = Array.from(ids).map(
          (id) => new Types.ObjectId(id),
        );
        await appliance.save();
      }
      updated.push(this.toPublic(appliance));
    }

    // If booking already has a serial, prefer serial-based upsert
    const booking = await this.bookingModel.findById(bookingObjectId).lean().exec();
    if (booking?.productDetails?.serialNumber) {
      const synced = await this.syncFromBooking(booking as any, 'SYSTEM');
      if (synced) return [synced];
    }

    return updated;
  }

  async findForUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) return [];
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user?.phone) return [];
    return this.findByPhone(user.phone);
  }
}
