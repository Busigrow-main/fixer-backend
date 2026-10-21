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

  async getHome(limit = 8) {
    const safeLimit = Math.min(24, Math.max(1, Number(limit) || 8));
    const [appliances, parts] = await Promise.all([
      this.appliancesService.listForShop(safeLimit),
      this.sparePartsService.listForShop(safeLimit),
    ]);

    const applianceCards = appliances.map(applianceToShopCard);
    const partCards = parts.map(partToShopCard);

    return {
      products: [...applianceCards, ...partCards],
      appliances: applianceCards,
      parts: partCards,
    };
  }
}
