import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../common/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto, ApplyCouponDto, UpdateCartItemDto } from './dtos/cart.dto';

@ApiTags('Cart')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'))
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('api/v1/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get the signed-in user cart' })
  getCart(@Request() req: any) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an appliance or spare part to the cart' })
  addItem(@Request() req: any, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(req.user.userId, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update quantity or installation option' })
  updateItem(
    @Request() req: any,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(req.user.userId, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove one cart line' })
  removeItem(@Request() req: any, @Param('itemId') itemId: string) {
    return this.cartService.removeItem(req.user.userId, itemId);
  }

  @Delete('items')
  @ApiOperation({ summary: 'Clear the cart and coupons' })
  clear(@Request() req: any) {
    return this.cartService.clear(req.user.userId);
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Apply a live SHOP or ALL coupon' })
  applyCoupon(@Request() req: any, @Body() dto: ApplyCouponDto) {
    return this.cartService.applyCoupon(req.user.userId, dto.code);
  }

  @Delete('coupons/:code')
  @ApiOperation({ summary: 'Remove an applied coupon' })
  removeCoupon(@Request() req: any, @Param('code') code: string) {
    return this.cartService.removeCoupon(req.user.userId, code);
  }
}
