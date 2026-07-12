import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RefreshToken, RefreshTokenDocument } from '../schemas/refresh-token.schema';
import { UsersService } from '../../users/users.service';
import { UserDocument } from '../../users/schemas/user.schema';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  async issueTokens(user: UserDocument): Promise<AuthTokens> {
    const payload = {
      sub: user._id.toString(),
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(
      Date.now() + this.parseDuration(process.env.JWT_REFRESH_EXPIRES_IN || '30d'),
    );

    await this.refreshTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    const tokens = await this.refreshTokenModel
      .find({ revokedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    for (const stored of tokens) {
      if (stored.expiresAt < new Date()) continue;
      const match = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (!match) continue;

      const user = await this.usersService.findById(stored.userId.toString());
      if (!user) throw new UnauthorizedException('Invalid refresh token');

      await this.refreshTokenModel.findByIdAndUpdate(stored._id, {
        revokedAt: new Date(),
      });

      return this.issueTokens(user);
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  async revoke(refreshToken: string): Promise<void> {
    const tokens = await this.refreshTokenModel
      .find({ revokedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    for (const stored of tokens) {
      const match = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (match) {
        await this.refreshTokenModel.findByIdAndUpdate(stored._id, {
          revokedAt: new Date(),
        });
        return;
      }
    }
  }

  private parseDuration(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * multipliers[unit];
  }
}
