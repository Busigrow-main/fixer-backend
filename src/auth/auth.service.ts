import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

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
}
