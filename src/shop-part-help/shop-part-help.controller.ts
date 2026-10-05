import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateShopPartHelpDto } from './dtos/create-shop-part-help.dto';
import { QuoteShopPartHelpDto } from './dtos/quote-shop-part-help.dto';
import { ShopPartHelpQueryDto } from './dtos/shop-part-help-query.dto';
import { ShopPartHelpService } from './shop-part-help.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('CUSTOMER')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
@Controller('api/v1')
export class ShopPartHelpController {
  constructor(private readonly shopPartHelpService: ShopPartHelpService) {}

  @Post('shop/part-help')
  create(@Request() req: any, @Body() dto: CreateShopPartHelpDto) {
    return this.shopPartHelpService.create(dto, req.user.userId);
  }

  @Get('user/part-help')
  findMine(@Request() req: any) {
    return this.shopPartHelpService.findAllForUser(req.user.userId);
  }

  @Get('user/part-help/:id')
  findMineById(@Request() req: any, @Param('id') id: string) {
    return this.shopPartHelpService.findOneForUser(id, req.user.userId);
  }

  @Post('user/part-help/:id/accept')
  accept(@Request() req: any, @Param('id') id: string) {
    return this.shopPartHelpService.accept(id, req.user.userId);
  }

  @Post('user/part-help/:id/decline')
  decline(@Request() req: any, @Param('id') id: string) {
    return this.shopPartHelpService.decline(id, req.user.userId);
  }

  @Post('user/part-help/:id/cancel')
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.shopPartHelpService.cancel(id, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Get('admin/shop-part-help')
  findAllForAdmin(@Query() query: ShopPartHelpQueryDto) {
    return this.shopPartHelpService.findAllForAdmin(
      query.page,
      query.limit,
      query.status,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Get('admin/shop-part-help/:id')
  findOneForAdmin(@Param('id') id: string) {
    return this.shopPartHelpService.findOneForAdmin(id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Put('admin/shop-part-help/:id/quote')
  quote(@Param('id') id: string, @Body() dto: QuoteShopPartHelpDto) {
    return this.shopPartHelpService.quote(id, dto);
  }
}
