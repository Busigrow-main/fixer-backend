import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePartOrderDto } from '../part-orders/dtos/create-part-order.dto';
import { PartOrdersService } from '../part-orders/part-orders.service';
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
  constructor(
    private readonly cartService: CartService,
    private readonly installationService: InstallationService,
    private readonly partOrdersService: PartOrdersService,
    private readonly serviceablePincodesService: ServiceablePincodesService,
  ) {}

  async quote(userId: string, pincode: string) {
    return this.buildQuote(userId, pincode);
  }

  async checkout(userId: string, dto: CreateCheckoutDto) {
    const quote = await this.buildQuote(userId, dto.pincode, true);
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
          paymentMethod: dto.paymentMethod,
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
          paymentMethod: dto.paymentMethod,
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
      orders.push(order);
    }

    await this.cartService.clear(userId);

    return {
      paymentMethod: dto.paymentMethod,
      paymentStatus: 'UNPAID',
      payment:
        dto.paymentMethod === 'ONLINE'
          ? {
              method: 'ONLINE',
              status: 'PENDING',
              message: 'Online payment will be confirmed after the payment step.',
            }
          : { method: 'COD', status: 'UNPAID' },
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
        unitPrice: livePrice,
        originalPrice: item.originalPrice ?? null,
        installationOptionId: installation.id,
        installationCharge: installation.charge,
        lineTotal: money(livePrice * item.quantity),
        installationTotal: money(installation.charge * item.quantity),
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

  private stockOk(
    product: { productType: 'part' | 'appliance'; doc: any },
    quantity: number,
  ) {
    if (product.productType === 'part') {
      if (!product.doc.isActive || product.doc.isInStock === false) return false;
      if (Number(product.doc.stock) > 0 && Number(product.doc.stock) < quantity) {
        return false;
      }
      return true;
    }
    return product.doc.inStock !== false;
  }
}
