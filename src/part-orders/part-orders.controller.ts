import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { PartOrdersService } from './part-orders.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('api/v1')
export class PartOrdersController {
  constructor(private readonly partOrdersService: PartOrdersService) {}

  // USER ROUTES
  @Get('user/part-orders')
  async getUserOrders(@Request() req: any) {
    return this.partOrdersService.findAllByUser(req.user.userId);
  }

  @Post('part-orders')
  async createOrder(@Request() req: any, @Body() createOrderDto: any) {
    return this.partOrdersService.create(createOrderDto, req.user.userId);
  }
}

