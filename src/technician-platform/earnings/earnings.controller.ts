import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EarningsService } from './earnings.service';
import { TechnicianGuard } from '../common/technician.guard';
import { RequireActiveTechnician } from '../common/require-active.decorator';
import { CurrentTechnician } from '../common/decorators';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../../common/swagger';

@ApiTags('Technician earnings')
@ApiBearerAuth(JWT_AUTH)
@Controller('v1/earnings')
@UseGuards(AuthGuard('jwt'), TechnicianGuard)
@RequireActiveTechnician()
export class EarningsController {
  constructor(private readonly earningsService: EarningsService) {}

  @Get()
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'weekly', 'monthly'] })
  summary(
    @CurrentTechnician() technician: any,
    @Query('period') period?: 'daily' | 'weekly' | 'monthly',
  ) {
    return this.earningsService.getSummary(technician._id.toString(), period);
  }

  @Get('history')
  history(@CurrentTechnician() technician: any) {
    return this.earningsService.getHistory(technician._id.toString());
  }

  @Get(':id')
  getById(@CurrentTechnician() technician: any, @Param('id') id: string) {
    return this.earningsService.getById(technician._id.toString(), id);
  }
}
