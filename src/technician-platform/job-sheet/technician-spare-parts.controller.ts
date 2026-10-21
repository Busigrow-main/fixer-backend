import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JobSheetService } from '../job-sheet/job-sheet.service';
import { TechnicianGuard } from '../common/technician.guard';
import { RequireActiveTechnician } from '../common/require-active.decorator';

import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../../common/swagger';

/** Technician inventory browse — stock > 0 only. */
@ApiTags('Technician spare parts')
@ApiBearerAuth(JWT_AUTH)
@Controller('v1/spare-parts')
@UseGuards(AuthGuard('jwt'), TechnicianGuard)
@RequireActiveTechnician()
export class TechnicianSparePartsController {
  constructor(private readonly jobSheetService: JobSheetService) {}

  @Get()
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'page', required: false })
  search(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.jobSheetService.searchInventory({ q, category, limit, page });
  }
}
