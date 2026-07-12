import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Technician, TechnicianDocument } from './schemas/technician.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
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
    return this.update(id, { isActive: false });
  }
}
