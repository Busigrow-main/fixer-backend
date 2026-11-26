import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
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
import { WarrantiesService } from '../warranties/warranties.service';
import { UpdateOrderBillDto } from '../part-orders/dtos/update-order-bill.dto';
import { ServiceablePincodesService } from '../serviceable-pincodes/serviceable-pincodes.service';
import { CreateServiceablePincodeDto } from '../serviceable-pincodes/dto/create-serviceable-pincode.dto';
import { UpdateServiceablePincodeDto } from '../serviceable-pincodes/dto/update-serviceable-pincode.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { JWT_AUTH } from '../common/swagger';
import {
  AssignTechnicianDto,
  BookingSlotDto,
  BookingStatusDto,
  FixxerCodeDto,
  NoteDto,
  QualityReviewDto,
  RoleBodyDto,
  ShopSettingsDto,
  StatusReasonDto,
  TrackingDto,
} from '../common/body.dto';
import { ShopSettingsService } from '../shop/shop-settings.service';
import { TechnicianScheduleService } from '../technician-engine/technician-schedule.service';
// Import the pure files directly — the technician-engine index also re-exports the Nest
// module, which would pull AuthModule (and its JWT_SECRET check) into this file's imports.
import { TechnicianEngineError } from '../technician-engine/technician-engine';
import { assertValidSlot } from '../technician-engine/technician-schedule';
import { CustomerServiceHistoryService } from './customer-service-history.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const csv = require('csv-parser');
import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';

function excelCellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value == null) return null;
  if (typeof value === 'object') {
    if (value instanceof Date) return value;
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('result' in value) return value.result ?? null;
  }
  return value;
}

