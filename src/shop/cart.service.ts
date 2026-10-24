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

function cartLineId(line: object): Types.ObjectId | undefined {
  const id = (line as { _id?: Types.ObjectId })._id;
  return id;
}

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
    if (this.collapseDuplicateLines(cart)) await cart.save();
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
    const owner = new Types.ObjectId(userId);
    const productId = new Types.ObjectId(String(snapshot.productId));
    const lineMatch = {
      productType: snapshot.productType,
      productId,
      installationOptionId: installation.id,
    };

    await this.getOrCreate(userId);

    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await this.cartModel.findOne({ userId: owner }).exec();
      if (current && this.collapseDuplicateLines(current)) {
        await current.save();
      }
      const existing = this.matchingLine(
        current,
        snapshot.productType,
        productId,
        installation.id,
      );
      const nextQty = (existing?.quantity ?? 0) + quantity;
      if (nextQty > 99) {
        throw new BadRequestException('Quantity must not be greater than 99');
      }
      this.assertPurchasable(product, nextQty);

      if (existing) {
        const updated = await this.cartModel
          .findOneAndUpdate(
            { userId: owner, 'items._id': existing._id },
            {
              $inc: { 'items.$.quantity': quantity },
              $set: {
                'items.$.unitPrice': snapshot.unitPrice,
                'items.$.originalPrice': snapshot.originalPrice,
                'items.$.installationCharge': installation.charge,
                'items.$.installationOptionId': installation.id,
              },
            },
            { returnDocument: 'after' },
          )
          .exec();
        if (updated) {
          if (this.collapseDuplicateLines(updated)) await updated.save();
          await this.assertLineWithinLimits(updated, snapshot.productType, productId, installation.id, product, quantity);
          return this.present(updated);
        }
        continue;
      }

      const pushed = await this.cartModel
        .findOneAndUpdate(
          { userId: owner, items: { $not: { $elemMatch: lineMatch } } },
          {
            $push: {
              items: {
                ...snapshot,
                productId,
                quantity,
                installationOptionId: installation.id,
                installationCharge: installation.charge,
              },
            },
          },
          { returnDocument: 'after' },
        )
        .exec();
      if (pushed) {
        if (this.collapseDuplicateLines(pushed)) await pushed.save();
        await this.assertLineWithinLimits(pushed, snapshot.productType, productId, installation.id, product, quantity);
        return this.present(pushed);
      }
    }

    throw new BadRequestException('Could not add this item to your cart. Try again.');
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreate(userId);
    const item = cart.items.id(itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    if (dto.quantity != null) {
      const product = await this.installationService.loadProduct(
        String(item.productId),
        item.productType,
      );
      this.assertPurchasable(product, dto.quantity);
      item.quantity = dto.quantity;
    }

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
    if (cart.coupons.length > 0) {
      throw new BadRequestException('Only one coupon can be applied');
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
    try {
      return await this.cartModel
        .findOneAndUpdate(
          { userId: owner },
          { $setOnInsert: { userId: owner, items: [], coupons: [] } },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        )
        .exec();
    } catch (err: any) {
      if (err?.code === 11000) {
        const raced = await this.cartModel.findOne({ userId: owner }).exec();
        if (raced) return raced;
      }
      throw err;
    }
  }

  async claimForCheckout(userId: string) {
    const owner = new Types.ObjectId(userId);
    return this.cartModel
      .findOneAndUpdate(
        { userId: owner, 'items.0': { $exists: true } },
        { $set: { items: [], coupons: [] } },
        { returnDocument: 'before' },
      )
      .exec();
  }

  async restoreClaimed(userId: string, cart: ShopCartDocument) {
    const snapshot = cart.toObject();
    await this.cartModel
      .updateOne(
        { userId: new Types.ObjectId(userId) },
        { $set: { items: snapshot.items, coupons: snapshot.coupons } },
      )
      .exec();
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

  private async assertLineWithinLimits(
    cart: ShopCartDocument,
    productType: ShopProductType,
    productId: Types.ObjectId,
    installationOptionId: string,
    product: { productType: ShopProductType; doc: any },
    addedQty: number,
  ) {
    const line = this.matchingLine(cart, productType, productId, installationOptionId);
    if (!line) return;
    const overCap = line.quantity > 99;
    const overStock =
      product.productType === 'part' &&
      product.doc.stock != null &&
      Number(product.doc.stock) < line.quantity;
    if (!overCap && !overStock) return;
    const lineId = cartLineId(line);
    if (lineId) {
      await this.cartModel
        .updateOne(
          { _id: cart._id, 'items._id': lineId, 'items.quantity': { $gte: addedQty } },
          { $inc: { 'items.$.quantity': -addedQty } },
        )
        .exec();
    }
    throw new BadRequestException(
      overStock ? 'This spare part is out of stock' : 'Quantity must not be greater than 99',
    );
  }

  private matchingLine(
    cart: ShopCartDocument | null,
    productType: ShopProductType,
    productId: Types.ObjectId,
    installationOptionId: string,
  ) {
    return cart?.items.find(
      (item) =>
        item.productType === productType &&
        String(item.productId) === String(productId) &&
        (item.installationOptionId || '') === installationOptionId,
    );
  }

  private collapseDuplicateLines(cart: ShopCartDocument) {
    const merged = new Map<string, Record<string, unknown>>();
    const order: string[] = [];
    for (const item of cart.items) {
      const key = `${item.productType}:${String(item.productId)}:${item.installationOptionId || ''}`;
      const previous = merged.get(key);
      if (!previous) {
        merged.set(key, item.toObject() as unknown as Record<string, unknown>);
        order.push(key);
        continue;
      }
      previous.quantity = Number(previous.quantity || 0) + Number(item.quantity || 0);
    }
    if (order.length === cart.items.length) return false;
    cart.items.splice(0, cart.items.length, ...order.map((key) => merged.get(key) as any));
    return true;
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
      if (product.doc.stock != null && Number(product.doc.stock) < quantity) {
        throw new BadRequestException('This spare part is out of stock');
      }
      return;
    }
    if (product.doc.inStock === false) {
      throw new BadRequestException('This appliance is out of stock');
    }
  }
}
