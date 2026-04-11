import { BookingsService } from './bookings.service';
export declare class BookingsController {
    private readonly bookingsService;
    constructor(bookingsService: BookingsService);
    getUserBookings(req: any): Promise<import("./schemas/booking.schema").Booking[]>;
    createBooking(req: any, createBookingDto: any): Promise<import("./schemas/booking.schema").Booking>;
    getAdminBookings(): Promise<import("./schemas/booking.schema").Booking[]>;
    getAdminBookingDetails(id: string): Promise<import("./schemas/booking.schema").Booking>;
    updateStatus(id: string, status: string): Promise<import("./schemas/booking.schema").Booking>;
    addAdminNote(id: string, note: string): Promise<import("./schemas/booking.schema").Booking>;
}
