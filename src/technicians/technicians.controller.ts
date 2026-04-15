import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { TechniciansService } from './technicians.service';

@Controller('api/v1/admin/technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Post()
  create(@Body() createData: any) {
    return this.techniciansService.create(createData);
  }

  @Get()
  findAll() {
    return this.techniciansService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.techniciansService.findOne(id);
  }

  @Get(':id/details')
  getDetails(@Param('id') id: string) {
    return this.techniciansService.getTechnicianWithJobs(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.techniciansService.update(id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.techniciansService.remove(id);
  }
}
