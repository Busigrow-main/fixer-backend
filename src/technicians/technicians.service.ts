import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EMPLOYMENT_TYPES, Technician, TechnicianDocument } from './schemas/technician.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { activeJobQuery } from '../technician-engine/technician-engine';
import {
  VerificationDocument,
  VerificationDocumentDocument,
} from '../technician-platform/schemas/verification-document.schema';

@Injectable()
export class TechniciansService {
  constructor(
    @InjectModel(Technician.name) private technicianModel: Model<TechnicianDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(VerificationDocument.name)
    private verificationDocModel: Model<VerificationDocumentDocument>,
  ) {}

  async create(createData: any): Promise<Technician> {
    const createdTechnician = new this.technicianModel(createData);
    return createdTechnician.save();
  }

  async findAll(): Promise<Technician[]> {
    return this.technicianModel.find().exec();
  }

  /**
   * Assign pool: active partners that are AVAILABLE, plus active Fixxer staff that are
   * not switched off (staff are scheduled into slots, so being on a job now doesn't
   * hide them — the slot check decides).
   */
  async findAvailable(): Promise<Technician[]> {
    return this.technicianModel
      .find({
        isActive: true,
        $or: [
          { availabilityStatus: 'AVAILABLE' },
          { employmentType: 'FIXXER_STAFF', availabilityStatus: { $ne: 'UNAVAILABLE' } },
        ],
      })
      .exec();
  }

