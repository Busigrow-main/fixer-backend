import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { RolesGuard } from './guards/roles.guard';
import { EmailOtpService } from './email-otp.service';
import { AzureEmailService } from './azure-email.service';
import {
  EmailOtpSession,
  EmailOtpSessionSchema,
} from './schemas/email-otp-session.schema';
import { jwtSecret } from '../common/jwt-secret';
import { QuickLoginRateLimitGuard } from './guards/quick-login-rate-limit.guard';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    MongooseModule.forFeature([
      { name: EmailOtpSession.name, schema: EmailOtpSessionSchema },
    ]),
    JwtModule.register({
      secret: jwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    RolesGuard,
    QuickLoginRateLimitGuard,
    EmailOtpService,
    AzureEmailService,
  ],
  controllers: [AuthController],
  exports: [AuthService, RolesGuard, JwtModule, AzureEmailService],
})
export class AuthModule {}
