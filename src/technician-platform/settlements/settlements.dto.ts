import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  NotEquals,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { SettlementReconciliationStatus } from './schemas/settlement.schema';

export class PrepareSettlementsDto {
  @ApiPropertyOptional({ description: 'IST business date to prepare, YYYY-MM-DD.' })
  @IsOptional()
  @IsDateString()
  settlementDate?: string;

  @ApiPropertyOptional({
    description: 'Legacy date-time anchor; the previous IST day is prepared.',
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
  @MaxLength(500)
  reason: string;
}

export class RecordSettlementPaymentDto {
  @ApiPropertyOptional({ description: 'Required for successful manual payment confirmation.' })
  @ValidateIf((body: RecordSettlementPaymentDto) => body.successful === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  paymentReference?: string;

  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentMethod?: string;

  @ApiProperty({ description: 'Whether an admin has verified the manual bank/payment result.' })
  @IsDefined()
  @IsBoolean()
  successful: boolean;

  @ApiPropertyOptional({ description: 'Required when successful is false.' })
  @ValidateIf((body: RecordSettlementPaymentDto) => body.successful === false)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  failureReason?: string;
}

export class ReconcileSettlementDto {
  @ApiProperty({ enum: SettlementReconciliationStatus })
  @IsEnum(SettlementReconciliationStatus)
  status: SettlementReconciliationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class MarkSettlementPayableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AddSettlementAdjustmentDto {
  @ApiProperty({ description: 'UUID used to make retries of this adjustment idempotent.' })
  @IsUUID()
  idempotencyKey: string;

  @ApiProperty({ description: 'Signed INR amount. Positive adds to payable; negative deducts.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @NotEquals(0)
  amount: number;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
