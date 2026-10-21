import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class ReasonDto {
  @ApiProperty({ example: 'Ordered the wrong model' })
  reason: string;
}

export class PhoneBodyDto {
  @ApiProperty({ example: '9876543210' })
  phone: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  refreshToken: string;
}

export class NoteDto {
  @ApiProperty()
  note: string;
}

export class RoleBodyDto {
  @ApiProperty({ enum: ['CUSTOMER', 'ADMIN'] })
  role: 'CUSTOMER' | 'ADMIN';
}

export class AssignTechnicianDto {
  @ApiProperty()
  technicianId: string;
}

export class BookingIdDto {
  @ApiProperty()
  bookingId: string;
}

export class TrackingDto {
  @ApiProperty({ example: 'Delhivery' })
  courierName: string;

  @ApiProperty({ example: 'DL123456789' })
  trackingNumber: string;
}

export class StatusReasonDto {
  @ApiProperty({ example: 'PROCESSING' })
  status: string;

  @ApiPropertyOptional({ description: 'Required when status is CANCELLED' })
  reason?: string;
}

export class BookingStatusDto {
  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  fixxerCode?: string;
}

export class JobStatusDto {
  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  fixxerCode?: string;
}

export class FixxerCodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fixxerCode?: string;
}

export class ActiveBodyDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

export class PincodeBodyDto {
  @ApiProperty({ example: '800001' })
  pincode: string;
}

export class PhotoUrlDto {
  @ApiProperty()
  photoUrl: string;
}

export class AvailabilityDto {
  @ApiProperty({ enum: ['AVAILABLE', 'UNAVAILABLE', 'ON_JOB'] })
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'ON_JOB';
}

export class OtpBodyDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  otp: string;
}

export class SignatureUrlDto {
  @ApiProperty()
  @IsString()
  signatureUrl: string;
}

export class PaymentMethodDto {
  @ApiProperty({ enum: ['CASH', 'UPI', 'CARD'] })
  @IsEnum(['CASH', 'UPI', 'CARD'])
  method: 'CASH' | 'UPI' | 'CARD';
}

export class ArrivalDto {
  @ApiProperty({ example: 25.5941 })
  lat: number;

  @ApiProperty({ example: 85.1376 })
  lng: number;
}

export class PushTokenDto {
  @ApiProperty()
  token: string;
}

export class NotificationReadDto {
  @ApiPropertyOptional({ type: [String] })
  notificationIds?: string[];
}

export class ServiceCategoriesDto {
  @ApiProperty({ type: [String], example: ['ac', 'refrigerator'] })
  categories: string[];
}

export class VerifyOtpDto {
  @ApiProperty({ example: '9876543210' })
  phone: string;

  @ApiProperty({ example: '123456' })
  otp: string;
}
