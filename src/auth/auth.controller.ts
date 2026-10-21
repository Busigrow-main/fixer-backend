import { Controller, Request, Post, UseGuards, Body, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JWT_AUTH } from '../common/swagger';
import {
  AuthTokenResponseDto,
  GoogleLoginDto,
  LoginDto,
  QuickLoginDto,
  RegisterDto,
  SendEmailOtpDto,
  VerifyEmailOtpDto,
} from './dtos/auth.dto';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a customer and return a JWT' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    return this.authService.login(user);
  }

  /** Phone-only customer sign-in (creates account if needed). */
  @Post('quick-login')
  @ApiOperation({ summary: 'Phone-only customer sign-in (creates account if needed)' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  async quickLogin(@Body() body: QuickLoginDto) {
    return this.authService.quickLogin(body.phone, body.fullName);
  }

  /** Send a 6-digit login code to the given email via Azure Communication Services. */
  @Post('send-email-otp')
  @ApiOperation({ summary: 'Send a 6-digit login code to email' })
  async sendEmailOtp(@Body() body: SendEmailOtpDto) {
    return this.authService.sendEmailOtp(body.email);
  }

  /**
   * Verify the email OTP and return a JWT.
   * New accounts also need phone (accounts remain phone-keyed).
   */
  @Post('verify-email-otp')
  @ApiOperation({ summary: 'Verify email OTP and return a JWT' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  async verifyEmailOtp(@Body() body: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(body.email, body.otp, {
      phone: body.phone,
      fullName: body.fullName,
    });
  }

  /** Google Identity Services ID token → Fixxer JWT. Phone is collected on the booking form. */
  @Post('google')
  @ApiOperation({ summary: 'Google Identity Services ID token → Fixxer JWT' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  async googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.loginWithGoogle(body.idToken, {
      fullName: body.fullName,
    });
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @ApiBody({ type: LoginDto })
  @ApiOperation({ summary: 'Phone + password login' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiBearerAuth(JWT_AUTH)
  @ApiOperation({ summary: 'Current user profile' })
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) return req.user;
    const { passwordHash, ...userData } = user.toObject();
    return userData;
  }
}
