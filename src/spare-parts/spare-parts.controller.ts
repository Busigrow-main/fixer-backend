import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SparePartsService } from './spare-parts.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JWT_AUTH } from '../common/swagger';
import { CreateSparePartDto, SparePartsQueryDto } from './dtos/spare-parts.dto';

@ApiTags('Spare parts')
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
  @ApiOperation({ summary: 'Search and filter spare parts (price in paise)' })
  async findAll(@Query() query: SparePartsQueryDto) {
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
  @ApiBearerAuth(JWT_AUTH)
  @Post()
  @ApiOperation({ summary: 'Create a spare part (admin)' })
  async create(@Body() createSparePartDto: CreateSparePartDto) {
    return this.sparePartsService.createPart(createSparePartDto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth(JWT_AUTH)
  @Put(':id')
  @ApiOperation({ summary: 'Update a spare part (admin)' })
  async update(@Param('id') id: string, @Body() updateSparePartDto: CreateSparePartDto) {
    return this.sparePartsService.updatePart(id, updateSparePartDto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth(JWT_AUTH)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a spare part (admin)' })
  async delete(@Param('id') id: string) {
    return this.sparePartsService.deletePart(id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth(JWT_AUTH)
  @Post('refresh-tree')
  @ApiOperation({ summary: 'Rebuild spare-part category tree (admin)' })
  async refreshTree() {
    await this.sparePartsService.refreshCategoryTree();
    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth(JWT_AUTH)
  @Post('sync-search')
  @ApiOperation({ summary: 'Sync spare parts to Elasticsearch (admin)' })
  async syncSearch() {
    const result = await this.sparePartsService.syncToElasticsearch();
    return { success: true, ...result };
  }
}
