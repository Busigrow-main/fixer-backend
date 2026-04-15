import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Res,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { BookingsService } from '../bookings/bookings.service';
import { PartOrdersService } from '../part-orders/part-orders.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const csv = require('csv-parser');
import * as xlsx from 'xlsx';
import { Readable } from 'stream';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly sparePartsService: SparePartsService,
    private readonly bookingsService: BookingsService,
    private readonly partOrdersService: PartOrdersService,
  ) {}

  // ─── Dashboard ────────────────────────────────────────────
  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ─── Users ────────────────────────────────────────────────
  @Get('users')
  async getUsers(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.adminService.getUsers(parseInt(page), parseInt(limit));
  }

  @Put('users/:id/role')
  async updateUserRole(@Param('id') id: string, @Body('role') role: string) {
    if (!['CUSTOMER', 'ADMIN'].includes(role)) {
      throw new BadRequestException('Invalid role. Must be CUSTOMER or ADMIN');
    }
    return this.adminService.updateUserRole(id, role);
  }

  // ─── Bookings (paginated) ─────────────────────────────────
  @Get('bookings')
  async getBookings(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.bookingsService.findAllForAdmin(parseInt(page), parseInt(limit), status);
  }

  @Get('bookings/:id')
  async getBooking(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Put('bookings/:id/status')
  async updateBookingStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.bookingsService.updateStatus(id, status);
  }

  @Put('bookings/:id/assign')
  async assignTechnician(@Param('id') id: string, @Body('technicianId') technicianId: string) {
    return this.bookingsService.assignTechnician(id, technicianId);
  }

  @Post('bookings/:id/notes')
  async addBookingNote(@Param('id') id: string, @Body('note') note: string) {
    return this.bookingsService.addAdminNote(id, note);
  }

  @Put('bookings/:id/job-details')
  async updateJobDetails(@Param('id') id: string, @Body() details: any) {
    return this.bookingsService.updateJobDetails(id, details);
  }

  @Put('bookings/:id/finalize-invoice')
  async finalizeInvoice(@Param('id') id: string) {
    return this.bookingsService.finalizeInvoice(id);
  }

  // ─── Part Orders (paginated) ──────────────────────────────
  @Get('part-orders')
  async getPartOrders(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.partOrdersService.findAllForAdmin(parseInt(page), parseInt(limit), status);
  }

  @Put('part-orders/:id/status')
  async updateOrderStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.partOrdersService.updateStatus(id, status);
  }

  @Put('part-orders/:id/tracking')
  async attachTracking(@Param('id') id: string, @Body() trackingData: { courierName: string; trackingNumber: string }) {
    return this.partOrdersService.attachTracking(id, trackingData);
  }

  // ─── Spare Parts Bulk Upload ──────────────────────────────
  @Post('spare-parts/bulk-upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (_req, file, cb) => {
      const ext = file.originalname.toLowerCase();
      if (ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only CSV and XLSX files are supported'), false);
      }
    },
  }))
  async bulkUpload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileName = file.originalname.toLowerCase();
    let rows: any[];

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Parse XLSX using the xlsx library (already installed)
      rows = this.parseXlsx(file.buffer);
    } else {
      // Parse CSV using stream-based csv-parser
      rows = await this.parseCsv(file.buffer);
    }

    if (!rows || rows.length === 0) {
      throw new BadRequestException('File contains no data rows');
    }

    return this.adminService.processBulkUpload(rows);
  }

  private parseXlsx(buffer: Buffer): any[] {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
  }

  private parseCsv(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      const stream = Readable.from(buffer.toString());

      stream
        .pipe(csv())
        .on('data', (row: any) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', (err: Error) => reject(new BadRequestException(`CSV parsing error: ${err.message}`)));
    });
  }

  // ─── Spare Parts Export ───────────────────────────────────
  @Get('spare-parts/export')
  async exportSpareParts(@Res() res: Response) {
    const parts = await this.sparePartsService.exportAll();

    // Build CSV
    const headers = ['partNumber', 'name', 'category', 'subCategory', 'price', 'stock', 'manufacturer', 'seller', 'description', 'warranty', 'delivery eta', 'highlights', 'compatible models', 'supports service', 'image'];
    const fieldMap: Record<string, string> = {
      'delivery eta': 'deliveryEta',
      'compatible models': 'compatibleModels',
      'supports service': 'supportsServiceBooking',
    };
    const csvRows = [
      headers.join(','),
      ...parts.map((p: any) =>
        headers.map(h => {
          const field = fieldMap[h] || h;
          let val = p[field];
          // Join arrays with pipe for CSV
          if (Array.isArray(val)) val = val.join(' | ');
          val = String(val ?? '').replace(/"/g, '""');
          return `"${val}"`;
        }).join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=spare-parts-export.csv');
    res.send(csvRows.join('\n'));
  }

  // ─── Bookings Export ──────────────────────────────────────
  @Get('bookings/export')
  async exportBookings(@Res() res: Response) {
    const { data: bookings } = await this.bookingsService.findAllForAdmin(1, 100000);

    const headers = ['_id', 'status', 'contactPhone', 'description', 'createdAt'];
    const csvRows = [
      headers.join(','),
      ...bookings.map((b: any) =>
        headers.map(h => {
          const val = String(b[h] || '').replace(/"/g, '""');
          return `"${val}"`;
        }).join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bookings-export.csv');
    res.send(csvRows.join('\n'));
  }

  // ─── Template Downloads ───────────────────────────────────
  @Get('spare-parts/template')
  async downloadTemplate(@Res() res: Response) {
    const lines = [
      'partNumber,name,category,subCategory,price,stock,manufacturer,seller,description,warranty,delivery eta,highlights,compatible models,supports service,image',
      'SMSG-RF-001,Inverter Compressor Module,Refrigerator,Double Door,6499,15,Samsung,Fixxer OEM Hub,"High-efficiency compressor for premium refrigerators",12 months OEM warranty,2-3 business days,Factory-sealed copper winding | Low-noise inverter | Energy class A+,FrostPro 340L | EcoFreeze 390,yes,https://example.com/image.jpg',
      'LG-WM-001,Drum Belt 8kg,Washing Machine,Front Load,899,40,LG,Fixxer Parts Partner,"Durable drive belt for smooth drum rotation",6 months replacement,Same day dispatch,Heat-resistant polymer | Anti-slip groove,WashMate 8 | HydroClean 7.5,yes,https://example.com/image2.jpg',
    ];
    const csvContent = lines.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=spare-parts-template.csv');
    res.send(csvContent);
  }
}
