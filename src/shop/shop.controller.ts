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
  @ApiQuery({ name: 'page', required: false, example: 1 })
  getHome(@Query('limit') limit?: string, @Query('page') page?: string) {
    return this.shopService.getHome(
      limit ? parseInt(limit, 10) : 8,
      page ? parseInt(page, 10) : 1,
    );
  }
}
