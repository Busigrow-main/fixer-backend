import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InstallationService } from './installation.service';
import {
  ShopWishlist,
  ShopWishlistDocument,
  ShopWishlistItem,
} from './schemas/wishlist.schema';
import {
  money,
  paiseToRupees,
  ShopProductType,
} from './shop-pricing';

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(ShopWishlist.name)
    private readonly wishlistModel: Model<ShopWishlistDocument>,
    private readonly installationService: InstallationService,
  ) {}

  async getWishlist(userId: string) {
    const wishlist = await this.getOrCreate(userId);
    return this.present(wishlist);
  }

  async addItem(userId: string, productType: ShopProductType, productId: string) {
    const snapshot = await this.snapshotFromCatalog(productType, productId);
    const owner = new Types.ObjectId(userId);
    const pid = new Types.ObjectId(String(snapshot.productId));

    const existing = await this.wishlistModel
      .findOne({
        userId: owner,
        items: { $elemMatch: { productType: snapshot.productType, productId: pid } },
      })
      .exec();

    if (existing) {
      await this.wishlistModel
        .updateOne(
          { userId: owner, 'items.productType': snapshot.productType, 'items.productId': pid },
          {
            $set: {
              'items.$.sku': snapshot.sku,
              'items.$.slug': snapshot.slug,
              'items.$.name': snapshot.name,
              'items.$.brand': snapshot.brand,
              'items.$.image': snapshot.image,
              'items.$.unitPrice': snapshot.unitPrice,
              'items.$.originalPrice': snapshot.originalPrice,
              'items.$.detailHref': snapshot.detailHref,
              'items.$.warrantyMonths': snapshot.warrantyMonths,
              'items.$.isInStock': snapshot.isInStock,
            },
          },
        )
        .exec();
      return this.getWishlist(userId);
    }

    await this.wishlistModel
      .findOneAndUpdate(
        { userId: owner },
        {
          $setOnInsert: { userId: owner },
          $push: { items: snapshot },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    return this.getWishlist(userId);
  }

  async removeItem(userId: string, productType: ShopProductType, productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException('Wishlist item not found');
    }
    await this.wishlistModel
      .updateOne(
        { userId: new Types.ObjectId(userId) },
        {
          $pull: {
            items: {
              productType,
              productId: new Types.ObjectId(productId),
            },
          },
        },
      )
      .exec();
    return this.getWishlist(userId);
  }

  async syncItems(
    userId: string,
    refs: { productType: ShopProductType; productId: string }[],
  ) {
    const wishlist = await this.getOrCreate(userId);
    const seen = new Set<string>();
    const next: ShopWishlistItem[] = [];

    for (const ref of refs) {
      const key = `${ref.productType}:${ref.productId}`;
      if (seen.has(key) || !Types.ObjectId.isValid(ref.productId)) continue;
      seen.add(key);
      try {
        next.push(await this.snapshotFromCatalog(ref.productType, ref.productId));
      } catch {
        // Drop unavailable catalog rows during sync.
      }
    }

    for (const item of wishlist.items) {
      const key = `${item.productType}:${String(item.productId)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(item.toObject() as ShopWishlistItem);
    }

    wishlist.items.splice(0, wishlist.items.length, ...next);
    await wishlist.save();
    return this.present(wishlist);
  }

  private async snapshotFromCatalog(
    productType: ShopProductType,
    productId: string,
  ): Promise<ShopWishlistItem> {
    const product = await this.installationService.loadProduct(productId, productType);
    return this.snapshot(product);
  }

  private snapshot(product: { productType: ShopProductType; doc: any }): ShopWishlistItem {
    if (product.productType === 'part') {
      const sku = product.doc.sku as string | undefined;
      return {
        productType: 'part',
        productId: product.doc._id,
        sku,
        slug: product.doc.slug,
        name: product.doc.name,
        brand: product.doc.brand,
        image: product.doc.imageUrls?.[0],
        unitPrice: paiseToRupees(product.doc.price),
        originalPrice:
          product.doc.mrp != null ? paiseToRupees(product.doc.mrp) : undefined,
        detailHref: `/shop/spare-parts/${encodeURIComponent(sku || String(product.doc._id))}`,
        warrantyMonths: product.doc.warrantyMonths,
        isInStock:
          product.doc.isInStock !== false &&
          (product.doc.stock == null || Number(product.doc.stock) > 0),
      };
    }

    const category = product.doc.applianceCategory || 'all';
    const slug = product.doc.slug as string | undefined;
    return {
      productType: 'appliance',
      productId: product.doc._id ?? product.doc.id,
      sku: product.doc.sku,
      slug,
      name: product.doc.name,
      brand: product.doc.brand,
      image: product.doc.images?.[0],
      unitPrice: money(product.doc.price),
      originalPrice:
        product.doc.originalPrice != null
          ? money(product.doc.originalPrice)
          : undefined,
      detailHref: slug
        ? `/shop/appliances/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`
        : '/shop/appliances',
      warrantyMonths: product.doc.productWarrantyYears
        ? Number(product.doc.productWarrantyYears) * 12
        : undefined,
      isInStock: product.doc.inStock !== false,
    };
  }

  private async getOrCreate(userId: string) {
    const owner = new Types.ObjectId(userId);
    const existing = await this.wishlistModel.findOne({ userId: owner }).exec();
    if (existing) return existing;
    return this.wishlistModel.create({ userId: owner, items: [] });
  }

  private present(wishlist: ShopWishlistDocument) {
    return {
      wishlistId: String(wishlist._id),
      items: wishlist.items.map((item) => ({
        itemId: String(item._id),
        productType: item.productType,
        productId: String(item.productId),
        sku: item.sku,
        slug: item.slug,
        name: item.name,
        brand: item.brand || null,
        image: item.image || null,
        unitPrice: item.unitPrice,
        originalPrice: item.originalPrice ?? null,
        detailHref: item.detailHref || null,
        warrantyMonths: item.warrantyMonths ?? null,
        isInStock: item.isInStock !== false,
      })),
      count: wishlist.items.length,
    };
  }
}
