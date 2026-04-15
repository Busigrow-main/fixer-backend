import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('api/v1')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // USER ROUTES
  @Get('user/bookings')
  async getUserBookings(@Request() req: any) {
    return this.bookingsService.findAllByUser(req.user.userId);
  }

  @Post('bookings')
  async createBooking(@Request() req: any, @Body() createBookingDto: any) {
    return this.bookingsService.create(createBookingDto, req.user.userId);
  }
}

