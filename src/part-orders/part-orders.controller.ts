import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';

import { PartOrdersService } from './part-orders.service';

import { CreatePartOrderDto } from './dtos/create-part-order.dto';

import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('api/v1')
export class PartOrdersController {
  constructor(
    private readonly partOrdersService: PartOrdersService,
  ) {}

  // USER ROUTES

  @Get('user/part-orders')
  async getUserOrders(@Request() req: any) {
    return this.partOrdersService.findAllByUser(
      req.user.userId,
    );
  }

  @Post('part-orders')
  async createOrder(
    @Request() req: any,
    @Body() createOrderDto: CreatePartOrderDto,
  ) {
    return this.partOrdersService.create(
      createOrderDto,
      req.user.userId,
    );
  }

  @Post('user/part-orders/:id/cancel')
  async cancelOrder(
    @Request() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.partOrdersService.cancelOrder(
      id,
      req.user.userId,
      reason,
    );
  }
}