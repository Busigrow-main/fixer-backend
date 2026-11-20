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
  ) {}

  async getCustomerServiceHistory(
    customerId: string,
    pageRaw = 1,
    limitRaw = 20,
  ) {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new BadRequestException('Invalid customerId');
    }
    const page = this.paginationValue(pageRaw, 'page');
    const limit = this.paginationValue(limitRaw, 'limit');
    if (limit > 100) throw new BadRequestException('limit cannot exceed 100');

    const customer = await this.userModel
      .findById(customerId)
      .select('_id fullName phone email role createdAt')
      .lean()
      .exec();
    if (!customer || customer.role !== 'CUSTOMER') {
      throw new NotFoundException('Customer not found');
    }

    // Legacy booking rows may contain userId as a string despite the schema ref.
    const userIdFilter = {
      $or: [{ userId: new Types.ObjectId(customerId) }, { userId: customerId }],
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
        historyLimitations: [
          'Only records linked to bookings owned by this customer are included.',
          'Unlinked appliance mappings cannot be safely attributed by phone number alone.',
        ],
      };
    }

    const [appliances, visits, partTransactions, feedbackRows, warranties] =
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

    return {
      customer,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      appliances: applianceRows,
      bookings: bookingRows,
      historyLimitations: [
        'Booking results are paginated; appliance serviceBookingIds cover the bookings on this page.',
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
