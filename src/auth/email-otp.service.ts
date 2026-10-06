import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  EmailOtpSession,
  EmailOtpSessionDocument,
} from './schemas/email-otp-session.schema';
import { AzureEmailService } from './azure-email.service';

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    @InjectModel(EmailOtpSession.name)
    private otpModel: Model<EmailOtpSessionDocument>,
    private azureEmail: AzureEmailService,
  ) {}

  async sendOtp(email: string): Promise<{ sent: boolean; devOtp?: string }> {
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.otpModel.deleteMany({ email }).exec();
    await this.otpModel.create({ email, codeHash, expiresAt });

    const isProd = process.env.NODE_ENV === 'production';
    const azureConfigured =
      !!process.env.AZURE_COMMUNICATION_CONNECTION_STRING &&
      !!process.env.AZURE_EMAIL_SENDER;

    if (azureConfigured) {
      await this.azureEmail.sendOtpEmail(email, code);
      return { sent: true };
    }

    if (isProd) {
      throw new Error('Azure email is not configured in production');
    }

    this.logger.log(`[EMAIL OTP] ${email}: ${code}`);
    return { sent: true, devOtp: code };
  }

  async verifyOtp(email: string, code: string): Promise<boolean> {
    const session = await this.otpModel
      .findOne({ email, verified: false })
      .sort({ createdAt: -1 })
      .exec();

    if (!session) return false;
    if (session.expiresAt < new Date()) return false;
    if (session.attempts >= 5) return false;

    const valid = await bcrypt.compare(code, session.codeHash);
    if (!valid) {
      await this.otpModel.findByIdAndUpdate(session._id, {
        $inc: { attempts: 1 },
      });
      return false;
    }

    await this.otpModel.findByIdAndUpdate(session._id, { verified: true });
    return true;
  }

  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }
}
