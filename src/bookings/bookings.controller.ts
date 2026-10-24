import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';

import { BookingsService } from './bookings.service';

import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../common/swagger';
import { ReasonDto } from '../common/body.dto';
import { CreateBookingDto } from './dtos/create-booking.dto';

@ApiTags('Bookings')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'))
@Controller('api/v1')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // USER ROUTES

  @Get('user/bookings')
  @ApiOperation({ summary: 'List the caller service bookings' })
  async getUserBookings(@Request() req: any) {
    return this.bookingsService.findAllByUser(req.user.userId);
  }

  @Post('user/bookings/:id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  async cancelBooking(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: ReasonDto,
  ) {
    return this.bookingsService.cancelBooking(
      id,
      req.user.userId,
      body.reason,
    );
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Create a service booking' })
  async createBooking(
    @Request() req: any,
    @Body() createBookingDto: CreateBookingDto,
  ) {
    return this.bookingsService.create(
      createBookingDto,
      req.user.userId,
    );
  }

  @Post('user/bookings/:id/claim-warranty')
  @ApiOperation({ summary: 'Claim warranty on a completed booking' })
  async claimWarranty(@Request() req: any, @Param('id') id: string) {
    return this.bookingsService.claimWarranty(id, req.user.userId);
  }
}