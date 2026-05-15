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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AppliancesService } from './appliances.service';
import {
  CreateApplianceDto,
  UpdateApplianceDto,
  FilterApplianceDto,
} from './dtos/appliance.dto';

@Controller('api/v1/appliances')
export class AppliancesController {
  constructor(private readonly appliancesService: AppliancesService) {}

  // ─── Public Endpoints ──────────────────────────────────────────

  /**
   * GET /api/v1/appliances/ac
   * List all AC products with filtering, sorting, pagination
   */
  @Get('ac')
  @HttpCode(HttpStatus.OK)
  async listACs(@Query() filters: FilterApplianceDto) {
    return this.appliancesService.findAll(filters);
  }

  /**
   * GET /api/v1/appliances/ac/:slug
   * Get single AC product by slug
   */
  @Get('ac/:slug')
  @HttpCode(HttpStatus.OK)
  async getACBySlug(@Param('slug') slug: string) {
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
  @HttpCode(HttpStatus.CREATED)
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
  @HttpCode(HttpStatus.OK)
  async updateAC(
    @Param('slug') slug: string,
    @Body() updateDto: UpdateApplianceDto,
  ) {
    return this.appliancesService.update(slug, updateDto);
  }
}
