import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../common/swagger';
import { CheckoutService } from './checkout.service';
import { CheckoutQuoteDto, CreateCheckoutDto } from './dtos/checkout.dto';

@ApiTags('Checkout')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'))
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('api/v1/checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('quote')
  @ApiOperation({ summary: 'Validate cart, delivery, installation, and discounts' })
  quote(@Request() req: any, @Body() dto: CheckoutQuoteDto) {
    return this.checkoutService.quote(req.user.userId, dto.pincode);
  }

  @Post()
  @ApiOperation({ summary: 'Create order(s) from the cart (COD or ONLINE)' })
  checkout(@Request() req: any, @Body() dto: CreateCheckoutDto) {
    return this.checkoutService.checkout(req.user.userId, dto);
  }
}
