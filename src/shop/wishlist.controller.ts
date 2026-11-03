import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../common/swagger';
import { AddWishlistItemDto, SyncWishlistDto } from './dtos/wishlist.dto';
import { ShopMaintenanceGuard } from './shop-maintenance.guard';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'), ShopMaintenanceGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('api/v1/wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get the signed-in user wishlist' })
  getWishlist(@Request() req: any) {
    return this.wishlistService.getWishlist(req.user.userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an appliance or spare part to the wishlist' })
  addItem(@Request() req: any, @Body() dto: AddWishlistItemDto) {
    return this.wishlistService.addItem(
      req.user.userId,
      dto.productType,
      dto.productId,
    );
  }

  @Delete('items/:productType/:productId')
  @ApiOperation({ summary: 'Remove one wishlist item' })
  removeItem(
    @Request() req: any,
    @Param('productType') productType: 'part' | 'appliance',
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.removeItem(
      req.user.userId,
      productType,
      productId,
    );
  }

  @Put('sync')
  @ApiOperation({ summary: 'Merge local wishlist refs into the server wishlist' })
  sync(@Request() req: any, @Body() dto: SyncWishlistDto) {
    return this.wishlistService.syncItems(req.user.userId, dto.items);
  }
}
