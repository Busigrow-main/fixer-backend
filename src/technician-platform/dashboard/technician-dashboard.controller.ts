import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TechnicianDashboardService } from './technician-dashboard.service';
import { TechnicianGuard } from '../common/technician.guard';
import { RequireActiveTechnician } from '../common/require-active.decorator';
import { CurrentTechnician } from '../common/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../../common/swagger';

@ApiTags('Technician dashboard')
@ApiBearerAuth(JWT_AUTH)
@Controller('v1/dashboard')
@UseGuards(AuthGuard('jwt'), TechnicianGuard)
@RequireActiveTechnician()
export class TechnicianDashboardController {
  constructor(private readonly dashboardService: TechnicianDashboardService) {}

  @Get()
  dashboard(@CurrentTechnician() technician: any) {
    return this.dashboardService.getDashboard(technician._id.toString());
  }

  @Get('stats')
  stats(@CurrentTechnician() technician: any) {
    return this.dashboardService.getStats(technician._id.toString());
  }
}
