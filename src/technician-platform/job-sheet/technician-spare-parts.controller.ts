import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JobSheetService } from '../job-sheet/job-sheet.service';
import { TechnicianGuard } from '../common/technician.guard';
import { RequireActiveTechnician } from '../common/require-active.decorator';

/** Technician inventory browse — stock > 0 only. */
@Controller('v1/spare-parts')
@UseGuards(AuthGuard('jwt'), TechnicianGuard)
@RequireActiveTechnician()
export class TechnicianSparePartsController {
  constructor(private readonly jobSheetService: JobSheetService) {}

  @Get()
  search(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.jobSheetService.searchInventory({ q, category, limit, page });
  }
}
