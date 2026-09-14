import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OffersService } from './offers.service';

@Controller('api/v1/offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  async liveOffers() {
    return this.offersService.findLive();
  }
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('api/v1/admin/offers')
export class AdminOffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.offersService.findAll(
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 50,
    );
  }

  @Post()
  async create(@Body() body: any) {
    return this.offersService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.offersService.update(id, body);
  }

  @Patch(':id/active')
  async setActive(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.offersService.setActive(id, Boolean(isActive));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.offersService.remove(id);
  }
}
