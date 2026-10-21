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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { JWT_AUTH } from '../common/swagger';
import { ActiveBodyDto } from '../common/body.dto';
import { CreateOfferDto } from './dtos/offer.dto';

@ApiTags('Offers')
@Controller('api/v1/offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  @ApiOperation({ summary: 'Live public offers' })
  async liveOffers() {
    return this.offersService.findLive();
  }
}

@ApiTags('Admin offers')
@ApiBearerAuth(JWT_AUTH)
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
  @ApiOperation({ summary: 'Create an offer' })
  async create(@Body() body: CreateOfferDto) {
    return this.offersService.create(body as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an offer' })
  async update(@Param('id') id: string, @Body() body: CreateOfferDto) {
    return this.offersService.update(id, body as any);
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Activate or deactivate an offer' })
  async setActive(
    @Param('id') id: string,
    @Body() body: ActiveBodyDto,
  ) {
    return this.offersService.setActive(id, Boolean(body.isActive));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.offersService.remove(id);
  }
}
