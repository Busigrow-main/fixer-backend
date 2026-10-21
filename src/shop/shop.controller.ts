import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ShopService } from './shop.service';

@ApiTags('Shop')
@Controller('api/v1/shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('home')
  @ApiOperation({ summary: 'Shop hub cards: appliances and spare parts in rupees' })
  @ApiQuery({ name: 'limit', required: false, example: 8 })
  getHome(@Query('limit') limit?: string) {
    return this.shopService.getHome(limit ? parseInt(limit, 10) : 8);
  }
}
