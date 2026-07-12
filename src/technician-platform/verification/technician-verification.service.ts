import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TechniciansService } from '../../technicians/technicians.service';
import { NotificationDispatchService } from '../common/notification-dispatch.service';
import { OnboardingAnalyticsService } from '../analytics/onboarding-analytics.service';
import {
  VerificationDocument,
  VerificationDocumentDocument,
} from '../schemas/verification-document.schema';

@Injectable()
export class TechnicianVerificationService {
  constructor(
    private techniciansService: TechniciansService,
    private notificationDispatch: NotificationDispatchService,
    private analyticsService: OnboardingAnalyticsService,
    @InjectModel(VerificationDocument.name)
    private documentModel: Model<VerificationDocumentDocument>,
  ) {}

  async uploadDocument(
    technicianId: string,
    documentType: string,
    fileUrl: string,
  ) {
    const doc = await this.documentModel.create({
      technicianId: new Types.ObjectId(technicianId),
      documentType,
      fileUrl,
      status: 'PENDING',
    });

    await this.techniciansService.update(technicianId, {
      verificationStatus: 'PENDING',
    });

    await this.analyticsService.logEvent(technicianId, 'ID_UPLOADED', 4, {
      documentType,
    });

    return { status: 'PENDING', documentId: doc._id };
  }

  async getStatus(technicianId: string) {
    const technician = await this.techniciansService.findOne(technicianId);
    const documents = await this.documentModel
      .find({ technicianId: new Types.ObjectId(technicianId) })
      .sort({ createdAt: -1 })
      .exec();

    return {
      status: technician.verificationStatus,
      documents,
    };
  }

  async requestUpload(technicianId: string) {
    const technician = await this.techniciansService.findOne(technicianId);
    await this.techniciansService.update(technicianId, {
      verificationStatus: 'REQUESTED',
    });

    await this.notificationDispatch.notify(
      technicianId,
      'VERIFICATION_REQUESTED',
      'ID verification required',
      'Please upload your Aadhaar, PAN, or Driving License to continue.',
    );

    await this.analyticsService.logEvent(technicianId, 'ID_REQUESTED', 4);
    return { status: 'REQUESTED' };
  }

  async listForAdmin(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    return this.documentModel
      .find(filter)
      .populate('technicianId', 'name phone city pincode')
      .sort({ createdAt: -1 })
      .exec();
  }

  async approve(documentId: string, adminUserId: string) {
    const doc = await this.documentModel.findById(documentId).exec();
    if (!doc) throw new NotFoundException('Document not found');

    doc.status = 'VERIFIED';
    doc.reviewedAt = new Date();
    doc.reviewedBy = new Types.ObjectId(adminUserId);
    await doc.save();

    const technicianId = doc.technicianId.toString();
    const pending = await this.documentModel.countDocuments({
      technicianId: doc.technicianId,
      status: 'PENDING',
    });

    if (pending === 0) {
      await this.techniciansService.update(technicianId, {
        verificationStatus: 'VERIFIED',
        idVerified: true,
        isActive: true,
        onboardingStatus: 'COMPLETED',
        onboardingCompletedAt: new Date(),
        approvedAt: new Date(),
      });
      await this.analyticsService.logEvent(technicianId, 'ID_VERIFIED', 5);
      await this.analyticsService.logEvent(technicianId, 'ONBOARDING_COMPLETED', 5);
    }

    return doc;
  }

  async reject(documentId: string, reason: string, adminUserId: string) {
    const doc = await this.documentModel.findById(documentId).exec();
    if (!doc) throw new NotFoundException('Document not found');

    doc.status = 'REJECTED';
    doc.rejectionReason = reason;
    doc.reviewedAt = new Date();
    doc.reviewedBy = new Types.ObjectId(adminUserId);
    await doc.save();

    await this.techniciansService.update(doc.technicianId.toString(), {
      verificationStatus: 'REJECTED',
      idVerified: false,
      rejectionReason: reason,
    });

    await this.notificationDispatch.notify(
      doc.technicianId.toString(),
      'VERIFICATION_REJECTED',
      'ID verification rejected',
      reason,
    );

    return doc;
  }
}
