import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JWT_AUTH } from '../../common/swagger';
import { PerformanceSummaryQueryDto } from './performance-summary.dto';
import { PerformanceSummaryService } from './performance-summary.service';

@ApiTags('Admin performance summaries')
@ApiBearerAuth(JWT_AUTH)
@Controller('api/v1/admin/performance-summaries')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class PerformanceSummaryController {
  constructor(private readonly summaryService: PerformanceSummaryService) {}

  @Get()
  list(@Query() query: PerformanceSummaryQueryDto) {
    return this.summaryService.list(query);
  }

  @Get(':date')
  getByDate(@Param('date') date: string) {
    return this.summaryService.getByDate(date);
  }
}
