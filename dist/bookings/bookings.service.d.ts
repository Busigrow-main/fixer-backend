import { Model } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';
export declare class BookingsService {
    private bookingModel;
    constructor(bookingModel: Model<BookingDocument>);
    findAllByUser(userId: string): Promise<Booking[]>;
    findAllForAdmin(): Promise<Booking[]>;
    findOne(id: string): Promise<Booking>;
    create(createBookingDto: any, userId: string): Promise<Booking>;
    updateStatus(id: string, status: string): Promise<Booking>;
    addAdminNote(id: string, note: string): Promise<Booking>;
}
