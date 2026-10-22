import { Injectable } from '@nestjs/common';
import { AppliancesService } from '../appliances/appliances.service';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { applianceToShopCard, partToShopCard } from './shop-pricing';

@Injectable()
export class ShopService {
  constructor(
    private readonly appliancesService: AppliancesService,
    private readonly sparePartsService: SparePartsService,
  ) {}

  async getHome(limit = 8, page = 1) {
    const safeLimit = Math.min(24, Math.max(1, Number(limit) || 8));
    const safePage = Math.max(1, Number(page) || 1);
    const [appliances, parts, applianceCategories] = await Promise.all([
      this.appliancesService.listForShop(safeLimit, safePage),
      this.sparePartsService.listForShop(safeLimit, safePage),
      this.appliancesService.listShopCategories(),
    ]);

    const applianceCards = appliances.items.map(applianceToShopCard);
    const partCards = parts.items.map(partToShopCard);

    return {
      products: [...applianceCards, ...partCards],
      appliances: applianceCards,
      parts: partCards,
      applianceCategories,
      pagination: {
        page: safePage,
        limit: safeLimit,
        applianceTotal: appliances.total,
        partTotal: parts.total,
        hasMore:
          safePage * safeLimit < appliances.total ||
          safePage * safeLimit < parts.total,
      },
    };
  }
}
