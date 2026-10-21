export const SHOP_PRODUCT_TYPES = ['part', 'appliance'] as const;
export type ShopProductType = (typeof SHOP_PRODUCT_TYPES)[number];

export const INSTALLATION_CHARGES: Record<string, number> = {
  ac: 1500,
  refrigerator: 499,
  'washing-machine': 499,
  microwave: 299,
  part: 0,
};

export const PROFESSIONAL_PART_INSTALL_CHARGE = 499;
export const DELIVERY_CHARGE_RUPEES = 0;

export function paiseToRupees(paise: unknown): number {
  return Math.round((Number(paise) || 0)) / 100;
}

export function money(value: unknown): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function discountPercent(price: number, originalPrice?: number): number {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

export type ShopCard = {
  productType: ShopProductType;
  id: string;
  slug: string;
  sku?: string;
  name: string;
  image: string | null;
  price: number;
  originalPrice: number | null;
  discount: number;
  rating: number;
  reviewCount: number;
  isBestseller: boolean;
};

export function applianceToShopCard(product: any): ShopCard {
  const price = money(product.price);
  const originalPrice =
    product.originalPrice != null ? money(product.originalPrice) : null;
  return {
    productType: 'appliance',
    id: String(product._id ?? product.id),
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    image: product.images?.[0] || null,
    price,
    originalPrice,
    discount: discountPercent(price, originalPrice ?? undefined),
    rating: Number(product.customerRating?.average ?? product.rating ?? 0),
    reviewCount: Number(product.customerRating?.count ?? product.reviewCount ?? 0),
    isBestseller: Boolean(product.isBestseller),
  };
}

export function partToShopCard(part: any): ShopCard {
  const price = paiseToRupees(part.price);
  const originalPrice = part.mrp != null ? paiseToRupees(part.mrp) : null;
  return {
    productType: 'part',
    id: String(part._id ?? part.id),
    slug: part.slug,
    sku: part.sku,
    name: part.name,
    image: part.imageUrls?.[0] || null,
    price,
    originalPrice,
    discount: discountPercent(price, originalPrice ?? undefined),
    rating: Number(part.rating?.average ?? 0),
    reviewCount: Number(part.rating?.count ?? 0),
    isBestseller: Boolean(part.isFeatured) || Number(part.soldCount || 0) >= 10,
  };
}

export function parseOfferDiscount(offer: {
  discountText?: string;
}): { type: 'PERCENT' | 'FLAT'; value: number } {
  const text = String(offer.discountText || '');
  const percent = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percent) {
    return { type: 'PERCENT', value: Number(percent[1]) };
  }
  const flat = text.match(/₹\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:rs|inr)/i);
  if (flat) {
    return { type: 'FLAT', value: Number(flat[1] || flat[2]) };
  }
  return { type: 'PERCENT', value: 0 };
}

export function applyDiscount(subtotal: number, offer: { discountText?: string }) {
  const parsed = parseOfferDiscount(offer);
  if (parsed.type === 'PERCENT') {
    return money(subtotal * (parsed.value / 100));
  }
  return money(Math.min(subtotal, parsed.value));
}
