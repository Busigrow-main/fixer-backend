import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePartOrderDto } from '../part-orders/dtos/create-part-order.dto';
import { PartOrdersService } from '../part-orders/part-orders.service';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { ServiceablePincodesService } from '../serviceable-pincodes/serviceable-pincodes.service';
import { CartService } from './cart.service';
import { CreateCheckoutDto } from './dtos/checkout.dto';
import { InstallationService } from './installation.service';
import {
  applyDiscount,
  DELIVERY_CHARGE_RUPEES,
  money,
  paiseToRupees,
} from './shop-pricing';

@Injectable()
export class CheckoutService {
  private readonly checkoutLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly cartService: CartService,
    private readonly installationService: InstallationService,
    private readonly partOrdersService: PartOrdersService,
    private readonly sparePartsService: SparePartsService,
    private readonly serviceablePincodesService: ServiceablePincodesService,
  ) {}

  async quote(userId: string, pincode: string) {
    return this.buildQuote(userId, pincode);
  }

  async checkout(userId: string, dto: CreateCheckoutDto) {
    if (dto.paymentMethod !== 'COD') {
      throw new BadRequestException('Cash on delivery is the only payment method');
    }
    return this.withUserLock(userId, () => this.checkoutLocked(userId, dto));
  }

  private async withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.checkoutLocks.get(userId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(fn);
    const tail = run.then(() => undefined).catch(() => undefined);
    this.checkoutLocks.set(userId, tail);
    try {
      return await run;
    } finally {
      if (this.checkoutLocks.get(userId) === tail) {
        this.checkoutLocks.delete(userId);
      }
    }
  }

  private async checkoutLocked(userId: string, dto: CreateCheckoutDto) {
    const quote = await this.buildQuote(userId, dto.pincode, true);
    const claimed = await this.cartService.claimForCheckout(userId);
    if (!claimed) {
      throw new BadRequestException('Cart is empty');
    }

    const decremented: { id: string; quantity: number }[] = [];
    const createdIds: string[] = [];
    try {
      for (const item of quote.items) {
        if (item.productType !== 'part') continue;
        const reserved = await this.sparePartsService.tryDecrementStock(
          item.productId,
          item.quantity,
        );
        if (!reserved) {
          throw new BadRequestException(`${item.name} is out of stock`);
        }
        if (reserved !== 'unlimited') {
          decremented.push({ id: item.productId, quantity: item.quantity });
        }
      }

      return await this.createOrders(userId, dto, quote, createdIds);
    } catch (err) {
      for (const id of createdIds) {
        await this.partOrdersService.abortIfUnpaid(id);
      }
      for (const row of decremented) {
        await this.sparePartsService.restoreStock(row.id, row.quantity);
      }
      await this.cartService.restoreClaimed(userId, claimed);
      throw err;
    }
  }

  private async createOrders(
    userId: string,
    dto: CreateCheckoutDto,
    quote: Awaited<ReturnType<CheckoutService['buildQuote']>>,
    createdIds: string[],
  ) {
    const contactData = {
      ...dto.contactData,
      notes: [dto.contactData.notes, dto.notes, `Pincode ${dto.pincode}`]
        .filter(Boolean)
        .join(' · '),
    };

    const orders: any[] = [];
    const partLines = quote.items.filter((item) => item.productType === 'part');
    const applianceLines = quote.items.filter(
      (item) => item.productType === 'appliance',
    );

    if (partLines.length) {
      const extraInstall = partLines.filter((item) => item.installationCharge > 0);
      const order = await this.partOrdersService.create(
        {
          orderType: 'part',
          contactData,
          items: partLines.map((item) => ({
            partId: item.productId,
            quantity: item.quantity,
          })),
        } as CreatePartOrderDto,
        userId,
        {
          paymentMethod: 'COD',
          stockAlreadyReserved: true,
          discount: quote.discount,
          invoiceLines: [
            ...partLines.map((item) => ({
              description: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
            ...extraInstall.map((item) => ({
              description: `Installation · ${item.name}`,
              quantity: item.quantity,
              unitPrice: item.installationCharge,
            })),
            ...(quote.deliveryCharge
              ? [
                  {
                    description: 'Delivery',
                    quantity: 1,
                    unitPrice: quote.deliveryCharge,
                  },
                ]
              : []),
          ],
        },
      );
      createdIds.push(String((order as any)._id));
      orders.push(order);
    }

    for (const item of applianceLines) {
      const extraLines = [];
      if (item.installationCharge > 0) {
        extraLines.push({
          description: `Installation · ${item.name}`,
          quantity: item.quantity,
          unitPrice: item.installationCharge,
        });
      }
      if (!partLines.length && quote.deliveryCharge) {
        extraLines.push({
          description: 'Delivery',
          quantity: 1,
          unitPrice: quote.deliveryCharge,
        });
      }
      const order = await this.partOrdersService.create(
        {
          orderType: 'appliance',
          contactData,
          applianceItem: {
            applianceId: item.productId,
            slug: item.slug,
            name: item.name,
            price: item.unitPrice,
            quantity: item.quantity,
          },
        } as CreatePartOrderDto,
        userId,
        {
          paymentMethod: 'COD',
          stockAlreadyReserved: true,
          discount: !partLines.length ? quote.discount : 0,
          invoiceLines: [
            {
              description: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            },
            ...extraLines,
          ],
        },
      );
      createdIds.push(String((order as any)._id));
      orders.push(order);
    }

    return {
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
      payment: { method: 'COD', status: 'UNPAID' },
      totals: {
        itemsSubtotal: quote.itemsSubtotal,
        installationCharge: quote.installationCharge,
        deliveryCharge: quote.deliveryCharge,
        discount: quote.discount,
        total: quote.total,
      },
      orders,
    };
  }

  private async buildQuote(userId: string, pincode: string, strict = false) {
    const pin = String(pincode || '').trim();
    if (!/^\d{6}$/.test(pin)) {
      throw new BadRequestException('Enter a valid 6-digit pincode');
    }

    const cart = await this.cartService.getOrCreate(userId);
    if (!cart.items.length) {
      throw new BadRequestException('Cart is empty');
    }

    const serviceable = await this.serviceablePincodesService.isServiceable(pin);
    const issues: string[] = [];
    if (!serviceable) {
      issues.push('Delivery is not available for this pincode');
    }

    const items = [];
    for (const item of cart.items) {
      const product = await this.installationService.loadProduct(
        String(item.productId),
        item.productType,
      );
      const livePrice =
        product.productType === 'part'
          ? paiseToRupees(product.doc.price)
          : money(product.doc.price);
      const stockOk = this.stockOk(product, item.quantity);
      if (!stockOk) {
        issues.push(`${product.doc.name} is out of stock`);
      }
      const billedQuantity = this.billedQuantity(product, item.quantity);
      const installation = this.installationService.resolveOption(
        product,
        item.installationOptionId,
      );
      items.push({
        itemId: String(item._id),
        productType: item.productType,
        productId: String(item.productId),
        slug: product.doc.slug,
        name: product.doc.name,
        quantity: item.quantity,
        billedQuantity,
        unitPrice: livePrice,
        originalPrice: item.originalPrice ?? null,
        installationOptionId: installation.id,
        installationCharge: installation.charge,
        lineTotal: money(livePrice * billedQuantity),
        installationTotal: money(installation.charge * billedQuantity),
        inStock: stockOk,
      });
    }

    if (strict && issues.length) {
      throw new BadRequestException(issues[0]);
    }

    const itemsSubtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const installationCharge = money(
      items.reduce((sum, item) => sum + item.installationTotal, 0),
    );
    const deliveryCharge = serviceable ? DELIVERY_CHARGE_RUPEES : 0;
    const discount = money(
      Math.min(
        itemsSubtotal,
        cart.coupons.reduce(
          (sum, coupon) => sum + applyDiscount(itemsSubtotal, coupon),
          0,
        ),
      ),
    );

    return {
      pincode: pin,
      serviceable,
      items,
      coupons: cart.coupons.map((coupon) => ({
        code: coupon.code,
        title: coupon.title,
        discountText: coupon.discountText,
      })),
      itemsSubtotal,
      installationCharge,
      deliveryCharge,
      discount,
      total: money(
        Math.max(0, itemsSubtotal + installationCharge + deliveryCharge - discount),
      ),
      issues,
    };
  }

  private billedQuantity(
    product: { productType: 'part' | 'appliance'; doc: any },
    quantity: number,
  ) {
    if (product.productType !== 'part') return quantity;
    const stock = Number(product.doc.stock);
    if (stock > 0 && stock < quantity) return stock;
    if (!this.stockOk(product, quantity)) return 0;
    return quantity;
  }

  private stockOk(
    product: { productType: 'part' | 'appliance'; doc: any },
    quantity: number,
  ) {
    if (product.productType === 'part') {
      if (!product.doc.isActive || product.doc.isInStock === false) return false;
      if (product.doc.stock != null && Number(product.doc.stock) < quantity) {
        return false;
      }
      return true;
    }
    return product.doc.inStock !== false;
  }
}
