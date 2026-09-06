import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CustomerAppliancesService } from './customer-appliances.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api/v1')
export class CustomerAppliancesController {
  constructor(
    private readonly customerAppliancesService: CustomerAppliancesService,
  ) {}

  /** Customer's mapped appliances for their account phone. */
  @Get('user/appliances')
  async getMyAppliances(@Request() req: any) {
    return this.customerAppliancesService.findForUser(req.user.userId);
  }
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('api/v1/admin/appliance-mappings')
export class AdminApplianceMappingsController {
  constructor(
    private readonly customerAppliancesService: CustomerAppliancesService,
  ) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.customerAppliancesService.list(
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
    );
  }

  @Get('search')
  async search(@Query('phone') phone: string) {
    return this.customerAppliancesService.searchByPhone(phone);
  }

  @Get('by-serial/:serial')
  async bySerial(@Param('serial') serial: string) {
    return this.customerAppliancesService.findBySerial(serial);
  }

  @Post('map')
  async map(
    @Body()
    body: {
      phone: string;
      serialNumber: string;
      brand?: string;
      modelNumber?: string;
      bookingId?: string;
    },
  ) {
    return this.customerAppliancesService.mapSerialToPhone({
      ...body,
      source: 'ADMIN',
    });
  }

  @Post(':serial/phones')
  async addPhone(
    @Param('serial') serial: string,
    @Body('phone') phone: string,
  ) {
    return this.customerAppliancesService.addPhoneToSerial(serial, phone);
  }
}
