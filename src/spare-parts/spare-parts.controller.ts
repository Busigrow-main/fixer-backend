import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { SparePartsService } from './spare-parts.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/spare-parts')
export class SparePartsController {
  constructor(private readonly sparePartsService: SparePartsService) {}

  @Get('categories')
  async getNavigationTree() {
    return this.sparePartsService.getNavigationTree();
  }

  @Get('categories/:type/brands')
  async getBrandsForType(@Param('type') type: string) {
    return this.sparePartsService.getBrandsForType(type);
  }

  @Get('categories/:type/brands/:brand/models')
  async getModelsForBrand(@Param('type') type: string, @Param('brand') brand: string) {
    return this.sparePartsService.getModelsForBrand(brand, type);
  }

  @Get('meta/categories')
  async getPartCategories() {
    return this.sparePartsService.getCategories();
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.sparePartsService.findAll(query);
  }

  @Get(':sku')
  async findOne(@Param('sku') sku: string) {
    return this.sparePartsService.findBySku(sku);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() createSparePartDto: any) {
    return this.sparePartsService.createPart(createSparePartDto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateSparePartDto: any) {
    return this.sparePartsService.updatePart(id, updateSparePartDto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.sparePartsService.delete(id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Post('refresh-tree')
  async refreshTree() {
    await this.sparePartsService.refreshCategoryTree();
    return { success: true };
  }
}

