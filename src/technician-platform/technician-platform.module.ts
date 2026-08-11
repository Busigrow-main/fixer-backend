import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TechniciansModule } from '../technicians/technicians.module';
import { BookingsModule } from '../bookings/bookings.module';
import { VisitsModule } from '../visits/visits.module';
import { SparePartsModule } from '../spare-parts/spare-parts.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { WarrantiesModule } from '../warranties/warranties.module';

import { OtpSession, OtpSessionSchema } from './schemas/otp-session.schema';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema';
import { AllowedPincode, AllowedPincodeSchema } from './schemas/allowed-pincode.schema';
import { PaymentOrder, PaymentOrderSchema } from './schemas/payment-order.schema';
import {
  VerificationDocument,
  VerificationDocumentSchema,
} from './schemas/verification-document.schema';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { Earning, EarningSchema } from './schemas/earning.schema';
import { OnboardingEvent, OnboardingEventSchema } from './schemas/onboarding-event.schema';
import { OnboardingCall, OnboardingCallSchema } from './schemas/onboarding-call.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { Technician, TechnicianSchema } from '../technicians/schemas/technician.schema';
import { SparePart, SparePartSchema } from '../spare-parts/schemas/spare-part.schema';
import {
  SparePartUsage,
  SparePartUsageSchema,
} from '../visits/schemas/spare-part-usage.schema';

import { OtpService } from './common/otp.service';
import { TokenService } from './common/token.service';
import { OnboardingProgressHelper } from './common/onboarding-progress.helper';
import { TechnicianGuard } from './common/technician.guard';

import { TechnicianAuthController } from './auth/technician-auth.controller';
import { TechnicianAuthService } from './auth/technician-auth.service';
import { TechnicianOnboardingController } from './onboarding/technician-onboarding.controller';
import { TechnicianOnboardingService } from './onboarding/technician-onboarding.service';
import { TechnicianVerificationController } from './verification/technician-verification.controller';
import { TechnicianVerificationService } from './verification/technician-verification.service';
import { TechnicianDashboardController } from './dashboard/technician-dashboard.controller';
import { TechnicianDashboardService } from './dashboard/technician-dashboard.service';
import { TechnicianJobsController } from './jobs/technician-jobs.controller';
import { TechnicianJobsService } from './jobs/technician-jobs.service';
import { JobCompletionService } from './job-completion/job-completion.service';
import { JobSheetService } from './job-sheet/job-sheet.service';
import { TechnicianSparePartsController } from './job-sheet/technician-spare-parts.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { EarningsController } from './earnings/earnings.controller';
import { EarningsService } from './earnings/earnings.service';
import { TechnicianProfileController } from './profile/technician-profile.controller';
import { TechnicianProfileService } from './profile/technician-profile.service';
import { TechnicianPlatformAdminController } from './admin/technician-platform-admin.controller';
import { TechnicianAdminService } from './admin/technician-admin.service';
import { OnboardingAnalyticsService } from './analytics/onboarding-analytics.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    TechniciansModule,
    BookingsModule,
    VisitsModule,
    SparePartsModule,
    DispatchModule,
    WarrantiesModule,
    MongooseModule.forFeature([
      { name: OtpSession.name, schema: OtpSessionSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: AllowedPincode.name, schema: AllowedPincodeSchema },
      { name: PaymentOrder.name, schema: PaymentOrderSchema },
      { name: VerificationDocument.name, schema: VerificationDocumentSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Earning.name, schema: EarningSchema },
      { name: OnboardingEvent.name, schema: OnboardingEventSchema },
      { name: OnboardingCall.name, schema: OnboardingCallSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Technician.name, schema: TechnicianSchema },
      { name: SparePart.name, schema: SparePartSchema },
      { name: SparePartUsage.name, schema: SparePartUsageSchema },
    ]),
  ],
  controllers: [
    TechnicianAuthController,
    TechnicianOnboardingController,
    TechnicianVerificationController,
    TechnicianDashboardController,
    TechnicianJobsController,
    TechnicianSparePartsController,
    NotificationsController,
    EarningsController,
    TechnicianProfileController,
    TechnicianPlatformAdminController,
  ],
  providers: [
    OtpService,
    TokenService,
    OnboardingProgressHelper,
    TechnicianGuard,
    TechnicianAuthService,
    TechnicianOnboardingService,
    TechnicianVerificationService,
    TechnicianDashboardService,
    TechnicianJobsService,
    JobCompletionService,
    JobSheetService,
    NotificationsService,
    EarningsService,
    TechnicianProfileService,
    TechnicianAdminService,
    OnboardingAnalyticsService,
  ],
})
export class TechnicianPlatformModule {}
