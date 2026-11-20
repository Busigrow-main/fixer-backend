import { Controller, Get, Post, Body, Put, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VisitsService } from './visits.service';
import { AuthGuard } from '@nestjs/passport';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin visits')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('api/v1/admin/visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a visit' })
  create(@Body() createData: any) {
    return this.visitsService.create(createData);
  }

  @Get('booking/:bookingId')
  findByBooking(@Param('bookingId') bookingId: string) {
    return this.visitsService.findByBooking(bookingId);
  }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() updateData: any) {
    return this.visitsService.updateStatus(id, updateData);
  }

  @Post(':id/parts')
  addSparePart(@Param('id') id: string, @Body() partData: any) {
    return this.visitsService.addSparePartToVisit(id, partData);
  }
}
