import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TECHNICIAN_PART_REQUEST_STATUSES } from '../schemas/technician-part-request.schema';

export class CreateTechnicianPartRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  visitId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sparePartId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  idempotencyKey: string;
}

export class TechnicianPartRequestOperationDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  idempotencyKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyMonths?: number;
}

export class TechnicianPartRequestReturnDto extends TechnicianPartRequestOperationDto {
  @ApiProperty({ enum: ['UNUSED', 'DEFECTIVE'] })
  @IsIn(['UNUSED', 'DEFECTIVE'])
  condition: 'UNUSED' | 'DEFECTIVE';

  @ApiPropertyOptional({ maxLength: 500, description: 'Required for defective returns.' })
  @ValidateIf((body: TechnicianPartRequestReturnDto) => body.condition === 'DEFECTIVE')
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}

export class TechnicianPartRequestReasonDto {
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class TechnicianPartRequestListQueryDto {
  @ApiPropertyOptional({ enum: TECHNICIAN_PART_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(TECHNICIAN_PART_REQUEST_STATUSES)
  status?: (typeof TECHNICIAN_PART_REQUEST_STATUSES)[number];

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
