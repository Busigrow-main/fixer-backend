import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OffersService } from '../offers/offers.service';
import { AddCartItemDto, UpdateCartItemDto } from './dtos/cart.dto';
import { InstallationService } from './installation.service';
import { ShopCart, ShopCartDocument } from './schemas/cart.schema';
import {
  applyDiscount,
  money,
  paiseToRupees,
  ShopProductType,
} from './shop-pricing';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(ShopCart.name)
    private readonly cartModel: Model<ShopCartDocument>,
    private readonly installationService: InstallationService,
    private readonly offersService: OffersService,
  ) {}

  async getCart(userId: string) {
    const cart = await this.getOrCreate(userId);
    return this.present(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const quantity = dto.quantity ?? 1;
    const product = await this.installationService.loadProduct(
      dto.productId,
      dto.productType,
    );
    this.assertPurchasable(product, quantity);
    const snapshot = this.snapshot(product);
    const installation = this.installationService.resolveOption(
      product,
      dto.installationOptionId,
    );

    const cart = await this.getOrCreate(userId);
    const existing = cart.items.find(
      (item) =>
        item.productType === snapshot.productType &&
        String(item.productId) === String(snapshot.productId) &&
        (item.installationOptionId || '') === installation.id,
    );

    if (existing) {
      existing.quantity += quantity;
      existing.unitPrice = snapshot.unitPrice;
      existing.originalPrice = snapshot.originalPrice;
      existing.installationCharge = installation.charge;
    } else {
      cart.items.push({
        ...snapshot,
        quantity,
        installationOptionId: installation.id,
        installationCharge: installation.charge,
      } as any);
    }

    await cart.save();
    return this.present(cart);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreate(userId);
    const item = cart.items.id(itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    if (dto.quantity != null) item.quantity = dto.quantity;

    if (dto.installationOptionId) {
      const product = await this.installationService.loadProduct(
        String(item.productId),
        item.productType,
      );
      const installation = this.installationService.resolveOption(
        product,
        dto.installationOptionId,
      );
      item.installationOptionId = installation.id;
      item.installationCharge = installation.charge;
    }

    await cart.save();
    return this.present(cart);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreate(userId);
    const item = cart.items.id(itemId);
    if (!item) throw new NotFoundException('Cart item not found');
    item.deleteOne();
    await cart.save();
    return this.present(cart);
  }

  async clear(userId: string) {
    const cart = await this.getOrCreate(userId);
    cart.items.splice(0, cart.items.length);
    cart.coupons.splice(0, cart.coupons.length);
    await cart.save();
    return this.present(cart);
  }

  async applyCoupon(userId: string, code: string) {
    const offer = await this.offersService.findLiveShopCoupon(code);
    const cart = await this.getOrCreate(userId);
    if (!cart.items.length) {
      throw new BadRequestException('Add items before applying a coupon');
    }
    const normalized = String(offer.couponCode).toUpperCase();
    if (cart.coupons.some((coupon) => coupon.code === normalized)) {
      throw new BadRequestException('Coupon is already applied');
    }
    cart.coupons.push({
      code: normalized,
      title: offer.title,
      discountText: offer.discountText,
    });
    await cart.save();
    return this.present(cart);
  }

  async removeCoupon(userId: string, code: string) {
    const cart = await this.getOrCreate(userId);
    const normalized = String(code || '').trim().toUpperCase();
    const before = cart.coupons.length;
    cart.coupons = cart.coupons.filter((coupon) => coupon.code !== normalized);
    if (cart.coupons.length === before) {
      throw new NotFoundException('Coupon is not applied');
    }
    cart.markModified('coupons');
    await cart.save();
    return this.present(cart);
  }

  async getOrCreate(userId: string) {
    const owner = new Types.ObjectId(userId);
    const existing = await this.cartModel.findOne({ userId: owner }).exec();
    if (existing) return existing;
    return this.cartModel.create({ userId: owner, items: [], coupons: [] });
  }

  present(cart: ShopCartDocument) {
    const items = cart.items.map((item) => {
      const lineTotal = money(item.unitPrice * item.quantity);
      const installationTotal = money((item.installationCharge || 0) * item.quantity);
      return {
        itemId: String(item._id),
        productType: item.productType,
        productId: String(item.productId),
        sku: item.sku,
        slug: item.slug,
        name: item.name,
        image: item.image || null,
        unitPrice: item.unitPrice,
        originalPrice: item.originalPrice ?? null,
        quantity: item.quantity,
        installationOptionId: item.installationOptionId || null,
        installationCharge: item.installationCharge || 0,
        lineTotal,
        installationTotal,
      };
    });

    const itemsSubtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const installationCharge = money(
      items.reduce((sum, item) => sum + item.installationTotal, 0),
    );
    const discount = money(
      cart.coupons.reduce(
        (sum, coupon) => sum + applyDiscount(itemsSubtotal, coupon),
        0,
      ),
    );

    return {
      cartId: String(cart._id),
      items,
      coupons: cart.coupons.map((coupon) => ({
        code: coupon.code,
        title: coupon.title,
        discountText: coupon.discountText,
      })),
      itemsSubtotal,
      installationCharge,
      discount: Math.min(discount, itemsSubtotal),
      total: money(Math.max(0, itemsSubtotal + installationCharge - Math.min(discount, itemsSubtotal))),
    };
  }

  private snapshot(product: { productType: ShopProductType; doc: any }) {
    if (product.productType === 'part') {
      return {
        productType: 'part' as const,
        productId: product.doc._id,
        sku: product.doc.sku,
        slug: product.doc.slug,
        name: product.doc.name,
        image: product.doc.imageUrls?.[0],
        unitPrice: paiseToRupees(product.doc.price),
        originalPrice:
          product.doc.mrp != null ? paiseToRupees(product.doc.mrp) : undefined,
      };
    }

    return {
      productType: 'appliance' as const,
      productId: product.doc._id ?? product.doc.id,
      sku: product.doc.sku,
      slug: product.doc.slug,
      name: product.doc.name,
      image: product.doc.images?.[0],
      unitPrice: money(product.doc.price),
      originalPrice:
        product.doc.originalPrice != null
          ? money(product.doc.originalPrice)
          : undefined,
    };
  }

  private assertPurchasable(
    product: { productType: ShopProductType; doc: any },
    quantity = 1,
  ) {
    if (product.productType === 'part') {
      if (!product.doc.isActive) {
        throw new BadRequestException('This spare part is no longer available');
      }
      if (product.doc.isInStock === false) {
        throw new BadRequestException('This spare part is out of stock');
      }
      if (Number(product.doc.stock) > 0 && Number(product.doc.stock) < quantity) {
        throw new BadRequestException('This spare part is out of stock');
      }
      return;
    }
    if (product.doc.inStock === false) {
      throw new BadRequestException('This appliance is out of stock');
    }
  }
}