@ApiTags('Admin')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly sparePartsService: SparePartsService,
    private readonly bookingsService: BookingsService,
    private readonly partOrdersService: PartOrdersService,
    private readonly warrantiesService: WarrantiesService,
    private readonly serviceablePincodesService: ServiceablePincodesService,
    private readonly shopSettingsService: ShopSettingsService,
    private readonly customerServiceHistoryService: CustomerServiceHistoryService,
    private readonly technicianSchedule: TechnicianScheduleService,
  ) {}

  // ─── Dashboard ────────────────────────────────────────────
  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ─── Fixxer Shop settings ─────────────────────────────────
  @Get('shop-settings')
  @ApiOperation({ summary: 'Get Fixxer Shop maintenance settings' })
  async getShopSettings() {
    const settings = await this.shopSettingsService.getSettings();
    return {
      maintenanceEnabled: Boolean(settings.maintenanceEnabled),
      maintenanceMessage: settings.maintenanceMessage,
      updatedAt: (settings as any).updatedAt ?? null,
      updatedBy: settings.updatedBy ?? null,
    };
  }

  @Put('shop-settings')
  @ApiOperation({ summary: 'Enable or disable Fixxer Shop maintenance mode' })
  async updateShopSettings(
    @Body() body: ShopSettingsDto,
    @Req() req: any,
  ) {
    if (
      body.maintenanceEnabled === undefined &&
      body.maintenanceMessage === undefined
    ) {
      throw new BadRequestException(
        'Provide maintenanceEnabled and/or maintenanceMessage',
      );
    }
    const settings = await this.shopSettingsService.updateSettings({
      maintenanceEnabled:
        body.maintenanceEnabled === undefined
          ? undefined
          : Boolean(body.maintenanceEnabled),
      maintenanceMessage: body.maintenanceMessage,
      updatedBy: req.user?.userId || req.user?.sub,
    });
    return {
      maintenanceEnabled: Boolean(settings.maintenanceEnabled),
      maintenanceMessage: settings.maintenanceMessage,
      updatedAt: (settings as any).updatedAt ?? null,
      updatedBy: settings.updatedBy ?? null,
    };
  }

  @Get('revenue')
  async getRevenue() {
    return this.bookingsService.getFixxerRevenueStats();
  }

  // ─── Users ────────────────────────────────────────────────
  @Get('users')
  async getUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.getUsers(
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('customers/:customerId/service-history')
  @ApiOperation({ summary: 'Get a customer profile with paginated booking and service history' })
  async getCustomerServiceHistory(
    @Param('customerId') customerId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('phone') phone?: string,
  ) {
    return this.customerServiceHistoryService.getCustomerServiceHistory(
      customerId,
      Number(page),
      Number(limit),
      phone,
    );
  }

  @Get('appliance-mappings/by-serial/:serial/timeline')
  @ApiOperation({ summary: 'Get an appliance mapping with its paginated service timeline' })
  async getApplianceServiceTimeline(
    @Param('serial') serial: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.customerServiceHistoryService.getApplianceServiceTimeline(
      serial,
      Number(page),
      Number(limit),
    );
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Set a user role to CUSTOMER or ADMIN' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() body: RoleBodyDto,
  ) {
    if (!['CUSTOMER', 'ADMIN'].includes(body.role)) {
      throw new BadRequestException(
        'Invalid role. Must be CUSTOMER or ADMIN',
      );
    }

    return this.adminService.updateUserRole(id, body.role);
  }

  // ─── Bookings (paginated) ─────────────────────────────────
  @Get('bookings')
  async getBookings(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('dispatchStatus') dispatchStatus?: string,
    @Query('cancelledBy') cancelledBy?: 'CUSTOMER' | 'ADMIN',
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.bookingsService.findAllForAdmin(
      parseInt(page),
      parseInt(limit),
      status,
      dispatchStatus,
      cancelledBy,
      search,
      fromDate,
      toDate,
    );
  }

  /** Unclaimed jobs escalated after 10 minutes — admin must assign. */
  @Get('bookings/needs-assignment')
  async getNeedsAssignment(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.bookingsService.findAllForAdmin(
      parseInt(page),
      parseInt(limit),
      'NEEDS_ASSIGNMENT',
    );
  }

  /** Completed/paid jobs waiting on supervisor quality review. */
  @Get('bookings/awaiting-review')
  async getAwaitingReview(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.bookingsService.findAllForAdmin(
      parseInt(page),
      parseInt(limit),
      'AWAITING_REVIEW',
    );
  }

  // ─── Bookings Export ──────────────────────────────────────
  @Get('bookings/export')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export bookings as CSV' })
  async exportBookings(@Res() res: Response) {
    const { data: bookings } =
      await this.bookingsService.findAllForAdmin(1, 100000);

    const headers = [
      '_id',
      'status',
      'contactPhone',
      'description',
      'createdAt',
    ];

    const csvRows = [
      headers.join(','),
      ...bookings.map((b: any) =>
        headers
          .map((h) => {
            const val = String(b[h] || '').replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(','),
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=bookings-export.csv',
    );
    res.send(csvRows.join('\n'));
  }

  @Get('bookings/:id')
  async getBooking(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Put('bookings/:id/status')
  @ApiOperation({ summary: 'Update booking status' })
  async updateBookingStatus(
    @Param('id') id: string,
    @Body() body: BookingStatusDto,
    @Req() req: any,
  ) {
    return this.bookingsService.updateStatus(
      id,
      body.status,
      body.reason,
      body.fixxerCode,
      {
        actorRole: 'ADMIN',
        actorId: req.user?.userId || req.user?.sub,
        reason: body.reason,
      },
    );
  }

  @Put('bookings/:id/assign')
  @ApiOperation({ summary: 'Assign a technician to a booking' })
  async assignTechnician(
    @Param('id') id: string,
    @Body() body: AssignTechnicianDto,
    @Req() req: any,
  ) {
    return this.bookingsService.assignTechnician(
      id,
      body.technicianId,
      {
        actorRole: 'ADMIN',
        actorId: req.user?.userId || req.user?.sub,
        reason: body.reason,
      },
      body.scheduledStart || body.scheduledEnd
        ? { start: body.scheduledStart, end: body.scheduledEnd, override: !!body.override }
        : undefined,
    );
  }

  @Put('bookings/:id/slot')
  @ApiOperation({ summary: 'Change the time slot of a not-started Fixxer-staff booking' })
  async rescheduleSlot(
    @Param('id') id: string,
    @Body() body: BookingSlotDto,
    @Req() req: any,
  ) {
    return this.bookingsService.rescheduleSlot(
      id,
      { start: body.scheduledStart, end: body.scheduledEnd, override: !!body.override },
      {
        actorRole: 'ADMIN',
        actorId: req.user?.userId || req.user?.sub,
        reason: body.reason,
      },
    );
  }

  // ─── Fixxer staff schedule ────────────────────────────────
  @Get('schedule')
  @ApiOperation({ summary: 'Day board: staff technicians, their slots, unassigned bookings' })
  async getDaySchedule(@Query('date') date?: string) {
    return this.technicianSchedule.daySchedule(parseServiceDay(date));
  }

  @Get('schedule/free-technicians')
  @ApiOperation({ summary: 'Fixxer staff free for the whole window [start, end)' })
  async getFreeTechnicians(
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('excludeBookingId') excludeBookingId?: string,
  ) {
    const window = toSlot(start, end);
    const eligibility = excludeBookingId
      ? await this.bookingsService.slotEligibilityFor(excludeBookingId)
      : undefined;
    return this.technicianSchedule.freeStaffFor(window, undefined, excludeBookingId, eligibility);
  }

  @Get('schedule/check')
  @ApiOperation({ summary: 'Clash check for one technician + window (no write)' })
  async checkSlot(
    @Query('technicianId') technicianId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('excludeBookingId') excludeBookingId?: string,
  ) {
    if (!technicianId) throw new BadRequestException('technicianId is required');
    const eligibility = excludeBookingId
      ? await this.bookingsService.slotEligibilityFor(excludeBookingId)
      : undefined;
    return this.technicianSchedule.checkSlot(
      technicianId,
      toSlot(start, end),
      excludeBookingId,
      undefined,
      eligibility,
    );
  }

  @Get('schedule/technicians/:id/free-slots')
  @ApiOperation({ summary: 'Free gaps (8 AM–9 PM IST) that fit `duration` minutes' })
  async getFreeSlots(
    @Param('id') id: string,
    @Query('date') date: string,
    @Query('duration') duration: string,
  ) {
    const minutes = Number(duration);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new BadRequestException('duration (minutes) must be greater than zero');
    }
    return this.technicianSchedule.freeSlotsFor(id, parseServiceDay(date), minutes);
  }

  @Put('bookings/:id/unassign')
  @ApiOperation({ summary: 'Remove the technician from a booking without a replacement' })
  async unassignTechnician(@Param('id') id: string, @Req() req: any) {
    return this.bookingsService.unassignTechnician(id, {
      actorRole: 'ADMIN',
      actorId: req.user?.userId || req.user?.sub,
    });
  }

  @Get('bookings/:id/change-history')
  @ApiOperation({
    summary: 'List append-only change history for a booking (admin only)',
  })
  async getChangeHistory(@Param('id') id: string) {
    return this.bookingsService.getChangeHistory(id);
  }

  @Post('bookings/:id/notes')
  @ApiOperation({ summary: 'Add an admin note to a booking' })
  async addBookingNote(
    @Param('id') id: string,
    @Body() body: NoteDto,
  ) {
    return this.bookingsService.addAdminNote(id, body.note);
  }

  @Put('bookings/:id/job-details')
  async updateJobDetails(
    @Param('id') id: string,
    @Body() details: any,
  ) {
    return this.bookingsService.updateJobDetails(
      id,
      details,
    );
  }

  @Put('bookings/:id/product-details')
  async updateProductDetails(
    @Param('id') id: string,
    @Body() details: any,
  ) {
    return this.bookingsService.updateProductDetails(
      id,
      details,
    );
  }

  @Put('bookings/:id/service-properties')
  async updateServiceProperties(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: any,
  ) {
    return this.bookingsService.updateServiceProperties(id, data, {
      actorRole: 'ADMIN',
      actorId: req.user?.userId || req.user?.sub,
    });
  }

  @Put('bookings/:id/invoice-manual')
  async updateInvoiceManual(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: any,
  ) {
    return this.bookingsService.updateInvoiceManual(id, data, {
      actorRole: 'ADMIN',
      actorId: req.user?.userId || req.user?.sub,
    });
  }

  @Put('bookings/:id/finalize-invoice')
  @ApiOperation({ summary: 'Finalize a booking invoice' })
  async finalizeInvoice(
    @Param('id') id: string,
    @Body() body: FixxerCodeDto,
    @Req() req: any,
  ) {
    return this.bookingsService.finalizeInvoice(id, body?.fixxerCode, {
      actorRole: 'ADMIN',
      actorId: req.user?.userId || req.user?.sub,
      reason: 'finalize-invoice',
    });
  }

  @Put('bookings/:id/quality-review')
  @ApiOperation({
    summary:
      'Record supervisor quality review without changing payment or completion',
  })
  async submitQualityReview(
    @Param('id') id: string,
    @Body() body: QualityReviewDto,
    @Req() req: any,
  ) {
    return this.bookingsService.submitQualityReview(
      id,
      req.user?.userId || req.user?.sub,
      body.status,
      body.remarks,
    );
  }

  @Post('bookings/:id/corrective')
  @ApiOperation({
    summary:
      'Create a corrective follow-up booking linked to the original completed job',
  })
  async createCorrectiveBooking(@Param('id') id: string) {
    return this.bookingsService.createCorrectiveBooking(id);
  }

  @Get('bookings/:id/warranties')
  async getBookingWarranties(@Param('id') id: string) {
    return this.warrantiesService.findByBooking(id);
  }

  @Get('warranties/by-serial/:serial')
  async getWarrantyBySerial(
    @Param('serial') serial: string,
  ) {
    const warranty =
      await this.warrantiesService.findBySerial(serial);

    if (!warranty) {
      throw new BadRequestException(
        `No warranty found for serial ${serial}`,
      );
    }

    return warranty;
  }

  @Get('warranties')
  async lookupWarranty(@Query('serial') serial?: string) {
    if (!serial?.trim()) {
      throw new BadRequestException(
        'serial query parameter is required',
      );
    }

    const warranty =
      await this.warrantiesService.findBySerial(serial);

    if (!warranty) {
      return {
        found: false,
        warranty: null,
      };
    }

    return {
      found: true,
      warranty,
    };
  }

  // ─── Part Orders (paginated) ──────────────────────────────
  @Get('part-orders')
  async getPartOrders(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('orderType') orderType?: 'part' | 'appliance',
    @Query('cancelledBy') cancelledBy?: 'CUSTOMER' | 'ADMIN',
  ) {
    return this.partOrdersService.findAllForAdmin(
      parseInt(page, 10),
      parseInt(limit, 10),
      status,
      orderType,
      cancelledBy,
    );
  }

  @Get('part-orders/:id')
  async getPartOrder(@Param('id') id: string) {
    return this.partOrdersService.findOne(id);
  }

  @Put('part-orders/:id/bill')
  async upsertPartOrderBill(
    @Param('id') id: string,
    @Body() body: UpdateOrderBillDto,
  ) {
    return this.partOrdersService.upsertBill(id, body);
  }

  @Put('part-orders/:id/mark-paid')
  async markPartOrderPaid(@Param('id') id: string) {
    return this.partOrdersService.markPaymentComplete(id);
  }

  @Put('part-orders/:id/status')
  @ApiOperation({ summary: 'Update shop order status' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: StatusReasonDto,
  ) {
    return this.partOrdersService.updateStatus(
      id,
      body.status,
      body.reason,
    );
  }

  @Put('part-orders/:id/tracking')
  @ApiOperation({ summary: 'Attach courier tracking (sets DISPATCHED)' })
  async attachTracking(
    @Param('id') id: string,
    @Body()
    trackingData: TrackingDto,
  ) {
    return this.partOrdersService.attachTracking(
      id,
      trackingData,
    );
  }

  // ─── Spare Parts Bulk Upload ──────────────────────────────
  @Post('spare-parts/bulk-upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Bulk upload spare parts from CSV or XLSX' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = file.originalname.toLowerCase();

        if (ext.endsWith('.csv') || ext.endsWith('.xlsx')) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only CSV and XLSX files are supported',
            ),
            false,
          );
        }
      },
    }),
  )
  async bulkUpload(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileName = file.originalname.toLowerCase();
    let rows: any[];

    if (fileName.endsWith('.xlsx')) {
      rows = await this.parseXlsx(file.buffer);
    } else {
      rows = await this.parseCsv(file.buffer);
    }

    if (!rows || rows.length === 0) {
      throw new BadRequestException(
        'File contains no data rows',
      );
    }

    return this.adminService.processBulkUpload(rows);
  }

  private async parseXlsx(buffer: Buffer): Promise<any[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const rows: Record<string, unknown>[] = [];
    let headers: Array<string | undefined> = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values[colNumber] = excelCellValue(cell);
      });
      if (rowNumber === 1) {
        headers = values.map((value) =>
          value == null || value === '' ? undefined : String(value),
        );
        return;
      }
      const obj: Record<string, unknown> = {};
      for (let i = 1; i < headers.length; i++) {
        const key = headers[i];
        if (!key) continue;
        obj[key] = values[i] === undefined ? null : values[i];
      }
      rows.push(obj);
    });

    return rows;
  }

  private parseCsv(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      const stream = Readable.from(buffer.toString());

      stream
        .pipe(csv())
        .on('data', (row: any) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', (err: Error) =>
          reject(
            new BadRequestException(
              `CSV parsing error: ${err.message}`,
            ),
          ),
        );
    });
  }

  // ─── Spare Parts Export ───────────────────────────────────
  @Get('spare-parts/export')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export spare parts as CSV' })
  async exportSpareParts(@Res() res: Response) {
    const parts =
      await this.sparePartsService.exportAll();

    const headers = [
      'partNumber',
      'name',
      'category',
      'subCategory',
      'price',
      'stock',
      'manufacturer',
      'seller',
      'description',
      'warranty',
      'delivery eta',
      'highlights',
      'compatible models',
      'supports service',
      'image',
    ];

    const fieldMap: Record<string, string> = {
      'delivery eta': 'deliveryEta',
      'compatible models': 'compatibleModels',
      'supports service': 'supportsServiceBooking',
    };

    const csvRows = [
      headers.join(','),
      ...parts.map((p: any) =>
        headers
          .map((h) => {
            const field = fieldMap[h] || h;
            let val = p[field];

            if (Array.isArray(val)) {
              val = val.join(' | ');
            }

            val = String(val ?? '').replace(/"/g, '""');

            return `"${val}"`;
          })
          .join(','),
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=spare-parts-export.csv',
    );
    res.send(csvRows.join('\n'));
  }

  // ─── Template Downloads ───────────────────────────────────
  @Get('spare-parts/template')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Download spare-parts CSV template' })
  async downloadTemplate(@Res() res: Response) {
    const lines = [
      'partNumber,name,category,subCategory,price,stock,manufacturer,seller,description,warranty,delivery eta,highlights,compatible models,supports service,image',
      'SMSG-RF-001,Inverter Compressor Module,Refrigerator,Double Door,6499,15,Samsung,Fixxer OEM Hub,"High-efficiency compressor for premium refrigerators",12 months OEM warranty,2-3 business days,Factory-sealed copper winding | Low-noise inverter | Energy class A+,FrostPro 340L | EcoFreeze 390,yes,https://example.com/image.jpg',
      'LG-WM-001,Drum Belt 8kg,Washing Machine,Front Load,899,40,LG,Fixxer Parts Partner,"Durable drive belt for smooth drum rotation",6 months replacement,Same day dispatch,Heat-resistant polymer | Anti-slip groove,WashMate 8 | HydroClean 7.5,yes,https://example.com/image2.jpg',
    ];

    const csvContent = lines.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=spare-parts-template.csv',
    );
    res.send(csvContent);
  }

  // ─── Serviceable Pincodes ─────────────────────────────────
  @Get('serviceable-pincodes')
  async getServiceablePincodes() {
    return this.serviceablePincodesService.findAll();
  }

  @Post('serviceable-pincodes')
  async createServiceablePincode(
    @Body() createDto: CreateServiceablePincodeDto,
  ) {
    return this.serviceablePincodesService.create(
      createDto,
    );
  }

  @Put('serviceable-pincodes/:id')
  async updateServiceablePincode(
    @Param('id') id: string,
    @Body() updateDto: UpdateServiceablePincodeDto,
  ) {
    return this.serviceablePincodesService.update(
      id,
      updateDto,
    );
  }

  @Put('serviceable-pincodes/:id/deactivate')
  async deactivateServiceablePincode(
    @Param('id') id: string,
  ) {
    return this.serviceablePincodesService.remove(id);
  }
}

/** `YYYY-MM-DD` (IST) → an instant inside that day; defaults to today. */
function parseServiceDay(date?: string): Date {
  if (!date) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException('date must be YYYY-MM-DD');
  }
  return new Date(`${date}T12:00:00.000+05:30`);
}

function toSlot(start: string, end: string) {
  try {
    return assertValidSlot({ start, end });
  } catch (err) {
    if (err instanceof TechnicianEngineError) throw new BadRequestException(err.message);
    throw err;
  }
}
