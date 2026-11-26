import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import {
  CustomerAppliance,
  CustomerApplianceDocument,
} from '../customer-appliances/schemas/customer-appliance.schema';
import {
  Feedback,
  FeedbackDocument,
} from '../feedback/schemas/feedback.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import {
  PartInventoryTransaction,
  PartInventoryTransactionDocument,
} from '../visits/schemas/part-inventory-transaction.schema';
import {
  Warranty,
  WarrantyDocument,
} from '../warranties/schemas/warranty.schema';
import {
  FeedbackFollowUp,
  FeedbackFollowUpDocument,
} from '../feedback/schemas/feedback-follow-up.schema';

@Injectable()
export class CustomerServiceHistoryService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(CustomerAppliance.name)
    private readonly applianceModel: Model<CustomerApplianceDocument>,
    @InjectModel(Visit.name) private readonly visitModel: Model<VisitDocument>,
    @InjectModel(PartInventoryTransaction.name)
    private readonly partTransactionModel: Model<PartInventoryTransactionDocument>,
    @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<FeedbackDocument>,
    @InjectModel(Warranty.name)
    private readonly warrantyModel: Model<WarrantyDocument>,
    @InjectModel(FeedbackFollowUp.name)
    private readonly followUpModel: Model<FeedbackFollowUpDocument>,
  ) {}

  async getCustomerServiceHistory(
    customerId: string,
    pageRaw = 1,
    limitRaw = 20,
    phone?: string,
  ) {
    let customer: UserDocument | null = null;

    if (phone && phone.trim()) {
      const normalizedPhone = String(phone).replace(/\D/g, '');
      const phoneVariants = normalizedPhone.length
        ? [normalizedPhone, `+91${normalizedPhone}`, `91${normalizedPhone}`]
        : [];
      customer = await this.userModel
        .findOne({
          $or: phoneVariants.map((variant) => ({ phone: variant, role: 'CUSTOMER' })),
        })
        .select('_id fullName phone email role createdAt')
        .lean()
        .exec();
      if (!customer) {
        throw new NotFoundException('No customer found for this phone number');
      }
    } else {
      if (!Types.ObjectId.isValid(customerId)) {
        throw new BadRequestException('Invalid customerId');
      }
      customer = await this.userModel
        .findById(customerId)
        .select('_id fullName phone email role createdAt')
        .lean()
        .exec();
      if (!customer || customer.role !== 'CUSTOMER') {
        throw new NotFoundException('Customer not found');
      }
    }

    const resolvedCustomerId = String(customer._id);
    const page = this.paginationValue(pageRaw, 'page');
    const limit = this.paginationValue(limitRaw, 'limit');
    if (limit > 100) throw new BadRequestException('limit cannot exceed 100');

    // Legacy booking rows may contain userId as a string despite the schema ref.
    const userIdFilter = {
      $or: [{ userId: new Types.ObjectId(resolvedCustomerId) }, { userId: resolvedCustomerId }],
    };
    const [total, bookings] = await Promise.all([
      this.bookingModel.countDocuments(userIdFilter).exec(),
      this.bookingModel
        .find(userIdFilter)
        .select(
          '_id createdAt updatedAt userId technicianId serviceId subCategoryId contactPhone addressData description status cancellationReason cancelledAt cancelledBy assignedAt acceptedAt declinedAt assignmentStatus serviceType paymentStatus productDetails jobDetails invoiceData visits feedbackId warrantyExpiry parentId claimBookingIds correctiveBookingIds reviewStatus reviewHistory changeHistory estimatedAmount isBilled preferredVisitDate preferredVisitSlot expectedArrivalAt arrivalAt completionData jobClosed jobClosedAt paidAt jobPaymentMethod jobSheetRevision jobSheetUpdatedAt jobSheetUpdatedBy',
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'serviceId', select: 'name slug' })
        .populate({ path: 'technicianId', select: 'name phone' })
        .lean()
        .exec(),
    ]);
    const bookingIds = bookings.map(
      (booking: any) => booking._id as Types.ObjectId,
    );

    if (!bookingIds.length) {
      return {
        customer,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        appliances: [],
        bookings: [],
        unifiedTimeline: [],
        historyLimitations: [
          'Only records linked to bookings owned by this customer are included.',
          'Unlinked appliance mappings cannot be safely attributed by phone number alone.',
        ],
      };
    }

    const [appliances, visits, partTransactions, feedbackRows, warranties, followUpRows] =
      await Promise.all([
        this.applianceModel
          .find({
            $or: [
              { bookingIds: { $in: bookingIds } },
              { primaryBookingId: { $in: bookingIds } },
              {
                serialNumber: {
                  $in: bookings
                    .map((b: any) => b.productDetails?.serialNumber)
                    .filter(Boolean),
                },
              },
            ],
          })
          .lean()
          .exec(),
        this.visitModel
          .find({ bookingId: { $in: bookingIds } })
          .sort({ bookingId: 1, visitOrder: 1, _id: 1 })
          .populate({ path: 'technicianId', select: 'name phone' })
          .populate({
            path: 'partsUsed',
            populate: { path: 'sparePartId', select: 'name sku partNumber' },
          })
          .lean()
          .exec(),
        this.partTransactionModel
          .find({ bookingId: { $in: bookingIds } })
          .sort({ createdAt: 1, _id: 1 })
          .populate({ path: 'sparePartId', select: 'name sku partNumber' })
          .lean()
          .exec(),
        this.feedbackModel
          .find({ bookingId: { $in: bookingIds } })
          .lean()
          .exec(),
        this.warrantyModel
          .find({ bookingId: { $in: bookingIds } })
          .sort({ startDate: -1, _id: -1 })
          .lean()
          .exec(),
        this.followUpModel
          .find({ bookingId: { $in: bookingIds } })
          .sort({ createdAt: 1, _id: 1 })
          .lean()
          .exec(),
      ]);

    const applianceBySerial = new Map<string, any>();
    for (const appliance of appliances as any[]) {
      applianceBySerial.set(
        String(appliance.serialNumber || '').toUpperCase(),
        appliance,
      );
    }
    const visitsByBooking = this.groupById(visits as any[], 'bookingId');
    const transactionsByBooking = this.groupById(
      partTransactions as any[],
      'bookingId',
    );
    const feedbackByBooking = new Map(
      (feedbackRows as any[]).map((feedback) => [
        String(feedback.bookingId),
        feedback,
      ]),
    );
    const warrantiesByBooking = this.groupById(
      warranties as any[],
      'bookingId',
    );

    const bookingRows = (bookings as any[]).map((booking) => {
      const id = String(booking._id);
      const bookingVisits = visitsByBooking.get(id) || [];
      const bookingWarranties = warrantiesByBooking.get(id) || [];
      const bookingTransactions = transactionsByBooking.get(id) || [];
      const serial = String(
        booking.productDetails?.serialNumber || '',
      ).toUpperCase();
      const mappedAppliance = serial
        ? applianceBySerial.get(serial)
        : undefined;
      const parts = bookingVisits.flatMap((visit: any) =>
        (visit.partsUsed || []).map((usage: any) => ({
          ...usage,
          visitId: visit._id,
          visitOrder: visit.visitOrder,
          installedAt: usage.installedAt || usage.createdAt || null,
          partName:
            usage.partName ||
            usage.sparePartId?.name ||
            usage.sparePartId?.partNumber ||
            null,
          partSku: usage.sparePartId?.sku || null,
        })),
      );
      return {
        ...booking,
        appliance: mappedAppliance
          ? {
              id: mappedAppliance._id,
              serialNumber: mappedAppliance.serialNumber,
              brand:
                mappedAppliance.brand || booking.productDetails?.brand || '',
              modelNumber:
                mappedAppliance.modelNumber ||
                booking.productDetails?.modelNumber ||
                '',
              mappedAt: mappedAppliance.mappedAt || null,
            }
          : serial
            ? {
                id: null,
                serialNumber: booking.productDetails?.serialNumber,
                brand: booking.productDetails?.brand || '',
                modelNumber: booking.productDetails?.modelNumber || '',
                mappedAt: null,
              }
            : null,
        visits: bookingVisits,
        partsHistory: {
          availability: parts.length ? 'RECORDED' : 'NO_PARTS_RECORDED',
          data: parts,
          inventoryTransactions: bookingTransactions.map(
            (transaction: any) => ({
              _id: transaction._id,
              visitId: transaction.visitId,
              usageId: transaction.sparePartUsageId,
              type: transaction.type,
              quantity: transaction.quantity,
              relatedTransactionId: transaction.relatedTransactionId || null,
              part: transaction.sparePartId || null,
              occurredAt: transaction.createdAt,
            }),
          ),
          note: parts.length
            ? null
            : 'No current part usage records are linked to this booking; this does not prove no parts were used historically.',
        },
        feedback: feedbackByBooking.get(id) || null,
        warranties: bookingWarranties,
        warrantyClaims: {
          parentBookingId: booking.parentId || null,
          claimBookingIds: booking.claimBookingIds || [],
          isWarrantyClaim:
            booking.serviceType === 'WARRANTY_CHECK' || !!booking.parentId,
        },
        jobCompletion: {
          jobClosed: !!booking.jobClosed,
          jobClosedAt: booking.jobClosedAt || null,
          paidAt: booking.paidAt || null,
          completionData: booking.completionData || null,
          jobSheetUpdatedAt: booking.jobSheetUpdatedAt || null,
          jobSheetRevision: booking.jobSheetRevision || 0,
        },
      };
    });

    const applianceRows = (appliances as any[]).map((appliance) => ({
      _id: appliance._id,
      serialNumber: appliance.serialNumber,
      brand: appliance.brand,
      modelNumber: appliance.modelNumber,
      mappedAt: appliance.mappedAt || null,
      createdAt: appliance.createdAt,
      bookingIds: (appliance.bookingIds || [])
        .filter((id: any) =>
          bookingIds.some((ownedId) => String(ownedId) === String(id)),
        )
        .map(String),
      serviceBookingIds: bookingRows
        .filter(
          (booking: any) =>
            booking.appliance?.serialNumber?.toUpperCase() ===
            String(appliance.serialNumber).toUpperCase(),
        )
        .map((booking: any) => String(booking._id)),
    }));

    const followUpByBooking = new Map(
      (followUpRows as any[]).map((followUp) => [
        String(followUp.bookingId),
        followUp,
      ]),
    );

    const unifiedTimeline = this.buildUnifiedTimeline(
      bookingRows,
      visits as any[],
      partTransactions as any[],
      warranties as any[],
      feedbackRows as any[],
      followUpRows as any[],
      bookingRows,
    );

    return {
      customer,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      appliances: applianceRows,
      bookings: bookingRows,
      unifiedTimeline,
      historyLimitations: [
        'Booking results are paginated; appliance serviceBookingIds cover the bookings on this page.',
        'A missing part record means no current linked usage was found; removed or unrecorded historical parts cannot be reconstructed.',
        'Booking changeHistory records only changes captured by existing write paths; visit status transition history is not stored.',
        'Feedback is stored as the current record per booking, and prior edits are not retained.',
        'Invoice events are derived from booking invoiceData; separate invoice records are not maintained.',
        'Follow-up events come from feedback follow-up records linked to bookings.',
      ],
    };
  }

  private buildUnifiedTimeline(
    bookingRows: any[],
    visits: any[],
    partTransactions: any[],
    warranties: any[],
    feedbackRows: any[],
    followUpRows: any[],
    bookings: any[],
  ): any[] {
    const events: Array<{
      type: string;
      timestamp: Date;
      bookingId: string;
      data: any;
    }> = [];

    for (const booking of bookingRows) {
      const bookingDate = booking.createdAt ? new Date(booking.createdAt) : null;
      if (bookingDate) {
        events.push({
          type: 'booking',
          timestamp: bookingDate,
          bookingId: String(booking._id),
          data: {
            id: String(booking._id),
            status: booking.status,
            serviceType: booking.serviceType,
            estimatedAmount: booking.estimatedAmount,
            hasInvoice: Boolean(booking.invoiceData),
          },
        });
      }
      if (booking.jobClosedAt) {
        events.push({
          type: 'job_completion',
          timestamp: new Date(booking.jobClosedAt),
          bookingId: String(booking._id),
          data: {
            id: String(booking._id),
            jobClosed: booking.jobClosed,
            paidAt: booking.paidAt,
          },
        });
      }
      if (booking.cancelledAt) {
        events.push({
          type: 'cancellation',
          timestamp: new Date(booking.cancelledAt),
          bookingId: String(booking._id),
          data: {
            id: String(booking._id),
            cancellationReason: booking.cancellationReason,
          },
        });
      }
      if (booking.paidAt) {
        events.push({
          type: 'payment',
          timestamp: new Date(booking.paidAt),
          bookingId: String(booking._id),
          data: {
            id: String(booking._id),
            paymentMethod: booking.jobPaymentMethod,
          },
        });
      }
      if (booking.invoiceData && booking.invoiceData.generatedAt) {
        events.push({
          type: 'invoice',
          timestamp: new Date(booking.invoiceData.generatedAt),
          bookingId: String(booking._id),
          data: {
            id: String(booking._id),
            invoiceNumber: booking.invoiceNumber || null,
            totalAmount: booking.invoiceData.totalAmount || 0,
            taxAmount: booking.invoiceData.taxAmount || 0,
            technicianNet: booking.invoiceData.technicianNet || 0,
            fixxerNet: booking.invoiceData.fixxerNet || 0,
          },
        });
      }
    }

    for (const visit of visits) {
      const visitDate = visit.createdAt ? new Date(visit.createdAt) : null;
      if (visitDate) {
        events.push({
          type: 'visit',
          timestamp: visitDate,
          bookingId: String(visit.bookingId),
          data: {
            id: String(visit._id),
            visitOrder: visit.visitOrder,
            technicianId: visit.technicianId,
            partsUsedCount: (visit.partsUsed || []).length,
          },
        });
      }
    }

    for (const transaction of partTransactions) {
      const txDate = transaction.createdAt ? new Date(transaction.createdAt) : null;
      if (txDate) {
        events.push({
          type: 'part_transaction',
          timestamp: txDate,
          bookingId: String(transaction.bookingId),
          data: {
            id: String(transaction._id),
            type: transaction.type,
            quantity: transaction.quantity,
            condition: (transaction as any).returnCondition,
          },
        });
      }
    }

    for (const warranty of warranties) {
      const wDate = warranty.startDate ? new Date(warranty.startDate) : null;
      if (wDate) {
        events.push({
          type: 'warranty',
          timestamp: wDate,
          bookingId: String(warranty.bookingId),
          data: {
            id: String(warranty._id),
            status: warranty.status,
          },
        });
      }
    }

    for (const feedback of feedbackRows) {
      const fDate = feedback.createdAt ? new Date(feedback.createdAt) : null;
      if (fDate) {
        events.push({
          type: 'feedback',
          timestamp: fDate,
          bookingId: String(feedback.bookingId),
          data: {
            id: String(feedback._id),
            rating: feedback.rating,
          },
        });
      }
    }

    for (const followUp of followUpRows) {
      const fuDate = followUp.createdAt ? new Date(followUp.createdAt) : null;
      if (fuDate) {
        events.push({
          type: 'follow_up',
          timestamp: fuDate,
          bookingId: String(followUp.bookingId),
          data: {
            id: String(followUp._id),
            status: followUp.status,
            ownerId: followUp.ownerId,
            dueDate: followUp.dueDate,
            resolution: followUp.resolution,
            resolvedAt: followUp.resolvedAt,
          },
        });
      }
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return events;
  }

  /**
   * Return a paginated, appliance-scoped service timeline. A booking is linked
   * only when its serial matches exactly or the mapping explicitly contains
   * its booking ID; a shared phone number alone is not treated as proof that
   * the booking belongs to this appliance.
   */
  async getApplianceServiceTimeline(
    serialRaw: string,
    pageRaw = 1,
    limitRaw = 20,
  ) {
    const serialNumber = String(serialRaw || '').trim().toUpperCase();
    if (!serialNumber) throw new BadRequestException('Serial number is required');
    const page = this.paginationValue(pageRaw, 'page');
    const limit = this.paginationValue(limitRaw, 'limit');
    if (limit > 100) throw new BadRequestException('limit cannot exceed 100');

    const appliance = await this.applianceModel
      .findOne({ serialNumber })
      .lean()
      .exec();
    if (!appliance) {
      throw new NotFoundException(`No appliance mapping found for serial ${serialNumber}`);
    }

    const serialPattern = new RegExp(
      `^${serialNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i',
    );
    const linkedIds = [
      ...(appliance.bookingIds || []),
      ...(appliance.primaryBookingId ? [appliance.primaryBookingId] : []),
    ];
    const bookingFilter = {
      $or: [
        { _id: { $in: linkedIds } },
        { 'productDetails.serialNumber': serialPattern },
      ],
    };
    const [total, bookings, primaryBooking] = await Promise.all([
      this.bookingModel.countDocuments(bookingFilter).exec(),
      this.bookingModel
        .find(bookingFilter)
        .select(
          '_id createdAt updatedAt userId technicianId serviceId subCategoryId contactPhone addressData description status cancellationReason cancelledAt cancelledBy assignedAt acceptedAt declinedAt assignmentStatus serviceType paymentStatus productDetails jobDetails invoiceData visits feedbackId warrantyExpiry parentId claimBookingIds correctiveBookingIds reviewStatus reviewHistory changeHistory estimatedAmount isBilled preferredVisitDate preferredVisitSlot expectedArrivalAt arrivalAt completionData jobClosed jobClosedAt paidAt jobPaymentMethod jobSheetRevision jobSheetUpdatedAt jobSheetUpdatedBy',
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'serviceId', select: 'name slug' })
        .populate({ path: 'technicianId', select: 'name phone' })
        .lean()
        .exec(),
      appliance.primaryBookingId
        ? this.bookingModel
            .findById(appliance.primaryBookingId)
            .select('_id createdAt status serviceType serviceId productDetails')
            .populate({ path: 'serviceId', select: 'name slug' })
            .lean()
            .exec()
        : Promise.resolve(null),
    ]);

    const bookingIds = (bookings as any[]).map((booking) => booking._id);
    const [visits, partTransactions, feedbackRows, warranties] = bookingIds.length
      ? await Promise.all([
          this.visitModel
            .find({ bookingId: { $in: bookingIds } })
            .sort({ bookingId: 1, visitOrder: 1, _id: 1 })
            .populate({ path: 'technicianId', select: 'name phone' })
            .populate({
              path: 'partsUsed',
              populate: { path: 'sparePartId', select: 'name sku partNumber' },
            })
            .lean()
            .exec(),
          this.partTransactionModel
            .find({ bookingId: { $in: bookingIds } })
            .sort({ createdAt: 1, _id: 1 })
            .populate({ path: 'sparePartId', select: 'name sku partNumber' })
            .lean()
            .exec(),
          this.feedbackModel.find({ bookingId: { $in: bookingIds } }).lean().exec(),
          this.warrantyModel
            .find({ bookingId: { $in: bookingIds } })
            .sort({ startDate: -1, _id: -1 })
            .lean()
            .exec(),
        ])
      : [[], [], [], []];

    const visitsByBooking = this.groupById(visits as any[], 'bookingId');
    const transactionsByBooking = this.groupById(partTransactions as any[], 'bookingId');
    const feedbackByBooking = new Map(
      (feedbackRows as any[]).map((feedback) => [String(feedback.bookingId), feedback]),
    );
    const warrantiesByBooking = this.groupById(warranties as any[], 'bookingId');
    const bookingRows = (bookings as any[]).map((booking) => {
      const id = String(booking._id);
      const bookingVisits = visitsByBooking.get(id) || [];
      const bookingWarranties = warrantiesByBooking.get(id) || [];
      const bookingTransactions = transactionsByBooking.get(id) || [];
      const parts = bookingVisits.flatMap((visit: any) =>
        (visit.partsUsed || []).map((usage: any) => ({
          ...usage,
          visitId: visit._id,
          visitOrder: visit.visitOrder,
          installedAt: usage.installedAt || usage.createdAt || null,
          partName:
            usage.partName ||
            usage.sparePartId?.name ||
            usage.sparePartId?.partNumber ||
            null,
          partSku: usage.sparePartId?.sku || null,
        })),
      );
      return {
        ...booking,
        appliance: {
          id: String(appliance._id),
          serialNumber: appliance.serialNumber,
          brand: appliance.brand || booking.productDetails?.brand || '',
          modelNumber:
            appliance.modelNumber || booking.productDetails?.modelNumber || '',
          mappedAt: appliance.mappedAt || null,
        },
        visits: bookingVisits,
        partsHistory: {
          availability: parts.length ? 'RECORDED' : 'NO_PARTS_RECORDED',
          data: parts,
          inventoryTransactions: bookingTransactions.map((transaction: any) => ({
            _id: transaction._id,
            visitId: transaction.visitId,
            usageId: transaction.sparePartUsageId,
            type: transaction.type,
            quantity: transaction.quantity,
            relatedTransactionId: transaction.relatedTransactionId || null,
            part: transaction.sparePartId || null,
            occurredAt: transaction.createdAt,
          })),
          note: parts.length
            ? null
            : 'No current part usage records are linked to this booking; this does not prove no parts were used historically.',
        },
        feedback: feedbackByBooking.get(id) || null,
        warranties: bookingWarranties,
        warrantyClaims: {
          parentBookingId: booking.parentId || null,
          claimBookingIds: booking.claimBookingIds || [],
          correctiveBookingIds: booking.correctiveBookingIds || [],
          isWarrantyClaim:
            booking.serviceType === 'WARRANTY_CHECK' || !!booking.parentId,
        },
        jobCompletion: {
          jobClosed: !!booking.jobClosed,
          jobClosedAt: booking.jobClosedAt || null,
          paidAt: booking.paidAt || null,
          completionData: booking.completionData || null,
          jobSheetUpdatedAt: booking.jobSheetUpdatedAt || null,
          jobSheetRevision: booking.jobSheetRevision || 0,
        },
      };
    });

    const phoneDigits = (appliance.phones || []).map((phone: string) =>
      String(phone).replace(/\D/g, '').slice(-10),
    ).filter((phone: string) => phone.length === 10);
    const phoneVariants = phoneDigits.flatMap((phone: string) => [
      phone,
      `+91${phone}`,
      `91${phone}`,
    ]);
    const customers = phoneVariants.length
      ? await this.userModel
          .find({ phone: { $in: phoneVariants }, role: 'CUSTOMER' })
          .select('_id fullName phone email role createdAt')
          .lean()
          .exec()
      : [];

    return {
      appliance: {
        _id: appliance._id,
        serialNumber: appliance.serialNumber,
        phones: appliance.phones || [],
        brand: appliance.brand || '',
        modelNumber: appliance.modelNumber || '',
        primaryBookingId: appliance.primaryBookingId
          ? String(appliance.primaryBookingId)
          : null,
        bookingIds: (appliance.bookingIds || []).map(String),
        mappedAt: appliance.mappedAt || null,
        mappedBy: appliance.mappedBy || null,
      },
      customers,
      primaryBooking: primaryBooking
        ? {
            ...primaryBooking,
            serviceName:
              (primaryBooking as any).serviceId?.name ||
              (primaryBooking as any).serviceId?.slug ||
              null,
          }
        : null,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      bookings: bookingRows,
      historyLimitations: [
        'Bookings are included by an exact serial match or an explicit appliance booking link; phone matches alone are not auto-linked.',
        'A missing part record means no current linked usage was found; removed or unrecorded historical parts cannot be reconstructed.',
        'Booking changeHistory records only changes captured by existing write paths; visit status transition history is not stored.',
        'Feedback is stored as the current record per booking, and prior edits are not retained.',
      ],
    };
  }

  private paginationValue(raw: number, name: string): number {
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new BadRequestException(`${name} must be a positive integer`);
    }
    return value;
  }

  private groupById(rows: any[], key: string): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    for (const row of rows) {
      const id = String(row[key]);
      const values = grouped.get(id) || [];
      values.push(row);
      grouped.set(id, values);
    }
    return grouped;
  }
}
