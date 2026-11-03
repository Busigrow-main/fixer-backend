import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ShopMaintenanceGuard } from './shop-maintenance.guard';
import { ShopService } from './shop.service';
import { ShopSettingsService } from './shop-settings.service';

@ApiTags('Shop')
@Controller('api/v1/shop')
export class ShopController {
  constructor(
    private readonly shopService: ShopService,
    private readonly shopSettings: ShopSettingsService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Public Fixxer Shop availability / maintenance flag' })
  getStatus() {
    return this.shopSettings.getPublicStatus();
  }

  @Get('home')
  @UseGuards(ShopMaintenanceGuard)
  @ApiOperation({ summary: 'Shop hub cards: appliances and spare parts in rupees' })
  @ApiQuery({ name: 'limit', required: false, example: 8 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  getHome(@Query('limit') limit?: string, @Query('page') page?: string) {
    return this.shopService.getHome(
      limit ? parseInt(limit, 10) : 8,
      page ? parseInt(page, 10) : 1,
    );
  }
}
