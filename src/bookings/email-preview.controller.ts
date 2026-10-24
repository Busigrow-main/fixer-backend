import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JWT_AUTH } from '../common/swagger';
import { buildEmailPreviewPage } from './templates/bill-email.template';
import { buildInvoicePdf } from './invoice-pdf';

@ApiTags('Internal')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('api/v1/email-preview')
export class EmailPreviewController {
  @Get('bill')
  @ApiProduces('application/pdf')
  async bill(@Res() res: Response) {
    const pdf = await buildInvoicePdf({
      invoiceNumber: 'FX-18C8FE',
      issuedAt: new Date('2026-10-12'),
      customerName: 'Abhas',
      customerPhone: '6789543210',
      customerEmail: 'abhas@example.com',
      address: 'Boring Road',
      pincode: '800001',
      serviceName: 'Microwave repair',
      brand: 'Godrej',
      technicianName: 'Surya',
      serviceTotal: 400,
      parts: [
        {
          partName: 'Godrej turntable motor',
          quantity: 2,
          cost: 757.5,
          serialNumber: 'E2E-BILL-335',
          warrantyMonths: 12,
        },
      ],
      additionalCharges: [{ label: 'Call-out', amount: 50 }],
      partsTotal: 1515,
      totalAmount: 1965,
      warrantyPeriod: '60 Days',
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="fixxer-service-bill.pdf"');
    res.send(pdf);
  }

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  preview(): string {
    return buildEmailPreviewPage();
  }
}
