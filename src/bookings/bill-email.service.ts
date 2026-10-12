import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { AzureEmailService } from '../auth/azure-email.service';
import { buildInvoicePdf } from './invoice-pdf';
import { buildBillEmail, buildConfirmationEmail } from './templates/bill-email.template';
import { EmailLine, formatInr } from '../mail/email-layout';
import { partWarrantyNote } from './invoice-pdf';

@Injectable()
export class BillEmailService {
  private readonly logger = new Logger(BillEmailService.name);

  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly azureEmail: AzureEmailService,
  ) {}

  async sendConfirmation(bookingId: string): Promise<{ sent: boolean; reason?: string }> {
    const booking = await this.loadBooking(bookingId);
    if (!booking) return { sent: false, reason: 'missing-booking' };
    if (booking.confirmationEmailSentAt) return { sent: false, reason: 'already-sent' };

    const email = this.customerEmail(booking);
    if (!email) {
      this.logger.warn(`Confirmation not emailed for ${bookingId}: customer has no email`);
      return { sent: false, reason: 'no-email' };
    }

    const view = this.confirmationView(booking);
    const message = buildConfirmationEmail(view);
    await this.azureEmail.sendMessage({
      to: email,
      subject: message.subject,
      plainText: message.plainText,
      html: message.html,
    });
    await this.bookingModel.findByIdAndUpdate(bookingId, {
      confirmationEmailSentAt: new Date(),
    });
    this.logger.log(`Confirmation emailed to ${email} for booking ${bookingId}`);
    return { sent: true };
  }

  async sendForBooking(bookingId: string): Promise<{ sent: boolean; reason?: string }> {
    const booking = await this.loadBooking(bookingId);
    if (!booking) return { sent: false, reason: 'missing-booking' };
    if (booking.closeEmailSentAt) return { sent: false, reason: 'already-sent' };

    const email = this.customerEmail(booking);
    if (!email) {
      this.logger.warn(`Bill not emailed for ${bookingId}: customer has no email`);
      return { sent: false, reason: 'no-email' };
    }

    const view = this.mailView(booking);
    const signature = await this.loadSignature(booking.customerSignatureUrl);
    const pdf = await buildInvoicePdf({
      invoiceNumber: view.invoiceNumber,
      issuedAt: booking.invoiceData?.generatedAt
        ? new Date(booking.invoiceData.generatedAt)
        : new Date(),
      customerName: view.customerName || 'Customer',
      customerPhone: booking.contactPhone || (booking.userId as any)?.phone || '',
      customerEmail: email,
      address: booking.addressData?.text || '',
      pincode: booking.addressData?.zip || '',
      serviceName: view.serviceName,
      brand: booking.productDetails?.brand || '',
      technicianName: view.technicianName || '',
      serviceTotal: Number(booking.invoiceData?.serviceTotal || 0),
      parts: booking.invoiceData?.spareParts || [],
      additionalCharges: booking.invoiceData?.additionalCharges || [],
      partsTotal: Number(booking.invoiceData?.partsTotal || 0),
      totalAmount: view.total,
      warrantyPeriod: booking.jobDetails?.warrantyPeriod || '60 Days',
      signature,
    });

    const message = buildBillEmail(view);
    await this.azureEmail.sendMessage({
      to: email,
      subject: message.subject,
      plainText: message.plainText,
      html: message.html,
      attachments: [
        {
          name: `${view.invoiceNumber}.pdf`,
          contentType: 'application/pdf',
          contentInBase64: pdf.toString('base64'),
        },
      ],
    });
    await this.bookingModel.findByIdAndUpdate(bookingId, {
      closeEmailSentAt: new Date(),
    });
    this.logger.log(`Bill emailed to ${email} for booking ${bookingId}`);
    return { sent: true };
  }

  private async loadBooking(bookingId: string) {
    return this.bookingModel
      .findById(bookingId)
      .populate('userId')
      .populate('serviceId')
      .populate('technicianId')
      .exec();
  }

  private customerEmail(booking: BookingDocument): string {
    const email = String((booking.userId as any)?.email || '').trim().toLowerCase();
    return email.includes('@') ? email : '';
  }

  private confirmationView(booking: BookingDocument) {
    const user = booking.userId as any;
    const tech = booking.technicianId as any;
    const id = String(booking._id);
    const skills = Array.isArray(tech?.skills) ? tech.skills.filter(Boolean).join(' · ') : '';
    return {
      customerName: user?.fullName || '',
      repairCode: `#${id.slice(-6).toUpperCase()}`,
      serviceName: (booking.serviceId as any)?.name || 'Appliance repair',
      address: [booking.addressData?.text, booking.addressData?.zip].filter(Boolean).join(', '),
      schedule: [booking.preferredVisitDate, booking.preferredVisitSlot].filter(Boolean).join(' · '),
      notes: String(booking.description || '').trim(),
      technicianName: tech?.name || '',
      technicianPhone: tech?.phone || '',
      technicianSkills: skills,
    };
  }

  private mailView(booking: BookingDocument) {
    const user = booking.userId as any;
    const invoice = booking.invoiceData || ({} as any);
    const id = String(booking._id);
    const lines: EmailLine[] = [];
    const serviceName = (booking.serviceId as any)?.name || 'Appliance repair';
    lines.push({
      label: serviceName,
      detail: 'Base service charge',
      amount: Number(invoice.serviceTotal || 0),
    });
    const partWarranties: string[] = [];
    for (const part of (invoice.spareParts || []) as Array<{
      partName?: string;
      quantity?: number;
      cost?: number;
      warrantyCovered?: boolean;
      warrantyMonths?: number;
      serialNumber?: string;
    }>) {
      const qty = Number(part.quantity) || 1;
      const rate = part.warrantyCovered ? 0 : Number(part.cost) || 0;
      const cover = partWarrantyNote(part);
      if (cover) partWarranties.push(`${part.partName || 'Spare part'} — ${cover}`);
      lines.push({
        label: part.partName || 'Spare part',
        detail: [
          `Qty ${qty}`,
          `${formatInr(rate)} each`,
          part.serialNumber ? `Serial ${part.serialNumber}` : '',
          cover,
        ]
          .filter(Boolean)
          .join(' · '),
        amount: rate * qty,
      });
    }
    for (const charge of invoice.additionalCharges || []) {
      if (!charge?.label) continue;
      lines.push({
        label: charge.label,
        detail: 'Other charge',
        amount: Number(charge.amount) || 0,
      });
    }
    const total = Number(invoice.totalAmount || 0);
    const schedule = [booking.preferredVisitDate, booking.preferredVisitSlot]
      .filter(Boolean)
      .join(' · ');
    return {
      customerName: user?.fullName || '',
      repairCode: `#${id.slice(-6).toUpperCase()}`,
      invoiceNumber: booking.jobDetails?.invoiceNumber?.trim() || `FX-${id.slice(-8).toUpperCase()}`,
      serviceName,
      address: [booking.addressData?.text, booking.addressData?.zip].filter(Boolean).join(', '),
      schedule,
      technicianName: (booking.technicianId as any)?.name || '',
      lines,
      total,
      totalLabel: 'Total',
      partWarranties,
    };
  }

  private async loadSignature(url?: string): Promise<Buffer | null> {
    if (!url) return null;
    try {
      if (url.startsWith('data:image')) {
        const encoded = url.split(',')[1];
        return encoded ? Buffer.from(encoded, 'base64') : null;
      }
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const response = await axios.get<ArrayBuffer>(url, {
          responseType: 'arraybuffer',
          timeout: 8000,
          maxContentLength: 2_000_000,
        });
        return Buffer.from(response.data);
      }
    } catch (error) {
      this.logger.warn(`Could not load customer signature: ${error}`);
    }
    return null;
  }
}
