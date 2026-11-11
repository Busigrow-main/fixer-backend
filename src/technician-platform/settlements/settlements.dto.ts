import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  SettlementReconciliationStatus,
} from './schemas/settlement.schema';

export class PrepareSettlementsDto {
  @ApiPropertyOptional({
    description: 'Preparation cutoff. Defaults to the current time.',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  cutoffAt?: string;
}

export class RejectSettlementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class RecordSettlementPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentReference: string;

  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({
    description: 'Verified payment processor/bank confirmation result',
  })
  @IsDefined()
  @IsBoolean()
  successful: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  failureReason?: string;
}

export class ReconcileSettlementDto {
  @ApiProperty({ enum: SettlementReconciliationStatus })
  @IsEnum(SettlementReconciliationStatus)
  status: SettlementReconciliationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
