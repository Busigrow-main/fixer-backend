import { Controller, Request, Post, UseGuards, Body, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: any) {
    const user = await this.authService.register(registerDto);
    return this.authService.login(user);
  }

  /** Phone-only customer sign-in (creates account if needed). */
  @Post('quick-login')
  async quickLogin(@Body() body: { phone: string; fullName?: string }) {
    return this.authService.quickLogin(body.phone, body.fullName);
  }

  /** Send a 6-digit login code to the given email via Azure Communication Services. */
  @Post('send-email-otp')
  async sendEmailOtp(@Body() body: { email: string }) {
    return this.authService.sendEmailOtp(body.email);
  }

  /**
   * Verify the email OTP and return a JWT.
   * New accounts also need phone (accounts remain phone-keyed).
   */
  @Post('verify-email-otp')
  async verifyEmailOtp(
    @Body()
    body: {
      email: string;
      otp: string;
      phone?: string;
      fullName?: string;
    },
  ) {
    return this.authService.verifyEmailOtp(body.email, body.otp, {
      phone: body.phone,
      fullName: body.fullName,
    });
  }

  /** Google Identity Services ID token → Fixxer JWT. Phone is collected on the booking form. */
  @Post('google')
  async googleLogin(@Body() body: { idToken: string; fullName?: string }) {
    return this.authService.loginWithGoogle(body.idToken, {
      fullName: body.fullName,
    });
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) return req.user;
    const { passwordHash, ...userData } = user.toObject();
    return userData;
  }
}

