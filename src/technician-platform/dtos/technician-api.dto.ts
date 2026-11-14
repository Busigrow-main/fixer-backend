import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength, IsNotEmpty } from 'class-validator';

export class OnboardingEventDto {
  @ApiProperty()
  event: string;

  @ApiPropertyOptional()
  step?: number;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;
}

export class UploadVerificationDocumentDto {
  @ApiProperty({ example: 'AADHAAR' })
  documentType: string;

  @ApiProperty()
  fileUrl: string;
}

export class JobCompletionBodyDto {
  @ApiPropertyOptional({ example: 400 })
  @IsOptional()
  @IsNumber()
  labourCharge?: number;

  @ApiPropertyOptional({ example: 1515 })
  @IsOptional()
  @IsNumber()
  partsCharge?: number;

  @ApiProperty({ example: 'Compressor replaced' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class ReturnInventoryPartDto {
  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'stable-client-generated-key', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  idempotencyKey: string;
}

export class OnboardingCallDto {
  @ApiProperty()
  technicianId: string;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  outcome: string;

  @ApiPropertyOptional()
  notes?: string;
}

export class MapSerialDto {
  @ApiProperty({ example: '9876543210' })
  phone: string;

  @ApiProperty()
  serialNumber: string;

  @ApiPropertyOptional()
  brand?: string;

  @ApiPropertyOptional()
  modelNumber?: string;

  @ApiPropertyOptional()
  bookingId?: string;
}
