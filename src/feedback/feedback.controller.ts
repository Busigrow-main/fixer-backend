import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JWT_AUTH } from '../common/swagger';
import { FeedbackFollowUpQueryDto } from './dtos/feedback-follow-up-query.dto';
import { SubmitFeedbackDto } from './dtos/submit-feedback.dto';
import { UpdateFeedbackFollowUpDto } from './dtos/update-feedback-follow-up.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('Feedback')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('api/v1')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('user/bookings/:id/feedback')
  @ApiOperation({ summary: 'Submit or update feedback for a completed booking' })
  submit(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.feedbackService.submitForBooking(id, req.user.userId, dto);
  }

  @Get('user/bookings/:id/feedback')
  @ApiOperation({ summary: 'Get the caller feedback for a booking' })
  getMine(@Request() req: any, @Param('id') id: string) {
    return this.feedbackService.getForBooking(id, req.user.userId);
  }

  @Roles('ADMIN')
  @Get('admin/feedback-follow-ups')
  @ApiOperation({ summary: 'List unhappy-customer recovery follow-ups' })
  listFollowUps(@Query() query: FeedbackFollowUpQueryDto) {
    return this.feedbackService.listFollowUps(
      query.page,
      query.limit,
      query.status,
    );
  }

  @Roles('ADMIN')
  @Patch('admin/feedback-follow-ups/:id')
  @ApiOperation({
    summary: 'Assign owner, due date, or resolve a feedback follow-up',
  })
  updateFollowUp(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackFollowUpDto,
  ) {
    return this.feedbackService.updateFollowUp(id, dto);
  }
}
