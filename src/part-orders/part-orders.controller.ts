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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../common/swagger';
import { ReasonDto } from '../common/body.dto';

@ApiTags('Orders')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'))
@Controller('api/v1')
export class PartOrdersController {
  constructor(
    private readonly partOrdersService: PartOrdersService,
  ) {}

  // USER ROUTES

  @Get('user/part-orders')
  @ApiOperation({ summary: 'List the caller shop orders' })
  async getUserOrders(@Request() req: any) {
    return this.partOrdersService.findAllByUser(
      req.user.userId,
    );
  }

  @Get('user/part-orders/:id/tracking')
  @ApiOperation({ summary: 'Customer order tracking' })
  async getUserOrderTracking(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.partOrdersService.findTrackingForUser(id, req.user.userId);
  }

  @Get('user/part-orders/:id')
  @ApiOperation({ summary: 'Customer order detail' })
  async getUserOrder(@Request() req: any, @Param('id') id: string) {
    return this.partOrdersService.findOneForUser(id, req.user.userId);
  }

  @Post('part-orders')
  @ApiOperation({ summary: 'Create a spare-part or appliance enquiry without cart' })
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
  @ApiOperation({ summary: 'Cancel a pending or processing order' })
  async cancelOrder(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: ReasonDto,
  ) {
    return this.partOrdersService.cancelOrder(
      id,
      req.user.userId,
      body.reason,
    );
  }
}