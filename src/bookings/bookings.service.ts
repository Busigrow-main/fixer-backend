import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import {
  Technician,
  TechnicianDocument,
} from '../technicians/schemas/technician.schema';
import { WarrantiesService } from '../warranties/warranties.service';
import { JobDispatchService } from '../technician-platform/dispatch/job-dispatch.service';
import { NotificationDispatchService } from '../technician-platform/common/notification-dispatch.service';
import { VisitsService } from '../visits/visits.service';
import {
  collectPartsFromVisits,
  computeTechnicianSettlement,
} from '../technician-platform/settlement';
import { CustomerAppliancesService } from '../customer-appliances/customer-appliances.service';
import {
  buildCustomerPricingSummary,
  getCustomerStatusView,
  pickUpcomingVisitSchedule,
  resolveExpectedArrival,
  resolveFrozenEstimatedAmount,
  sanitizeTechnicianForCustomer,
  statusRequiresTechnician,
} from './customer-booking.helpers';
import { ServiceablePincodesService } from '../serviceable-pincodes/serviceable-pincodes.service';
import { BillEmailService } from './bill-email.service';
import {
  decryptFixxerCode,
  fixxerCodesMatch,
  issueFixxerCode,
  stripFixxerCodeSecrets,
} from './fixxer-code';
import { buildJobSheetDefaults, partsFromVisits } from './job-sheet-defaults';
import { TechnicianEngineService } from '../technician-engine/technician-engine.service';
import {
  assertAssignableTechnician,
  assertBookingAssignable,
  TechnicianEngineError,
} from '../technician-engine/technician-engine';
import { assertValidCalendarDate } from '../common/calendar-date';
import { GstService } from '../gst/gst.service';
import {
  FIXXER_SERVICE_GST_PERCENT,
  fixxerServiceSac,
} from '../gst/gst.types';

const BOOKING_LEAD_TIME_MINUTES = 2 * 60;
const SLOT_END_MINUTES: Record<string, number> = {
  MORNING: 12 * 60,
  AFTERNOON: 16 * 60,
  EVENING: 20 * 60,
};

