import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../../users/users.service';
import { TechniciansService } from '../../technicians/technicians.service';
import { OtpService } from '../common/otp.service';
import { TokenService } from '../common/token.service';
import { OnboardingAnalyticsService } from '../analytics/onboarding-analytics.service';
import { Technician, TechnicianDocument } from '../../technicians/schemas/technician.schema';

@Injectable()
export class TechnicianAuthService {
  constructor(
    private usersService: UsersService,
    private techniciansService: TechniciansService,
    private otpService: OtpService,
    private tokenService: TokenService,
    private analyticsService: OnboardingAnalyticsService,
    @InjectModel(Technician.name)
    private technicianModel: Model<TechnicianDocument>,
  ) {}

  sendOtp(phone: string) {
    return this.otpService.sendOtp(phone);
  }

  async verifyOtp(phone: string, code: string) {
    const valid = await this.otpService.verifyOtp(phone, code);
    if (!valid) throw new UnauthorizedException('Invalid or expired OTP');

    let user = await this.usersService.findOneByPhone(phone);
    let technician = await this.technicianModel.findOne({ phone }).exec();
    let isNew = false;

    if (!user) {
      isNew = true;
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      user = await this.usersService.create({
        phone,
        passwordHash,
        role: 'TECHNICIAN',
        fullName: technician?.name,
      });
    } else if (user.role !== 'TECHNICIAN' && user.role !== 'ADMIN') {
      throw new ConflictException('Phone number registered as customer');
    }

    if (!technician) {
      isNew = true;
      await this.techniciansService.create({
        userId: user._id,
        name: user.fullName || 'Technician',
        phone,
        onboardingStatus: 'DRAFT',
        isActive: false,
        verificationStatus: 'NOT_REQUESTED',
      });
      technician = await this.technicianModel.findOne({ phone }).exec();
      await this.usersService.updateRole(user._id.toString(), 'TECHNICIAN');
    } else if (!technician.userId) {
      await this.techniciansService.update(technician._id.toString(), {
        userId: user._id,
      });
    }

    if (!technician) {
      throw new UnauthorizedException('Technician profile could not be created');
    }

    await this.analyticsService.logEvent(
      technician._id.toString(),
      'OTP_VERIFIED',
      1,
      { isNew },
    );

    const tokens = await this.tokenService.issueTokens(user);
    return {
      ...tokens,
      user: this.sanitizeUser(user, technician),
      isNew,
    };
  }

  refresh(refreshToken: string) {
    return this.tokenService.refresh(refreshToken);
  }

  logout(refreshToken: string) {
    return this.tokenService.revoke(refreshToken);
  }

  private sanitizeUser(user: any, technician: TechnicianDocument) {
    const { passwordHash, ...userData } = user.toObject?.() || user;
    return {
      ...userData,
      technician: {
        id: technician._id,
        name: technician.name,
        phone: technician.phone,
        onboardingStatus: technician.onboardingStatus,
        verificationStatus: technician.verificationStatus,
        profileCompleted: technician.profileCompleted,
        joiningFeePaid: technician.joiningFeePaid,
        idVerified: technician.idVerified,
        isActive: technician.isActive,
      },
    };
  }
}
