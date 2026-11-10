import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateOpsSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unclaimedEscalateMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  acceptedNotStartedHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partsWaitHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  visitOverdueHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reviewOverdueHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  alertCooldownMinutes?: number;
}
