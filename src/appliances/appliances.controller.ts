import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JWT_AUTH } from '../common/swagger';
import { AppliancesService } from './appliances.service';
import {
  CreateApplianceDto,
  UpdateApplianceDto,
  FilterApplianceDto,
  CatalogApplianceQueryDto,
} from './dtos/appliance.dto';

@ApiTags('Appliances')
@Controller('api/v1/appliances')
export class AppliancesController {
  constructor(private readonly appliancesService: AppliancesService) {}

  // ─── Public Endpoints ──────────────────────────────────────────

  /**
   * GET /api/v1/appliances?type=refrigerator&page=1&limit=12&sort=price_asc
   * Catalog for ac, refrigerator, washing-machine, and microwave.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List appliances by type (ac, refrigerator, washing-machine, microwave)' })
  async listCatalog(@Query() filters: CatalogApplianceQueryDto) {
    return this.appliancesService.findCatalog(filters);
  }

  /**
   * GET /api/v1/appliances/ac
   * List all AC products with filtering, sorting, pagination
   */
  @Get('ac')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Legacy AC catalog list' })
  async listACs(@Query() filters: FilterApplianceDto) {
    return this.appliancesService.findAll(filters);
  }

  /**
   * GET /api/v1/appliances/ac/:slug
   * Get single AC product by slug
   */
  @Get('ac/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Legacy AC product detail' })
  async getACBySlug(@Param('slug') slug: string) {
    return this.appliancesService.findBySlug(slug);
  }

  /**
   * GET /api/v1/appliances/:slug
   * Detail for any appliance category.
   */
  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Appliance detail for any category' })
  async getBySlug(@Param('slug') slug: string) {
    return this.appliancesService.findBySlug(slug);
  }

  // ─── Admin Endpoints ──────────────────────────────────────────

  /**
   * POST /api/v1/appliances/ac
   * Create new AC product (admin only)
   */
  @Post('ac')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth(JWT_AUTH)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an AC product (admin)' })
  async createAC(@Body() createDto: CreateApplianceDto) {
    return this.appliancesService.create(createDto);
  }

  /**
   * PUT /api/v1/appliances/ac/:slug
   * Update AC product (admin only)
   */
  @Put('ac/:slug')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth(JWT_AUTH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an AC product (admin)' })
  async updateAC(
    @Param('slug') slug: string,
    @Body() updateDto: UpdateApplianceDto,
  ) {
    return this.appliancesService.update(slug, updateDto);
  }
}
