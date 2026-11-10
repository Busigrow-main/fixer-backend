import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { FEEDBACK_FOLLOW_UP_STATUSES } from '../schemas/feedback-follow-up.schema';

export class FeedbackFollowUpQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(FEEDBACK_FOLLOW_UP_STATUSES)
  status?: (typeof FEEDBACK_FOLLOW_UP_STATUSES)[number];
}
