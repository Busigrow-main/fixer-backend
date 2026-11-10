import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { OPS_PENDING_REASONS } from '../../bookings/schemas/booking.schema';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateOpsPendingWorkDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn([...OPS_PENDING_REASONS])
  reason?: (typeof OPS_PENDING_REASONS)[number] | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextAction?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsMongoId()
  ownerId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsBoolean()
  partsWait?: boolean;
}