  async findApplications(status?: string): Promise<Technician[]> {
    const filter: Record<string, unknown> = {
      onboardingStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'REJECTED'] },
    };

    if (status) {
      filter.onboardingStatus = status;
    }

    return this.technicianModel.find(filter).sort({ submittedAt: -1 }).exec();
  }

  async findOne(id: string): Promise<TechnicianDocument> {
    const technician = await this.technicianModel.findById(id).exec();
    if (!technician) throw new NotFoundException('Technician not found');
    return technician;
  }

  async findByUserId(userId: string): Promise<TechnicianDocument | null> {
    return this.technicianModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  async getTechnicianWithJobs(id: string) {
    const technician = await this.findOne(id);
    const jobs = await this.bookingModel
      .find({ technicianId: id })
      .populate('userId', 'fullName phone')
      .populate('serviceId', 'name')
      .sort({ createdAt: -1 })
      .exec();

    return {
      technician,
      jobs,
    };
  }

  async update(id: string, updateData: any): Promise<Technician> {
    const existingTechnician = await this.technicianModel
      .findByIdAndUpdate(id, updateData, { returnDocument: 'after' })
      .exec();
    if (!existingTechnician) {
      throw new NotFoundException('Technician not found');
    }
    return existingTechnician;
  }

  /** Put an ON_JOB technician back to AVAILABLE. Leaves UNAVAILABLE (off duty) untouched. */
  async releaseFromJob(technicianId: string): Promise<boolean> {
    const res = await this.technicianModel
      .updateOne(
        { _id: technicianId, availabilityStatus: 'ON_JOB' },
        { $set: { availabilityStatus: 'AVAILABLE' } },
      )
      .exec();
    return res.modifiedCount > 0;
  }

  /**
   * True when the technician still holds an open booking (optionally ignoring one).
   */
  async hasActiveJob(technicianId: string, excludeBookingId?: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(technicianId)) return false;
    const filter: Record<string, unknown> = {
      ...activeJobQuery(),
      technicianId: new Types.ObjectId(technicianId),
    };
    if (excludeBookingId && Types.ObjectId.isValid(excludeBookingId)) {
      filter._id = { $ne: new Types.ObjectId(excludeBookingId) };
    }
    return !!(await this.bookingModel.exists(filter).exec());
  }

  /**
   * totalCompletedJobs is derived from bookings, never incremented in place, so it
   * can't drift (admin-closed jobs count too; repeated calls are harmless).
   */
  async recountCompletedJobs(technicianId: string): Promise<number> {
    if (!Types.ObjectId.isValid(technicianId)) return 0;
    const total = await this.bookingModel
      .countDocuments({
        technicianId: new Types.ObjectId(technicianId),
        status: { $in: ['COMPLETED', 'PAYMENT_COLLECTED'] },
      })
      .exec();
    await this.technicianModel
      .updateOne({ _id: technicianId }, { $set: { totalCompletedJobs: total } })
      .exec();
    return total;
  }

  /** A technician holding an open job can't be deactivated — they'd lose app access mid-job. */
  async assertCanDeactivate(technicianId: string): Promise<void> {
    if (await this.hasActiveJob(technicianId)) {
      throw new BadRequestException(
        'This technician has an open job. Reassign or unassign it before deactivating.',
      );
    }
  }

  /**
   * PARTNER ↔ FIXXER_STAFF. Moving staff to PARTNER while they still hold scheduled,
   * not-finished jobs would leave slots no one manages — move/reassign those first.
   */
  async assertCanChangeEmploymentType(technicianId: string, next: unknown): Promise<void> {
    if (!(EMPLOYMENT_TYPES as readonly unknown[]).includes(next)) {
      throw new BadRequestException(`employmentType must be ${EMPLOYMENT_TYPES.join(' or ')}`);
    }
    if (next !== 'PARTNER' || !Types.ObjectId.isValid(technicianId)) return;
    const holdsSlots = await this.bookingModel
      .exists({
        ...activeJobQuery(),
        technicianId: new Types.ObjectId(technicianId),
        scheduledStart: { $ne: null },
      })
      .exec();
    if (holdsSlots) {
      throw new BadRequestException(
        'This technician still has scheduled jobs. Reassign or finish them before switching to Partner.',
      );
    }
  }

  async approveApplication(id: string): Promise<Technician> {
    const technician = await this.findOne(id);

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(technician.onboardingStatus)) {
      throw new BadRequestException('Only submitted applications can be approved');
    }

    return this.update(id, {
      onboardingStatus: 'APPROVED',
      isActive: true,
      approvedAt: new Date(),
      rejectionReason: undefined,
    });
  }

  async rejectApplication(id: string, reason: string): Promise<Technician> {
    const technician = await this.findOne(id);

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(technician.onboardingStatus)) {
      throw new BadRequestException('Only submitted applications can be rejected');
    }

    return this.update(id, {
      onboardingStatus: 'REJECTED',
      isActive: false,
      rejectionReason: reason,
    });
  }

  async remove(id: string): Promise<any> {
    return this.technicianModel.findByIdAndDelete(id).exec();
  }

  async getVerification(technicianId: string) {
    const technician = await this.findOne(technicianId);
    const documents = await this.verificationDocModel
      .find({ technicianId: new Types.ObjectId(technicianId) })
      .sort({ createdAt: -1 })
      .exec();

    return {
      technician: {
        _id: technician._id,
        name: technician.name,
        phone: technician.phone,
        verificationStatus: technician.verificationStatus,
        idVerified: technician.idVerified,
        onboardingStatus: technician.onboardingStatus,
        profileCompleted: technician.profileCompleted,
        joiningFeePaid: technician.joiningFeePaid,
        aadhaarNumber: technician.aadhaarNumber,
        panNumber: technician.panNumber,
        pincode: technician.pincode,
        city: technician.city,
        address: technician.address,
        rejectionReason: technician.rejectionReason,
      },
      documents,
    };
  }

  async listVerifications(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    return this.verificationDocModel
      .find(filter)
      .populate('technicianId', 'name phone city pincode verificationStatus')
      .sort({ createdAt: -1 })
      .exec();
  }

  async requestVerification(technicianId: string) {
    await this.findOne(technicianId);
    return this.update(technicianId, { verificationStatus: 'REQUESTED' });
  }

  async approveVerificationDocument(documentId: string, adminUserId?: string) {
    const doc = await this.verificationDocModel.findById(documentId).exec();
    if (!doc) throw new NotFoundException('Document not found');

    doc.status = 'VERIFIED';
    doc.reviewedAt = new Date();
    if (adminUserId) doc.reviewedBy = new Types.ObjectId(adminUserId);
    await doc.save();

    const technicianId = doc.technicianId.toString();
    const pending = await this.verificationDocModel.countDocuments({
      technicianId: doc.technicianId,
      status: 'PENDING',
    });

    if (pending === 0) {
      await this.update(technicianId, {
        verificationStatus: 'VERIFIED',
        idVerified: true,
        isActive: true,
        onboardingStatus: 'COMPLETED',
        onboardingCompletedAt: new Date(),
        approvedAt: new Date(),
        rejectionReason: undefined,
      });
    }

    return doc;
  }

  async rejectVerificationDocument(
    documentId: string,
    reason: string,
    adminUserId?: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const doc = await this.verificationDocModel.findById(documentId).exec();
    if (!doc) throw new NotFoundException('Document not found');

    doc.status = 'REJECTED';
    doc.rejectionReason = reason;
    doc.reviewedAt = new Date();
    if (adminUserId) doc.reviewedBy = new Types.ObjectId(adminUserId);
    await doc.save();

    await this.update(doc.technicianId.toString(), {
      verificationStatus: 'REJECTED',
      idVerified: false,
      isActive: false,
      rejectionReason: reason,
    });

    return doc;
  }

  async activate(id: string) {
    return this.update(id, { isActive: true });
  }

  async deactivate(id: string) {
    await this.assertCanDeactivate(id);
    return this.update(id, { isActive: false });
  }
}
