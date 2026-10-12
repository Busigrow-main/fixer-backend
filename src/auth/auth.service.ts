import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EmailOtpService } from './email-otp.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailOtpService: EmailOtpService,
  ) {}

  normalizeEmail(raw: string): string {
    return String(raw || '').trim().toLowerCase();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Shared default for quick sign-in / auto-created accounts (override via env). */
  defaultCustomerPassword(): string {
    return process.env.DEFAULT_CUSTOMER_PASSWORD || 'fixxer123';
  }

  normalizePhone(raw: string): string {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
    return digits;
  }

  private async findUserByPhone(raw: string) {
    const normalized = this.normalizePhone(raw);
    if (!normalized || normalized.length < 10) return null;
    let user = await this.usersService.findOneByPhone(normalized);
    if (!user && raw.trim() !== normalized) {
      user = await this.usersService.findOneByPhone(raw.trim());
    }
    return user;
  }

  async validateUser(phone: string, pass: string): Promise<any> {
    const user = await this.findUserByPhone(phone);
    if (!user) return null;

    const defaultPass = this.defaultCustomerPassword();
    const ok =
      (await bcrypt.compare(pass, user.passwordHash)) || pass === defaultPass;
    if (!ok) return null;

    const { passwordHash, ...result } = user.toObject();
    return result;
  }

  async login(user: any) {
    const payload = {
      phone: user.phone,
      sub: user._id,
      role: user.role || 'CUSTOMER',
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(registerDto: any) {
    const phone = this.normalizePhone(registerDto.phone);
    if (!phone || phone.length < 10) {
      throw new BadRequestException('Enter a valid 10-digit phone number');
    }
    const password = registerDto.password || this.defaultCustomerPassword();
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);
    return this.usersService.create({
      phone,
      passwordHash,
      fullName: registerDto.fullName?.trim() || undefined,
      email: registerDto.email?.trim() || undefined,
    });
  }

  /**
   * Phone-only sign-in for customers: find existing user or create one with the
   * default password, then return a JWT. Keeps booking friction low.
   */
  async quickLogin(phone: string, fullName?: string) {
    const normalized = this.normalizePhone(phone);
    if (!normalized || normalized.length < 10) {
      throw new BadRequestException('Enter a valid 10-digit phone number');
    }

    let user = await this.findUserByPhone(normalized);
    if (!user) {
      const salt = await bcrypt.genSalt();
      const passwordHash = await bcrypt.hash(this.defaultCustomerPassword(), salt);
      user = await this.usersService.create({
        phone: normalized,
        passwordHash,
        fullName: fullName?.trim() || undefined,
      });
    } else if (fullName?.trim() && !user.fullName) {
      user.fullName = fullName.trim();
      await user.save();
    }

    return this.login(user);
  }

  async sendEmailOtp(email: string) {
    const normalized = this.normalizeEmail(email);
    if (!this.isValidEmail(normalized)) {
      throw new BadRequestException('Enter a valid email address');
    }
    return this.emailOtpService.sendOtp(normalized);
  }

  /**
   * Verify email OTP and issue a JWT.
   * Existing users are found by email. New users need a phone number
   * (accounts are still phone-keyed).
   */
  async verifyEmailOtp(
    email: string,
    otp: string,
    options?: { phone?: string; fullName?: string },
  ) {
    const normalized = this.normalizeEmail(email);
    if (!this.isValidEmail(normalized)) {
      throw new BadRequestException('Enter a valid email address');
    }
    if (!otp || String(otp).trim().length < 4) {
      throw new BadRequestException('Enter the OTP from your email');
    }

    const valid = await this.emailOtpService.verifyOtp(
      normalized,
      String(otp).trim(),
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    let user = await this.usersService.findOneByEmail(normalized);
    if (!user) {
      const phone = this.normalizePhone(options?.phone || '');
      if (!phone || phone.length < 10) {
        throw new BadRequestException(
          'No account for this email yet. Provide a 10-digit phone to create one.',
        );
      }

      const existingPhone = await this.findUserByPhone(phone);
      if (existingPhone) {
        existingPhone.email = normalized;
        if (options?.fullName?.trim() && !existingPhone.fullName) {
          existingPhone.fullName = options.fullName.trim();
        }
        await existingPhone.save();
        user = existingPhone;
      } else {
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(
          this.defaultCustomerPassword(),
          salt,
        );
        user = await this.usersService.create({
          phone,
          email: normalized,
          passwordHash,
          fullName: options?.fullName?.trim() || undefined,
        });
      }
    } else if (options?.fullName?.trim() && !user.fullName) {
      user.fullName = options.fullName.trim();
      await user.save();
    }

    return this.login(user);
  }

  /**
   * Sign in with a Google ID token. Mobile number is collected later on the booking form.
   */
  async loginWithGoogle(
    idToken: string,
    options?: { phone?: string; fullName?: string },
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      throw new BadRequestException(
        'Google sign-in is not configured (missing GOOGLE_CLIENT_ID)',
      );
    }
    if (!idToken?.trim()) {
      throw new BadRequestException('Google sign-in token is required');
    }

    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(clientId);
    let payload: {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      name?: string;
    };
    try {
      const ticket = await client.verifyIdToken({
        idToken: idToken.trim(),
        audience: clientId,
      });
      payload = ticket.getPayload() || {};
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in token');
    }

    const googleId = payload.sub;
    const email = this.normalizeEmail(payload.email || '');
    const emailVerified =
      payload.email_verified === true || payload.email_verified === 'true';
    const googleName = payload.name?.trim();

    if (!googleId || !email || !emailVerified) {
      throw new UnauthorizedException(
        'Google account must have a verified email',
      );
    }

    let user =
      (await this.usersService.findOneByGoogleId(googleId)) ||
      (await this.usersService.findOneByEmail(email));

    if (user) {
      let dirty = false;
      if (!user.googleId) {
        user.googleId = googleId;
        dirty = true;
      }
      if (!user.email) {
        user.email = email;
        dirty = true;
      }
      const name = options?.fullName?.trim() || googleName;
      if (name && !user.fullName) {
        user.fullName = name;
        dirty = true;
      }
      if (dirty) await user.save();
      return this.login(user);
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(
      this.defaultCustomerPassword(),
      salt,
    );
    user = await this.usersService.create({
      email,
      googleId,
      passwordHash,
      fullName: options?.fullName?.trim() || googleName || undefined,
    });
    return this.login(user);
  }
}
