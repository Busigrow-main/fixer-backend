import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ShopSettingsService } from './shop-settings.service';

/** Blocks customer shop write/read commerce APIs while maintenance is on. */
@Injectable()
export class ShopMaintenanceGuard implements CanActivate {
  constructor(private readonly shopSettings: ShopSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const enabled = await this.shopSettings.isMaintenanceEnabled();
    if (!enabled) return true;

    const request = context.switchToHttp().getRequest();
    const role = request?.user?.role;
    if (role === 'ADMIN') return true;

    throw new ServiceUnavailableException({
      message: 'Fixxer Shop is under maintenance',
      code: 'SHOP_MAINTENANCE',
    });
  }
}
