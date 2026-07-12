import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OtpSession, OtpSessionDocument } from '../schemas/otp-session.schema';

@Injectable()
export class OtpService {
  constructor(
    @InjectModel(OtpSession.name)
    private otpModel: Model<OtpSessionDocument>,
  ) {}

  async sendOtp(phone: string): Promise<{ sent: boolean; devOtp?: string }> {
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.otpModel.deleteMany({ phone }).exec();
    await this.otpModel.create({ phone, codeHash, expiresAt });

    // TODO: integrate SMS provider (MSG91, Twilio, etc.)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP] ${phone}: ${code}`);
      return { sent: true, devOtp: code };
    }

    return { sent: true };
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const session = await this.otpModel
      .findOne({ phone, verified: false })
      .sort({ createdAt: -1 })
      .exec();

    if (!session) return false;
    if (session.expiresAt < new Date()) return false;
    if (session.attempts >= 5) return false;

    const valid = await bcrypt.compare(code, session.codeHash);
    if (!valid) {
      await this.otpModel.findByIdAndUpdate(session._id, { $inc: { attempts: 1 } });
      return false;
    }

    await this.otpModel.findByIdAndUpdate(session._id, { verified: true });
    return true;
  }

  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }
}
