import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { SparePartsService } from './spare-parts.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/spare-parts')
export class SparePartsController {
  constructor(private readonly sparePartsService: SparePartsService) {}

  // ================================================================
  // CATEGORY-DRIVEN NAVIGATION (structured, no search coupling)
  // ================================================================

  /** GET /categories — full navigation tree */
  @Get('categories')
  async getNavigationTree() {
    return this.sparePartsService.getNavigationTree();
  }

  /** GET /categories/:type — single appliance type tree */
  @Get('categories/:type')
  async getTypeTree(@Param('type') type: string) {
    return this.sparePartsService.getTypeTree(type);
  }

  /** GET /categories/:type/brands */
  @Get('categories/:type/brands')
  async getBrandsForType(@Param('type') type: string) {
    return this.sparePartsService.getBrandsForType(type);
  }

  /** GET /categories/:type/brands/:brand/models */
  @Get('categories/:type/brands/:brand/models')
  async getModelsForBrand(@Param('type') type: string, @Param('brand') brand: string) {
    return this.sparePartsService.getModelsForBrand(brand, type);
  }

  /** GET /categories/:type/:partCategory — parts by type + category */
  @Get('categories/:type/:partCategory')
  async getPartsByCategory(
    @Param('type') type: string,
    @Param('partCategory') partCategory: string,
    @Query('brand') brand?: string,
    @Query('universal') universal?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.sparePartsService.getPartsByCategory(
      type,
      partCategory,
      brand || undefined,
      universal !== undefined ? universal === 'true' : undefined,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 24,
      sort,
    );
  }

  // ================================================================
  // SEARCH (independent from navigation)
  // ================================================================

  /** GET /meta/categories — distinct part category names */
  @Get('meta/categories')
  async getPartCategories() {
    return this.sparePartsService.getPartCategories();
  }

  /** GET / — search/filter parts (supports ?q=, ?applianceType=, etc.) */
  @Get()
  async findAll(@Query() query: any) {
    return this.sparePartsService.searchParts(query);
  }

  /** GET /suggestions — autocomplete search */
  @Get('suggestions')
  async getSuggestions(@Query('q') q: string) {
    return this.sparePartsService.getSuggestions(q);
  }

  /** GET /:sku — single part by SKU */
  @Get(':sku')
  async findOne(@Param('sku') sku: string) {
    return this.sparePartsService.findBySku(sku);
  }

  // ================================================================
  // ADMIN CRUD
  // ================================================================

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
