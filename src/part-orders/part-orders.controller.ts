import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PartOrdersService } from './part-orders.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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

  // ADMIN ROUTES
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Get('admin/part-orders')
  async getAdminOrders() {
    return this.partOrdersService.findAllForAdmin();
  }

  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Get('admin/part-orders/:id')
  async getAdminOrderDetails(@Param('id') id: string) {
    return this.partOrdersService.findOne(id);
  }

  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Put('admin/part-orders/:id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.partOrdersService.updateStatus(id, status);
  }

  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Put('admin/part-orders/:id/tracking')
  async attachTracking(@Param('id') id: string, @Body() trackingData: { courierName: string, trackingNumber: string }) {
    return this.partOrdersService.attachTracking(id, trackingData);
  }
}
