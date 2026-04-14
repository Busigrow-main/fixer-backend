import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { BookingsService } from '../bookings/bookings.service';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { PartOrdersService } from '../part-orders/part-orders.service';

@Injectable()
export class AdminService {
  constructor(
    private usersService: UsersService,
    private bookingsService: BookingsService,
    private sparePartsService: SparePartsService,
    private partOrdersService: PartOrdersService,
  ) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalBookings,
      bookingsByStatus,
      totalSpareParts,
      totalOrders,
      ordersByStatus,
    ] = await Promise.all([
      this.usersService.countAll(),
      this.bookingsService.countAll(),
      this.bookingsService.countByStatus(),
      this.sparePartsService.countAll(),
      this.partOrdersService.countAll(),
      this.partOrdersService.countByStatus(),
    ]);

    return {
      users: { total: totalUsers },
      bookings: { total: totalBookings, byStatus: bookingsByStatus },
      spareParts: { total: totalSpareParts },
      orders: { total: totalOrders, byStatus: ordersByStatus },
    };
  }

  async getUsers(page: number, limit: number) {
    return this.usersService.findAll(page, limit);
  }

  async updateUserRole(id: string, role: string) {
    return this.usersService.updateRole(id, role);
  }

  /**
   * Parse and validate rows from CSV/XLSX upload.
   * Returns validated documents ready for bulkUpsert.
   */
  validateAndTransformRows(rows: any[]): { valid: any[]; errors: { row: number; reason: string }[] } {
    const valid: any[] = [];
    const errors: { row: number; reason: string }[] = [];

    const COLUMN_MAP: Record<string, string> = {
      'partnumber': 'partNumber',
      'part number': 'partNumber',
      'part no': 'partNumber',
      'part_no': 'partNumber',
      'sku': 'partNumber',
      'inventory id': 'partNumber',
      'description': 'name',
      'part name': 'name',
      'name': 'name',
      'mrp': 'price',
      'price': 'price',
      'customer price': 'price',
      'cost': 'price',
      'category': 'category',
      'group': 'category',
      'stock': 'stock',
      'quantity': 'stock',
      'qty': 'stock',
      'manufacturer': 'manufacturer',
      'brand': 'manufacturer',
      'image': 'image',
      'image url': 'image',
      'image_url': 'image',
      'seller': 'seller',
    };

    rows.forEach((rawRow, index) => {
      const transformed: any = {};

      // Map columns dynamically
      Object.keys(rawRow).forEach((key) => {
        const normalizedKey = key.toLowerCase().trim();
        const targetField = COLUMN_MAP[normalizedKey];
        if (targetField && rawRow[key] !== undefined && rawRow[key] !== null && rawRow[key] !== '') {
          const val = rawRow[key];
          transformed[targetField] = typeof val === 'string' ? val.trim() : val;
        }
      });

      // Validate required fields
      if (!transformed.partNumber) {
        errors.push({ row: index + 2, reason: 'Missing required field: partNumber/SKU' });
        return;
      }
      if (!transformed.name) {
        errors.push({ row: index + 2, reason: 'Missing required field: name' });
        return;
      }

      // Normalize
      const partNumber = String(transformed.partNumber).toUpperCase();
      const rawPrice = transformed.price || 0;
      const numericPrice = parseFloat(String(rawPrice).replace(/[₹,\s]/g, ''));
      const formattedPrice = isNaN(numericPrice) ? '₹0' : `₹${numericPrice.toLocaleString('en-IN')}`;

      valid.push({
        slug: `part-${partNumber.toLowerCase()}`,
        partNumber,
        name: transformed.name,
        category: transformed.category || 'General',
        price: formattedPrice,
        stock: parseInt(transformed.stock) || 0,
        manufacturer: transformed.manufacturer || 'Generic',
        seller: transformed.seller || 'Fixxer OEM Hub',
        image: transformed.image || 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=800&auto=format&fit=crop',
        description: `${transformed.name} — Genuine spare part (${partNumber})`,
      });
    });

    return { valid, errors };
  }

  async processBulkUpload(rows: any[]) {
    const { valid, errors: validationErrors } = this.validateAndTransformRows(rows);

    if (valid.length === 0) {
      return {
        totalProcessed: rows.length,
        inserted: 0,
        updated: 0,
        failed: validationErrors.length,
        errors: validationErrors.slice(0, 100),
      };
    }

    const result = await this.sparePartsService.bulkUpsert(valid);
    return {
      ...result,
      failed: result.failed + validationErrors.length,
      errors: [...validationErrors, ...result.errors].slice(0, 100),
    };
  }
}
