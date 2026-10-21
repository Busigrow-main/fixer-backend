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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../common/swagger';
import { PhoneBodyDto } from '../common/body.dto';
import { MapSerialDto } from '../technician-platform/dtos/technician-api.dto';

@ApiTags('Customer appliances')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'))
@Controller('api/v1')
export class CustomerAppliancesController {
  constructor(
    private readonly customerAppliancesService: CustomerAppliancesService,
  ) {}

  /** Customer's mapped appliances for their account phone. */
  @Get('user/appliances')
  @ApiOperation({ summary: 'Mapped appliances for the signed-in customer' })
  async getMyAppliances(@Request() req: any) {
    return this.customerAppliancesService.findForUser(req.user.userId);
  }
}

@ApiTags('Admin appliance mappings')
@ApiBearerAuth(JWT_AUTH)
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
  @ApiQuery({ name: 'phone', required: true })
  async search(@Query('phone') phone: string) {
    return this.customerAppliancesService.searchByPhone(phone);
  }

  @Get('by-serial/:serial')
  async bySerial(@Param('serial') serial: string) {
    return this.customerAppliancesService.findBySerial(serial);
  }

  @Post('map')
  @ApiOperation({ summary: 'Map a serial number to a customer phone' })
  async map(@Body() body: MapSerialDto) {
    return this.customerAppliancesService.mapSerialToPhone({
      ...body,
      source: 'ADMIN',
    });
  }

  @Post(':serial/phones')
  @ApiOperation({ summary: 'Add another phone to a serial mapping' })
  async addPhone(
    @Param('serial') serial: string,
    @Body() body: PhoneBodyDto,
  ) {
    return this.customerAppliancesService.addPhoneToSerial(serial, body.phone);
  }
}
