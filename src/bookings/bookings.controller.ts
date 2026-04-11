import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
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

  // ADMIN ROUTES
  @Get('admin/bookings')
  async getAdminBookings() {
    return this.bookingsService.findAllForAdmin();
  }

  @Get('admin/bookings/:id')
  async getAdminBookingDetails(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Put('admin/bookings/:id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.bookingsService.updateStatus(id, status);
  }

  @Post('admin/bookings/:id/notes')
  async addAdminNote(@Param('id') id: string, @Body('note') note: string) {
    return this.bookingsService.addAdminNote(id, note);
  }
}
