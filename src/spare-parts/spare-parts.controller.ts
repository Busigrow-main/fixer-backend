import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { SparePartsService } from './spare-parts.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/v1/spare-parts')
export class SparePartsController {
  constructor(private readonly sparePartsService: SparePartsService) {}

  @Get('meta/categories')
  async getCategories() {
    return this.sparePartsService.getCategories();
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.sparePartsService.findAll(query);
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    return this.sparePartsService.findBySlug(slug);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() createSparePartDto: any) {
    return this.sparePartsService.create(createSparePartDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateSparePartDto: any) {
    return this.sparePartsService.update(id, updateSparePartDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.sparePartsService.delete(id);
  }
}