function getServiceNow() {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(new Date())
    .reduce<Record<string, number>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = Number(part.value);
      return result;
    }, {});

  return {
    date: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    minutes: parts.hour * 60 + parts.minute,
  };
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name)
    private bookingModel: Model<BookingDocument>,
    @InjectModel(Service.name)
    private serviceModel: Model<ServiceDocument>,
    @InjectModel(Technician.name)
    private technicianModel: Model<TechnicianDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private warrantiesService: WarrantiesService,
    private jobDispatch: JobDispatchService,
    private notificationDispatch: NotificationDispatchService,
    private visitsService: VisitsService,
    private customerAppliancesService: CustomerAppliancesService,
    private serviceablePincodesService: ServiceablePincodesService,
    private gstService: GstService,
    @Optional() private billEmail?: BillEmailService,
    @Optional() private technicianEngine?: TechnicianEngineService,
  ) {}

  /** Save the booking contact number on a Google account that has no phone yet. */
  private async attachBookingPhoneToUser(
    userId: string,
    contactPhone: unknown,
  ) {
    const digits = String(contactPhone || '').replace(/\D/g, '');
    const phone = digits.length >= 10 ? digits.slice(-10) : '';
    if (!phone) return;

    const user = await this.userModel.findById(userId).exec();
    if (!user || user.phone) return;

    const taken = await this.userModel
      .findOne({ phone, _id: { $ne: user._id } })
      .exec();
    if (taken) return;

    user.phone = phone;
    await user.save();
  }

  private findSubCategoryById(
    service: ServiceDocument | Service | any,
    subCategoryId: unknown,
  ) {
    if (!service?.subCategories || !subCategoryId) return null;

    const target = String(subCategoryId);

    return (
      service.subCategories.find(
        (sc: any) => String(sc?._id) === target,
      ) || null
    );
  }

  /**
   * Resolve technician for customer payloads. Handles:
   * - populated docs
   * - legacy string technicianId (populate fails)
   * - bare ObjectId left after failed populate
   */
  private async resolveTechnicianForCustomer(
    technicianField: unknown,
  ): Promise<{ _id: string; name: string; phone?: string } | null> {
    const populated = sanitizeTechnicianForCustomer(
      technicianField && typeof technicianField === 'object'
        ? (technicianField as Record<string, any>)
        : null,
    );

    if (populated) return populated;

    const rawId =
      typeof technicianField === 'string'
        ? technicianField
        : technicianField &&
            typeof technicianField === 'object' &&
            ((technicianField as any)._id ||
              (technicianField as any).id ||
              technicianField)
          ? String(
              (technicianField as any)._id ||
                (technicianField as any).id ||
                technicianField,
            )
          : null;

    if (
      !rawId ||
      !Types.ObjectId.isValid(rawId) ||
      String(rawId).length !== 24
    ) {
      return null;
    }

    const tech = await this.technicianModel
      .findById(rawId)
      .select('name phone')
      .lean()
      .exec();

    return sanitizeTechnicianForCustomer(tech as any);
  }

  /** Full booking detail for admin/customer — always includes populated visits/parts. */
  /**
   * ASSIGNED / EN_ROUTE / IN_PROGRESS without technicianId is corrupt.
   * Heal to CONFIRMED so admin filters and customer copy stay honest.
   * Must run on the raw ObjectId ref — populate() turns missing techs into null
   * and would otherwise demote valid in-progress jobs.
   */
  private async reconcileAssignmentInvariant(
    booking: { _id?: any; status?: string; technicianId?: any },
  ): Promise<void> {
    if (!booking?._id) return;
    if (!statusRequiresTechnician(booking.status)) return;
    if (booking.technicianId) return;
    await this.bookingModel
      .updateOne({ _id: booking._id }, { $set: { status: 'CONFIRMED' } })
      .exec();
    booking.status = 'CONFIRMED';
  }

  async populateBookingDetail(id: string): Promise<any> {
    // Reconcile against the unpopulated ref before populate() nulls missing techs.
    const raw = await this.bookingModel
      .findById(id)
      .select('status technicianId')
      .lean()
      .exec();
    if (!raw) {
      throw new NotFoundException('Booking not found');
    }
    await this.reconcileAssignmentInvariant(raw as any);

    const booking = await this.bookingModel
      .findById(id)
      .populate('userId serviceId technicianId')
      .lean()
      .exec();

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const visits = await this.visitsService.findByBooking(id);

    const visitsPlain = visits.map((v) =>
      typeof (v as any).toObject === 'function'
        ? (v as any).toObject()
        : v,
    );

    const technicianSettlement = computeTechnicianSettlement({
      serviceTotal: (booking as any).invoiceData?.serviceTotal || 0,
      additionalCharges:
        (booking as any).invoiceData?.additionalCharges || [],
      parts: collectPartsFromVisits(visitsPlain),
    });

    const installedParts =
      await this.warrantiesService.listInstalledParts(id);

    const parentId = (booking as any).parentId
      ? String((booking as any).parentId)
      : null;

    const originalParts =
      await this.warrantiesService.listOriginalPartsForClaim(parentId);

    const sheetPatch = buildJobSheetDefaults({
      bookingId: id,
      createdAt: (booking as any).createdAt,
      serviceType: (booking as any).serviceType,
      jobDetails: (booking as any).jobDetails,
      parts: partsFromVisits(visitsPlain),
    });
    if (Object.keys(sheetPatch).length) {
      await this.bookingModel.findByIdAndUpdate(id, {
        $set: Object.fromEntries(
          Object.entries(sheetPatch).map(([key, value]) => [`jobDetails.${key}`, value]),
        ),
      });
      (booking as any).jobDetails = {
        ...((booking as any).jobDetails || {}),
        ...sheetPatch,
      };
    }

    return stripFixxerCodeSecrets({
      ...booking,
      visits: visitsPlain,
      technicianSettlement,
      installedParts,
      originalParts,
      isWarrantyClaim:
        (booking as any).serviceType === 'WARRANTY_CHECK' ||
        !!parentId,
    });
  }

  async findAllByUser(userId: string): Promise<any[]> {
    // Production data historically stores userId as a plain string even though the
    // schema declares ObjectId. Match both shapes so bookings always surface.
    const userFilter =
      Types.ObjectId.isValid(userId) &&
      String(userId).length === 24
        ? {
            $or: [
              { userId: new Types.ObjectId(userId) },
              { userId: String(userId) },
            ],
          }
        : { userId: String(userId) };

    // Reconcile on raw refs first — populate() nulls missing technician docs.
    const rawBookings = await this.bookingModel
      .find(userFilter)
      .select('_id status technicianId')
      .lean()
      .exec();
    for (const raw of rawBookings as any[]) {
      await this.reconcileAssignmentInvariant(raw);
    }

    const bookings = await this.bookingModel
      .find(userFilter)
      .populate('userId serviceId technicianId')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const results: any[] = [];

    for (const booking of bookings as any[]) {
      const bookingId = String(booking._id);

      const installedParts =
        await this.warrantiesService.listInstalledParts(
          bookingId,
        );

      const parentId = booking.parentId
        ? String(booking.parentId)
        : null;

      const originalParts =
        await this.warrantiesService.listOriginalPartsForClaim(
          parentId,
        );

      const isWarrantyClaim =
        booking.serviceType === 'WARRANTY_CHECK' ||
        !!parentId;

      const visitsRaw =
        await this.visitsService.findByBooking(bookingId);

      const visitsPlain = visitsRaw.map((v) =>
        typeof (v as any).toObject === 'function'
          ? (v as any).toObject()
          : v,
      );

      await this.syncInvoicePartsFromVisits(booking, visitsPlain);

      const upcomingVisit =
        pickUpcomingVisitSchedule(visitsPlain);

      const schedule = resolveExpectedArrival(
        booking,
        upcomingVisit,
      );

      const technician =
        await this.resolveTechnicianForCustomer(
          booking.technicianId,
        );

      const hasTechnicianAssigned = !!(
        technician ||
        booking.technicianId
      );

      const statusView = getCustomerStatusView(
        booking.status,
        {
          isWarrantyClaim,
          arrivalAt: booking.arrivalAt,
          hasTechnicianAssigned,
        },
      );

      const pricing =
        buildCustomerPricingSummary(booking);

      const row = stripFixxerCodeSecrets({
        ...booking,
        // Keep raw id for debugging; customer UI should prefer `technician`.
        technicianId:
          technician ||
          booking.technicianId ||
          null,
        technician,
        hasTechnicianAssigned,
        installedParts,
        originalParts,
        isWarrantyClaim,
        upcomingVisit,
        schedule,
        statusView,
        pricing,
        visits: visitsPlain.map((v: any) => ({
          _id: v._id,
          visitOrder: v.visitOrder,
          scheduledDate: v.scheduledDate,
          status: v.status,
        })),
      });
      const jobFinished = booking.status === 'COMPLETED' || booking.jobClosed;
      if (!jobFinished) {
        const code = decryptFixxerCode(booking);
        if (code) row.fixxerCode = code;
      }
      results.push(row);
    }

    return results;
  }

  private async syncInvoicePartsFromVisits(booking: any, _visits: any[]) {
    // Rebuild invoice (parts + exclusive GST on top) via the shared generator.
    await this.generateInvoiceData(String(booking._id), { returnDetail: false });
  }

  async findAllForAdmin(
    page = 1,
    limit = 20,
    status?: string,
    dispatchStatus?: string,
    cancelledBy?: 'CUSTOMER' | 'ADMIN',
    search?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<{ data: Booking[]; total: number }> {
    const filter: any = {};

    if (status && status !== 'ALL') {
      if (status === 'NEEDS_ASSIGNMENT') {
        filter.dispatchStatus = 'NEEDS_ADMIN';
        filter.technicianId = null;
        filter.status = { $ne: 'CANCELLED' };
      } else {
        filter.status = status;
      }
    }

    if (
      dispatchStatus &&
      dispatchStatus !== 'ALL'
    ) {
      filter.dispatchStatus = dispatchStatus;
    }

    if (cancelledBy) {
      filter.cancelledBy = cancelledBy;
    }

    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch) {
      const escapedSearch = trimmedSearch.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      const searchRegex = new RegExp(escapedSearch, 'i');
      const matchingUsers = await this.userModel
        .find({
          $or: [
            { phone: searchRegex },
            { fullName: searchRegex },
          ],
        })
        .select('_id')
        .lean()
        .exec();

      const searchConditions: any[] = [
        { contactPhone: searchRegex },
        { userId: { $in: matchingUsers.map((user) => user._id) } },
        { 'productDetails.serialNumber': searchRegex },
        { 'invoiceData.spareParts.serialNumber': searchRegex },
        { 'jobDetails.invoiceNumber': searchRegex },
      ];

      if (Types.ObjectId.isValid(trimmedSearch)) {
        searchConditions.push({
          _id: new Types.ObjectId(trimmedSearch),
        });
      }

      filter.$or = searchConditions;
    }

    if (fromDate || toDate) {
      const createdAt: Record<string, Date> = {};

      if (fromDate) {
        const start = new Date(`${fromDate}T00:00:00.000Z`);
        if (Number.isNaN(start.getTime())) {
          throw new BadRequestException('Invalid fromDate');
        }
        createdAt.$gte = start;
      }

      if (toDate) {
        const end = new Date(`${toDate}T23:59:59.999Z`);
        if (Number.isNaN(end.getTime())) {
          throw new BadRequestException('Invalid toDate');
        }
        createdAt.$lte = end;
      }

      filter.createdAt = createdAt;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .populate('userId serviceId technicianId')
        .skip(skip)
        .limit(limit)
        .sort({
          createdAt: -1,
          adminEscalatedAt: -1,
        })
        .exec(),

      this.bookingModel
        .countDocuments(filter)
        .exec(),
    ]);

    return { data, total };
  }

  async countNeedsAdminAssignment(): Promise<number> {
    return this.bookingModel
      .countDocuments({
        dispatchStatus: 'NEEDS_ADMIN',
        technicianId: null,
        status: { $ne: 'CANCELLED' },
      })
      .exec();
  }

  async findOne(id: string): Promise<any> {
    const booking =
      await this.bookingModel.findById(id).exec();

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    // Always rebuild parts and totals from visits. A manual service fee is kept.
    try {
      await this.generateInvoiceData(id, {
        returnDetail: false,
      });
    } catch (err) {
      console.error(
        '[findOne] generateInvoiceData failed:',
        err?.message,
      );
    }

    return this.populateBookingDetail(id);
  }

  async create(
    createBookingDto: any,
    userId: string,
  ): Promise<Booking> {
    console.log(
      'BOOKING ADDRESS DATA:',
      createBookingDto.addressData,
    );

    const pincode = String(
      createBookingDto.addressData?.zip || '',
    ).trim();

    console.log(
      'BOOKING PINCODE:',
      pincode,
    );

    if (!/^\d{6}$/.test(pincode)) {
      throw new BadRequestException(
        'Please enter a valid 6-digit pincode',
      );
    }

    const isServiceable =
      await this.serviceablePincodesService.isServiceable(
        pincode,
      );

    if (!isServiceable) {
      throw new BadRequestException(
        'Sorry, Fixxer is  not fixing in this area.',
      );
    }

    const preferredVisitDate = createBookingDto.preferredVisitDate;
    const preferredVisitSlot = createBookingDto.preferredVisitSlot;
    if (preferredVisitDate) {
      assertValidCalendarDate(preferredVisitDate, 'preferredVisitDate');
    }
    if (
      preferredVisitSlot &&
      !Object.prototype.hasOwnProperty.call(SLOT_END_MINUTES, preferredVisitSlot)
    ) {
      throw new BadRequestException('Please select a valid visit window.');
    }
    const serviceNow = getServiceNow();
    if (preferredVisitDate && preferredVisitDate < serviceNow.date) {
      throw new BadRequestException('Please select today or a future visit date.');
    }
    if (
      preferredVisitDate === serviceNow.date &&
      preferredVisitSlot &&
      SLOT_END_MINUTES[preferredVisitSlot] <=
        serviceNow.minutes + BOOKING_LEAD_TIME_MINUTES
    ) {
      throw new BadRequestException(
        'That visit window has ended. Please choose another time.',
      );
    }

    if (createBookingDto.serviceId) {
      const service =
        await this.serviceModel
          .findById(createBookingDto.serviceId)
          .exec();

      if (!service) {
        throw new BadRequestException(
          'Service not found',
        );
      }

      if (createBookingDto.subCategoryId) {
        const subCat =
          this.findSubCategoryById(
            service,
            createBookingDto.subCategoryId,
          );

        if (!subCat) {
          throw new BadRequestException(
            `subCategoryId ${createBookingDto.subCategoryId} does not exist in service ${service.slug}`,
          );
        }
      }
    }

    const createdBooking =
      new this.bookingModel({
        ...createBookingDto,

        // Normalize so new rows are ObjectIds; findAllByUser still accepts legacy strings.
        userId: Types.ObjectId.isValid(userId)
          ? new Types.ObjectId(userId)
          : userId,

        dispatchStatus: 'OPEN',
      });

    const savedBooking =
      await createdBooking.save();

    await this.attachBookingPhoneToUser(
      userId,
      createBookingDto.contactPhone,
    );

    const withInvoice =
      await this.generateInvoiceData(
        savedBooking._id.toString(),
      );

    void this.jobDispatch.broadcastJob(
      savedBooking._id.toString(),
    );

    // Link to existing serial mappings for this phone (non-blocking)
    void this.customerAppliancesService.linkBookingByPhone(
      savedBooking._id.toString(),
      savedBooking.contactPhone,
    );

    return withInvoice;
  }

  async cancelBooking(
    id: string,
    userId: string,
    reason: string,
  ): Promise<any> {
    const userFilter =
      Types.ObjectId.isValid(userId) &&
      String(userId).length === 24
        ? {
            $or: [
              {
                userId: new Types.ObjectId(userId),
              },
              {
                userId: String(userId),
              },
            ],
          }
        : { userId: String(userId) };

    const booking =
      await this.bookingModel
        .findOne({
          _id: id,
          ...userFilter,
        })
        .exec();

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException(
        'Booking is already cancelled',
      );
    }

    const nonCancellableStatuses = [
      'IN_PROGRESS',
      'COMPLETED',
      'PAYMENT_COLLECTED',
    ];

    if (
      nonCancellableStatuses.includes(
        booking.status,
      )
    ) {
      throw new BadRequestException(
        'This booking can no longer be cancelled',
      );
    }

    const trimmedReason =
      String(reason || '').trim();

    if (!trimmedReason) {
      throw new BadRequestException(
        'Cancellation reason is required',
      );
    }

    if (trimmedReason.length > 500) {
      throw new BadRequestException(
        'Cancellation reason cannot exceed 500 characters',
      );
    }

    booking.status = 'CANCELLED';
    booking.dispatchStatus = 'EXPIRED';

    // Store customer cancellation details
    booking.cancellationReason =
      trimmedReason;
    booking.cancelledAt = new Date();
    booking.cancelledBy = 'CUSTOMER';

    await booking.save();

    return this.populateBookingDetail(id);
  }

  private async lockServiceWarranty(
    id: string,
  ) {
    const booking =
      await this.bookingModel
        .findById(id)
        .exec();

    if (!booking) return;

    if (booking.warrantyExpiry) {
      const existingService =
        await this.warrantiesService.findByBooking(
          id,
        );

      if (
        existingService.some(
          (w) => w.type === 'SERVICE',
        )
      ) {
        return;
      }
    }

    const period =
      booking.jobDetails?.warrantyPeriod ||
      '60 Days';

    const daysMatch =
      String(period).match(/(\d+)/);

    const days = daysMatch
      ? parseInt(daysMatch[1], 10)
      : 60;

    const expiryDate = new Date();

    expiryDate.setDate(
      expiryDate.getDate() + days,
    );

    await this.bookingModel
      .findByIdAndUpdate(id, {
        warrantyExpiry: expiryDate,
      })
      .exec();

    const existingService =
      await this.warrantiesService.findByBooking(
        id,
      );

    if (
      existingService.some(
        (w) => w.type === 'SERVICE',
      )
    ) {
      return;
    }

    await this.warrantiesService.create({
      bookingId: booking._id,
      warrantyType: 'IN_HOUSE',
      type: 'SERVICE',
      description: `Base Service Warranty (${period})`,
      startDate: new Date(),
      endDate: expiryDate,
      status: 'ACTIVE',
    });
  }

  async registerWarrantiesOnComplete(
    id: string,
  ) {
    await this.lockServiceWarranty(id);
    await this.warrantiesService.registerPartsForBooking(
      id,
    );
  }

  async requireFixxerCode(id: string, submitted?: string): Promise<void> {
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.fixxerCodeVerifiedAt) return;
    if (!booking.technicianId) {
      throw new BadRequestException('Assign a technician before closing this job');
    }
    if (!booking.fixxerCodeCiphertext) {
      throw new BadRequestException('FIXXER CODE has not been issued for this job');
    }

    const stored = decryptFixxerCode(booking);
    if (!fixxerCodesMatch(stored, submitted)) {
      throw new BadRequestException('FIXXER CODE does not match');
    }

    await this.bookingModel.findByIdAndUpdate(id, {
      fixxerCodeVerifiedAt: new Date(),
    });
  }

  prepareAssignmentCode() {
    try {
      return issueFixxerCode();
    } catch (err) {
      const detail =
        err instanceof Error ? err.message.replace(/^FATAL:\s*/, '') : '';
      throw new BadRequestException(
        detail ||
          'FIXXER_CODE_KEY is not configured. Set a 32-byte key in the API runtime env (openssl rand -base64 32) and restart the server.',
      );
    }
  }

  async deliverAssignmentCode(bookingId: string, code: string): Promise<void> {
    if (!this.billEmail) return;
    try {
      await this.billEmail.sendAssignment(bookingId, code);
    } catch (err) {
      console.error('Assignment email failed:', err);
    }
  }

  async clearAssignmentCode(bookingId: string): Promise<void> {
    await this.bookingModel.findByIdAndUpdate(bookingId, {
      $unset: {
        fixxerCodeCiphertext: 1,
        fixxerCodeIv: 1,
        fixxerCodeAuthTag: 1,
        fixxerCodeIssuedAt: 1,
        fixxerCodeVerifiedAt: 1,
        assignmentEmailSentAt: 1,
      },
    });
  }

  async updateStatus(
    id: string,
    status: string,
    reason?: string,
    fixxerCode?: string,
  ): Promise<any> {
    const nextStatus = String(status || '').toUpperCase();

    /*
     * Admin cancellation needs to store the cancellation
     * reason, timestamp and actor separately from the
     * normal booking lifecycle status.
     */
    if (nextStatus === 'CANCELLED') {
      const booking =
        await this.bookingModel
          .findById(id)
          .exec();

      if (!booking) {
        throw new NotFoundException(
          'Booking not found',
        );
      }

      if (String(booking.status || '').toUpperCase() === 'CANCELLED') {
        throw new BadRequestException(
          'Booking is already cancelled',
        );
      }

      const trimmedReason =
        String(reason || '').trim();

      if (!trimmedReason) {
        throw new BadRequestException(
          'Cancellation reason is required',
        );
      }

      if (trimmedReason.length > 500) {
        throw new BadRequestException(
          'Cancellation reason cannot exceed 500 characters',
        );
      }

      booking.status = 'CANCELLED';
      booking.dispatchStatus = 'EXPIRED';
      booking.cancellationReason =
        trimmedReason;
      booking.cancelledAt = new Date();
      booking.cancelledBy = 'ADMIN';

      await booking.save();

      return this.populateBookingDetail(id);
    }

    const existing =
      await this.bookingModel.findById(id).exec();

    if (!existing) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    const previousStatus = String(existing.status || '').toUpperCase();

    if (statusRequiresTechnician(nextStatus) && !existing.technicianId) {
      throw new BadRequestException(
        'Assign a technician before setting this status. Use the Assigned Technician control — ASSIGNED requires a real technician on the booking.',
      );
    }

    if (nextStatus === 'COMPLETED' && previousStatus !== 'COMPLETED') {
      await this.requireFixxerCode(id, fixxerCode);
    }

    /*
     * Preserve the existing behavior for every
     * non-cancellation status update.
     */
    const updatedBooking =
      await this.bookingModel
        .findByIdAndUpdate(
          id,
          { status: nextStatus },
          { returnDocument: 'after' },
        )
        .exec();

    if (!updatedBooking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    if (
      nextStatus === 'CONFIRMED' &&
      previousStatus !== 'CONFIRMED' &&
      this.billEmail
    ) {
      try {
        await this.billEmail.sendConfirmation(id);
      } catch (err) {
        console.error('Confirmation email failed:', err);
      }
    }

    if (nextStatus === 'COMPLETED') {
      try {
        await this.generateInvoiceData(
          id,
          { returnDetail: false },
        );

        await this.registerWarrantiesOnComplete(
          id,
        );
      } catch (err) {
        console.error(
          'Invoice/Warranty lock failed:',
          err,
        );
      }

      if (
        previousStatus !== 'COMPLETED' &&
        existing.technicianId &&
        this.technicianEngine
      ) {
        try {
          await this.technicianEngine.applyStatusStepAvailability(
            String(existing.technicianId),
            'COMPLETED',
          );
        } catch (err) {
          console.error('Availability release on COMPLETED failed:', err);
        }
      }

      if (previousStatus !== 'COMPLETED' && this.billEmail) {
        try {
          await this.billEmail.sendForBooking(id);
        } catch (err) {
          console.error('Closing bill email failed:', err);
        }
      }
    }

    return this.populateBookingDetail(id);
  }

  async assignTechnician(
    id: string,
    technicianId: string,
  ): Promise<any> {
    const existing = await this.bookingModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Booking not found');
    }

    const previousTechnicianId = existing.technicianId
      ? String(existing.technicianId)
      : '';
    const sameTechnician = previousTechnicianId === String(technicianId);

    try {
      assertBookingAssignable(existing.status);
      const tech = await this.technicianModel.findById(technicianId).exec();
      // Re-selecting the current assignee is fine even while ON_JOB on this booking.
      if (sameTechnician) {
        if (!tech?.isActive) {
          throw new TechnicianEngineError('Technician is not active and available');
        }
      } else {
        assertAssignableTechnician(tech);
      }
    } catch (err) {
      if (err instanceof TechnicianEngineError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const keepCode =
      sameTechnician && !!existing.fixxerCodeCiphertext;
    const issued = keepCode ? null : this.prepareAssignmentCode();

    const updatedBooking =
      await this.bookingModel
        .findByIdAndUpdate(
          id,
          {
            $set: {
              technicianId: new Types.ObjectId(technicianId),
              status: 'ASSIGNED',
              assignmentStatus: 'PENDING_ACCEPTANCE',
              assignedAt: new Date(),
              acceptedAt: null,
              declinedAt: null,
              declineReason: null,
              dispatchStatus: 'ADMIN_ASSIGNED',
              ...(issued
                ? { ...issued.fields, fixxerCodeVerifiedAt: null }
                : {}),
            },
            ...(issued ? { $unset: { assignmentEmailSentAt: 1 } } : {}),
          },
          { returnDocument: 'after' },
        )
        .exec();

    if (!updatedBooking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    if (issued) {
      await this.deliverAssignmentCode(id, issued.code);
    }

    if (this.technicianEngine) {
      await this.technicianEngine.onAdminAssigned({
        technicianId,
        previousTechnicianId,
      });
    }

    await this.notificationDispatch.notify(
      technicianId,
      'NEW_JOB',
      'New job assigned',
      'You have been assigned a new service job.',
      { bookingId: id },
    );

    return this.populateBookingDetail(id);
  }

  private jobDetailsHasContent(
    details:
      | Record<string, any>
      | null
      | undefined,
  ): boolean {
    if (!details) return false;

    return Object.values(details).some(
      (v) =>
        typeof v === 'string' &&
        v.trim().length > 0 &&
        v.trim() !== '60 Days',
    );
  }

  private productDetailsHasContent(
    details:
      | Record<string, any>
      | null
      | undefined,
  ): boolean {
    if (!details) return false;

    return Object.values(details).some(
      (v) =>
        typeof v === 'string' &&
        v.trim().length > 0,
    );
  }

  async updateJobDetails(
    id: string,
    details: any,
    role: 'ADMIN' | 'TECHNICIAN' = 'ADMIN',
  ): Promise<any> {
    const existing =
      await this.bookingModel
        .findById(id)
        .exec();

    if (!existing) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    if (
      existing.sheetLockedAt &&
      role !== 'ADMIN'
    ) {
      throw new BadRequestException(
        'Job sheet is locked',
      );
    }

    const incomingEmpty =
      !this.jobDetailsHasContent(details);

    const existingHasContent =
      this.jobDetailsHasContent(
        existing.jobDetails as any,
      );

    if (
      incomingEmpty &&
      existingHasContent
    ) {
      throw new BadRequestException(
        'Refusing to overwrite job sheet with empty details',
      );
    }

    const setOps: Record<string, any> = {
      jobSheetUpdatedAt: new Date(),
      jobSheetUpdatedBy: role,
    };

    for (const [key, value] of Object.entries(
      details,
    )) {
      if (value !== undefined) {
        setOps[`jobDetails.${key}`] = value;
      }
    }

    await this.bookingModel
      .findByIdAndUpdate(id, {
        $set: setOps,
        $inc: { jobSheetRevision: 1 },
      })
      .exec();

    return this.populateBookingDetail(id);
  }

  async updateProductDetails(
    id: string,
    details: any,
    role: 'ADMIN' | 'TECHNICIAN' = 'ADMIN',
  ): Promise<any> {
    const existing =
      await this.bookingModel
        .findById(id)
        .exec();

    if (!existing) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    if (
      existing.sheetLockedAt &&
      role !== 'ADMIN'
    ) {
      throw new BadRequestException(
        'Job sheet is locked',
      );
    }

    const incomingEmpty =
      !this.productDetailsHasContent(
        details,
      );

    const existingHasContent =
      this.productDetailsHasContent(
        existing.productDetails as any,
      );

    if (
      incomingEmpty &&
      existingHasContent
    ) {
      throw new BadRequestException(
        'Refusing to overwrite product details with empty values',
      );
    }

    const setOps: Record<string, any> = {
      jobSheetUpdatedAt: new Date(),
      jobSheetUpdatedBy: role,
    };

    for (const [key, value] of Object.entries(
      details,
    )) {
      if (value !== undefined) {
        setOps[`productDetails.${key}`] =
          value;
      }
    }

    await this.bookingModel
      .findByIdAndUpdate(id, {
        $set: setOps,
        $inc: { jobSheetRevision: 1 },
      })
      .exec();

    await this.generateInvoiceData(
      id,
      { returnDetail: false },
    );

    // When a serial is saved, establish/refresh phone ↔ serial mapping
    if (details?.serialNumber) {
      const refreshed =
        await this.bookingModel
          .findById(id)
          .lean()
          .exec();

      if (refreshed) {
        void this.customerAppliancesService.syncFromBooking(
          refreshed as any,
          role,
        );
      }
    }

    return this.populateBookingDetail(id);
  }

  async updateServiceProperties(
    id: string,
    data: {
      serviceType?: string;
      paymentStatus?: string;
    },
  ): Promise<any> {
    const booking =
      await this.bookingModel
        .findByIdAndUpdate(
          id,
          data,
          { returnDocument: 'after' },
        )
        .exec();

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    return this.populateBookingDetail(id);
  }

  private parseNumericPrice(
    price: string | number,
  ): number {
    if (typeof price === 'number') {
      return price;
    }

    if (!price) return 0;

    // Extract numeric part from strings like "Starting at ₹249" or "₹1,499.00"
    const cleaned = price
      .toString()
      .replace(/,/g, '');

    const match =
      cleaned.match(/(\d+)/);

    return match
      ? parseFloat(match[1])
      : 0;
  }

  async updateInvoiceManual(
    id: string,
    data: {
      serviceTotal?: number;
      additionalCharges?: any[];
    },
  ): Promise<any> {
    const booking =
      await this.bookingModel
        .findById(id)
        .exec();

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    const setOps: Record<string, any> =
      {};

    if (data.serviceTotal !== undefined) {
      setOps['invoiceData.serviceTotal'] =
        data.serviceTotal;

      setOps['invoiceData.manualOverride'] =
        true;
    }

    if (
      data.additionalCharges !==
      undefined
    ) {
      setOps[
        'invoiceData.additionalCharges'
      ] = data.additionalCharges;
    }

    if (Object.keys(setOps).length > 0) {
      await this.bookingModel
        .findByIdAndUpdate(id, {
          $set: setOps,
        })
        .exec();
    }

    return this.generateInvoiceData(id);
  }

  async finalizeInvoice(
    id: string,
    fixxerCode?: string,
  ): Promise<any> {
    await this.requireFixxerCode(id, fixxerCode);

    const booking =
      await this.bookingModel
        .findByIdAndUpdate(
          id,
          {
            isBilled: true,
            status: 'COMPLETED',
            sheetLockedAt: new Date(),
            sheetLockedBy: 'SYSTEM',
          },
          { returnDocument: 'after' },
        )
        .exec();

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    try {
      await this.registerWarrantiesOnComplete(
        id,
      );
    } catch (err) {
      console.error(
        'Warranty registration on finalize failed:',
        err,
      );
    }

    if (booking.technicianId && this.technicianEngine) {
      try {
        await this.technicianEngine.applyStatusStepAvailability(
          String(booking.technicianId),
          'COMPLETED',
        );
      } catch (err) {
        console.error('Availability release on finalize failed:', err);
      }
    }

    const detail = await this.generateInvoiceData(id);

    if (this.billEmail) {
      try {
        await this.billEmail.sendForBooking(id);
      } catch (err) {
        console.error('Bill email failed:', err);
      }
    }

    return detail;
  }

  async unlockSheet(
    id: string,
  ): Promise<any> {
    const booking =
      await this.bookingModel
        .findByIdAndUpdate(
          id,
          {
            $unset: {
              sheetLockedAt: 1,
              sheetLockedBy: 1,
            },
          },
          { returnDocument: 'after' },
        )
        .exec();

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    return this.populateBookingDetail(id);
  }

  async addAdminNote(
    id: string,
    note: string,
  ): Promise<Booking> {
    const booking =
      await this.bookingModel
        .findByIdAndUpdate(
          id,
          { $push: { adminNotes: note } },
          { returnDocument: 'after' },
        )
        .exec();

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    return booking;
  }

  async generateInvoiceData(
    id: string,
    opts: { returnDetail?: boolean } = {
      returnDetail: true,
    },
  ): Promise<any> {
    const visits =
      await this.visitsService.findByBooking(
        id,
      );

    const booking =
      await this.bookingModel
        .findById(id)
        .exec();

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    // --- Service Total ---
    let serviceTotal: number;
    let serviceLabel = 'Service charge';
    let serviceDoc: ServiceDocument | null = null;

    if (booking.invoiceData?.manualOverride) {
      serviceTotal = Number(booking.invoiceData.serviceTotal) || 0;
    } else if (
      booking.serviceType ===
      'WARRANTY_CHECK'
    ) {
      serviceTotal = 0;
    } else {
      serviceTotal = 0;

      serviceDoc = await this.serviceModel
        .findById(booking.serviceId)
        .exec();

      if (serviceDoc) {
        serviceLabel =
          serviceDoc.name ||
          serviceDoc.title ||
          serviceLabel;
        const subCat =
          this.findSubCategoryById(
            serviceDoc,
            booking.subCategoryId,
          );

        if (subCat) {
          // Prefer numeric field; fall back to string parse for legacy data
          serviceTotal =
            subCat.priceNumeric != null
              ? subCat.priceNumeric / 100
              : this.parseNumericPrice(
                  subCat.price,
                );
          if (subCat.name) {
            serviceLabel = `${serviceDoc.name || serviceLabel} — ${subCat.name}`;
          }
        }

        if (!serviceTotal) {
          serviceTotal =
            (serviceDoc as any)
              .startingPriceNumeric !=
            null
              ? (serviceDoc as any)
                  .startingPriceNumeric /
                100
              : this.parseNumericPrice(
                  serviceDoc.startingPrice,
                );
        }
      }
    }

    // --- Parts Total ---
    let partsTotal = 0;

    const sparePartsSummary: {
      partName: string;
      quantity: number;
      cost: number;
      isThirdParty: boolean;
      warrantyCovered?: boolean;
      warrantyMonths?: number;
      serialNumber?: string;
    }[] = [];

    for (const visit of visits as any[]) {
      if (!visit.partsUsed) continue;

      for (const usage of visit.partsUsed) {
        const quantity =
          usage.quantity || 1;

        let partName = '';
        let cost = 0;

        if (usage.warrantyCovered) {
          partName =
            usage.partName ||
            usage.sparePartId?.name ||
            'Warranty replacement';

          cost = 0;
        } else if (usage.isThirdParty) {
          partName =
            usage.partName ||
            'Generic Part';

          cost = usage.cost || 0;
        } else if (usage.sparePartId) {
          partName =
            usage.partName ||
            usage.sparePartId.name ||
            'Spare Part';

          cost = await this.visitsService.correctCatalogCost(usage);
        }

        partsTotal +=
          cost * quantity;

        sparePartsSummary.push({
          partName,
          quantity,
          cost,
          isThirdParty:
            !!usage.isThirdParty,
          warrantyCovered:
            !!usage.warrantyCovered,
          warrantyMonths:
            Number(usage.warrantyMonths) ||
            undefined,
          serialNumber:
            usage.serialNumber ||
            undefined,
        });
      }
    }

    // --- Additional Charges ---
    const additionalCharges =
      booking.invoiceData
        ?.additionalCharges || [];

    const additionalTotal =
      additionalCharges.reduce(
        (sum: number, c: any) =>
          sum + (c.amount || 0),
        0,
      );

    const sacCode = fixxerServiceSac(
      serviceDoc?.slug || serviceDoc?.name || serviceLabel,
    );

    // Service prices are pre-GST; engine adds tax on top (shop is the reverse: inclusive).
    const gst = this.gstService.breakdown({
      lineItems: [
        ...(serviceTotal > 0
          ? [
              {
                description: serviceLabel,
                quantity: 1,
                unitPrice: serviceTotal,
                hsn: sacCode,
              },
            ]
          : []),
        ...sparePartsSummary.map((part) => ({
          description: part.partName || 'Spare part',
          quantity: part.quantity || 1,
          unitPrice: part.warrantyCovered ? 0 : part.cost || 0,
          hsn: sacCode,
        })),
        ...additionalCharges.map((charge: any) => ({
          description: charge.label || 'Additional charge',
          quantity: 1,
          unitPrice: Number(charge.amount) || 0,
          hsn: sacCode,
        })),
      ],
      taxPercent: FIXXER_SERVICE_GST_PERCENT,
      priceMode: 'EXCLUSIVE' as const,
      supplyType: 'INTRA' as const,
    });

    const totalAmount = gst.totalAmount;

    const settlement =
      computeTechnicianSettlement({
        serviceTotal,
        additionalCharges,
        parts: collectPartsFromVisits(
          visits as any[],
        ),
      });

    const estimatedAmount =
      resolveFrozenEstimatedAmount(
        booking.estimatedAmount,
        serviceTotal,
      );

    await this.bookingModel
      .findByIdAndUpdate(id, {
        $set: {
          estimatedAmount,
          'invoiceData.generatedAt':
            new Date(),
          'invoiceData.partsTotal':
            partsTotal,
          'invoiceData.serviceTotal':
            serviceTotal,
          'invoiceData.additionalCharges':
            additionalCharges,
          'invoiceData.spareParts':
            sparePartsSummary,
          'invoiceData.totalAmount':
            totalAmount,
          'invoiceData.taxableValue': gst.taxableValue,
          'invoiceData.taxPercent': gst.taxPercent,
          'invoiceData.taxAmount': gst.taxAmount,
          'invoiceData.cgstAmount': gst.cgstAmount,
          'invoiceData.sgstAmount': gst.sgstAmount,
          'invoiceData.igstAmount': gst.igstAmount,
          'invoiceData.priceMode': gst.priceMode,
          'invoiceData.supplyType': gst.supplyType,
          'invoiceData.sacCode': sacCode,
          'invoiceData.technicianNet':
            settlement.technicianNet,
          'invoiceData.fixxerNet':
            settlement.fixxerNet,
          // Client-side invoice printer; keep path stable for ops tooling.
          'invoiceData.url':
            `/my-bookings?invoice=${id}`,
        },
      })
      .exec();

    if (opts.returnDetail === false) {
      return this.bookingModel
        .findById(id)
        .exec() as any;
    }

    return this.populateBookingDetail(id);
  }

  private isJobFinished(
    booking: {
      status?: string;
      jobClosed?: boolean;
    },
  ) {
    return (
      booking.jobClosed === true ||
      booking.status === 'COMPLETED' ||
      booking.status ===
        'PAYMENT_COLLECTED'
    );
  }

  async claimWarranty(
    id: string,
    userId: string,
  ): Promise<any> {
    const originalBooking =
      await this.bookingModel
        .findById(id)
        .exec();

    if (!originalBooking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    if (String(originalBooking.userId) !== String(userId)) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    if (!this.isJobFinished(originalBooking)) {
      throw new BadRequestException(
        'Warranty can only be claimed for completed services',
      );
    }

    if (!originalBooking.warrantyExpiry) {
      await this.lockServiceWarranty(id);
    }

    const refreshed =
      await this.bookingModel
        .findById(id)
        .exec();

    if (
      !refreshed?.warrantyExpiry ||
      new Date() >
        refreshed.warrantyExpiry
    ) {
      throw new BadRequestException(
        'Warranty has expired or is not applicable',
      );
    }

    if (
      originalBooking.claimBookingIds &&
      originalBooking.claimBookingIds.length >
        0
    ) {
      throw new BadRequestException(
        'A warranty claim has already been initiated for this booking.',
      );
    }

    const claimBooking =
      new this.bookingModel({
        userId: originalBooking.userId,
        serviceId:
          originalBooking.serviceId,
        subCategoryId:
          originalBooking.subCategoryId,
        contactPhone:
          originalBooking.contactPhone,
        addressData:
          originalBooking.addressData,
        description: `WARRANTY CLAIM for Booking #${id.slice(-6).toUpperCase()}. Original Issue: ${originalBooking.description}`,
        status: 'PENDING',
        serviceType: 'WARRANTY_CHECK',
        paymentStatus:
          'WARRANTY_SERVICE',
        parentId:
          originalBooking._id,
        productDetails:
          originalBooking.productDetails,
        dispatchStatus: 'OPEN',
      });

    const saved =
      await claimBooking.save();

    await this.bookingModel
      .findByIdAndUpdate(id, {
        $push: {
          claimBookingIds: saved._id,
        },
      })
      .exec();

    void this.jobDispatch.broadcastJob(
      saved._id.toString(),
    );

    return this.populateBookingDetail(
      saved._id.toString(),
    );
  }

  async getFixxerRevenueStats() {
    // Paid tech collections + admin-finalized COMPLETED/billed jobs (invoice may exist while paymentStatus is still UNPAID).
    const paid =
      await this.bookingModel
        .find({
          $or: [
            {
              paymentStatus: {
                $in: [
                  'PAID_CASH',
                  'PAID_ONLINE',
                ],
              },
            },
            {
              status: {
                $in: [
                  'PAYMENT_COLLECTED',
                  'COMPLETED',
                ],
              },
            },
            {
              paidAt: {
                $exists: true,
                $ne: null,
              },
            },
            { isBilled: true },
          ],
        })
        .select(
          '_id paidAt jobClosedAt updatedAt invoiceData paymentStatus jobPaymentMethod isBilled status',
        )
        .lean()
        .exec();

    const ids = paid.map((b) =>
      String(b._id),
    );

    const visits =
      await this.visitsService.findByBookingIds(
        ids,
      );

    const visitsByBooking =
      new Map<string, any[]>();

    for (const visit of visits as any[]) {
      const bid = String(
        visit.bookingId,
      );

      if (
        !visitsByBooking.has(bid)
      ) {
        visitsByBooking.set(
          bid,
          [],
        );
      }

      visitsByBooking
        .get(bid)!
        .push(visit);
    }

    const now = new Date();

    const startOfDay =
      new Date(now);

    startOfDay.setHours(
      0,
      0,
      0,
      0,
    );

    const startOfWeek =
      new Date(startOfDay);

    const weekday =
      startOfWeek.getDay();

    startOfWeek.setDate(
      startOfWeek.getDate() -
        (weekday === 0
          ? 6
          : weekday - 1),
    );

    const startOfMonth =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      );

    const empty = {
      collections: 0,
      customerTotal: 0,
      fixxerNet: 0,
      technicianNet: 0,
    };

    const daily = { ...empty };
    const weekly = { ...empty };
    const monthly = { ...empty };

    const recent: Array<{
      bookingId: string;
      collectedAt: Date;
      customerTotal: number;
      fixxerNet: number;
      technicianNet: number;
      paymentMethod?: string;
    }> = [];

    const add = (
      bucket: typeof empty,
      row: {
        customerTotal: number;
        fixxerNet: number;
        technicianNet: number;
      },
    ) => {
      bucket.collections += 1;
      bucket.customerTotal +=
        row.customerTotal;
      bucket.fixxerNet +=
        row.fixxerNet;
      bucket.technicianNet +=
        row.technicianNet;
    };

    for (
      const booking of paid as any[]
    ) {
      const invoice =
        booking.invoiceData || {};

      let customerTotal =
        Number(
          invoice.totalAmount,
        ) || 0;

      let fixxerNet =
        invoice.fixxerNet;

      let technicianNet =
        invoice.technicianNet;

      if (
        fixxerNet == null ||
        technicianNet == null
      ) {
        const settlement =
          computeTechnicianSettlement(
            {
              serviceTotal:
                invoice.serviceTotal ||
                0,
              additionalCharges:
                invoice.additionalCharges ||
                [],
              parts:
                collectPartsFromVisits(
                  visitsByBooking.get(
                    String(
                      booking._id,
                    ),
                  ) || [],
                ),
            },
          );

        customerTotal =
          settlement.customerTotal ||
          customerTotal;

        fixxerNet =
          settlement.fixxerNet;

        technicianNet =
          settlement.technicianNet;
      }

      fixxerNet = Number(fixxerNet) || 0;
      technicianNet = Number(technicianNet) || 0;
      customerTotal = Number(customerTotal) || 0;

      // Skip empty shells (COMPLETED with no invoice yet).
      if (
        customerTotal <= 0 &&
        fixxerNet <= 0 &&
        technicianNet <= 0
      ) {
        continue;
      }

      const collectedAt =
        new Date(
          booking.paidAt ||
            booking.jobClosedAt ||
            invoice.generatedAt ||
            booking.updatedAt ||
            now,
        );

      const row = {
        bookingId: String(
          booking._id,
        ),
        collectedAt,
        customerTotal,
        fixxerNet,
        technicianNet,
        paymentMethod:
          booking.jobPaymentMethod ||
          booking.paymentStatus,
      };

      recent.push(row);

      if (
        collectedAt >= startOfDay
      ) {
        add(daily, row);
      }

      if (
        collectedAt >= startOfWeek
      ) {
        add(weekly, row);
      }

      if (
        collectedAt >= startOfMonth
      ) {
        add(monthly, row);
      }
    }

    recent.sort(
      (a, b) =>
        b.collectedAt.getTime() -
        a.collectedAt.getTime(),
    );

    const roundBucket = (
      b: typeof empty,
    ) => ({
      collections: b.collections,
      customerTotal:
        Math.round(
          b.customerTotal * 100,
        ) / 100,
      fixxerNet:
        Math.round(
          b.fixxerNet * 100,
        ) / 100,
      technicianNet:
        Math.round(
          b.technicianNet * 100,
        ) / 100,
    });

    return {
      daily: roundBucket(daily),
      weekly: roundBucket(weekly),
      monthly: roundBucket(monthly),
      recent: recent.slice(0, 25),
    };
  }

  async countByStatus(): Promise<
    Record<string, number>
  > {
    const results =
      await this.bookingModel
        .aggregate([
          {
            $group: {
              _id: '$status',
              count: {
                $sum: 1,
              },
            },
          },
        ])
        .exec();

    const counts: Record<
      string,
      number
    > = {};

    results.forEach(
      (r: any) => {
        counts[r._id] = r.count;
      },
    );

    return counts;
  }

  async countAll(): Promise<number> {
    return this.bookingModel
      .countDocuments()
      .exec();
  }
}