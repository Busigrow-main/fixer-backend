import { Controller, Get, Post, Body, Put, Param } from '@nestjs/common';
import { VisitsService } from './visits.service';

@Controller('api/v1/admin/visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
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
