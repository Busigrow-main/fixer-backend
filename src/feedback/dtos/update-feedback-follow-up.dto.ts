import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { FEEDBACK_FOLLOW_UP_STATUSES } from '../schemas/feedback-follow-up.schema';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateFeedbackFollowUpDto {
  @IsOptional()
  @IsMongoId()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string;

  @IsOptional()
  @IsIn(FEEDBACK_FOLLOW_UP_STATUSES)
  status?: (typeof FEEDBACK_FOLLOW_UP_STATUSES)[number];
}
