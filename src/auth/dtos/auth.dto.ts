import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: '9876543210' })
  phone: string;

  @ApiPropertyOptional({ example: 'secret123' })
  password?: string;

  @ApiPropertyOptional({ example: 'Asha Rao' })
  fullName?: string;

  @ApiPropertyOptional({ example: 'asha@example.com' })
  email?: string;
}

export class QuickLoginDto {
  @ApiProperty({ example: '9876543210' })
  phone: string;

  @ApiPropertyOptional({ example: 'Asha Rao' })
  fullName?: string;
}

export class LoginDto {
  @ApiProperty({ example: '9999999999' })
  phone: string;

  @ApiProperty({ example: 'admin123' })
  password: string;
}

export class SendEmailOtpDto {
  @ApiProperty({ example: 'asha@example.com' })
  email: string;
}

export class VerifyEmailOtpDto {
  @ApiProperty({ example: 'asha@example.com' })
  email: string;

  @ApiProperty({ example: '123456' })
  otp: string;

  @ApiPropertyOptional({ example: '9876543210' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Asha Rao' })
  fullName?: string;
}

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google Identity Services ID token' })
  idToken: string;

  @ApiPropertyOptional({ example: 'Asha Rao' })
  fullName?: string;
}

export class AuthTokenResponseDto {
  @ApiProperty()
  access_token: string;
}
