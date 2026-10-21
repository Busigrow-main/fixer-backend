import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TechnicianAuthService } from './technician-auth.service';
import { PhoneBodyDto, RefreshTokenDto, VerifyOtpDto } from '../../common/body.dto';

@ApiTags('Technician auth')
@Controller('v1/auth')
export class TechnicianAuthController {
  constructor(private readonly authService: TechnicianAuthService) {}

  @Post('send-otp')
  @ApiOperation({ summary: 'Send technician login OTP' })
  sendOtp(@Body() body: PhoneBodyDto) {
    return this.authService.sendOtp(body.phone);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify technician OTP and return JWT' })
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body.phone, body.otp);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh technician JWT' })
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Invalidate technician refresh token' })
  logout(@Body() body: RefreshTokenDto) {
    return this.authService.logout(body.refreshToken);
  }
}
