import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppliancesModule } from '../appliances/appliances.module';
import { AuthModule } from '../auth/auth.module';
import { OffersModule } from '../offers/offers.module';
import { PartOrdersModule } from '../part-orders/part-orders.module';
import { ServiceablePincodesModule } from '../serviceable-pincodes/serviceable-pincodes.module';
import { SparePartsModule } from '../spare-parts/spare-parts.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { InstallationController } from './installation.controller';
import { InstallationService } from './installation.service';
import { ShopCart, ShopCartSchema } from './schemas/cart.schema';
import { ShopSettings, ShopSettingsSchema } from './schemas/shop-settings.schema';
import { ShopController } from './shop.controller';
import { ShopMaintenanceGuard } from './shop-maintenance.guard';
import { ShopService } from './shop.service';
import { ShopSettingsService } from './shop-settings.service';

@Module({
  imports: [
    AuthModule,
    AppliancesModule,
    SparePartsModule,
    OffersModule,
    PartOrdersModule,
    ServiceablePincodesModule,
    MongooseModule.forFeature([
      { name: ShopCart.name, schema: ShopCartSchema },
      { name: ShopSettings.name, schema: ShopSettingsSchema },
    ]),
  ],
  controllers: [
    ShopController,
    InstallationController,
    CartController,
    CheckoutController,
  ],
  providers: [
    ShopService,
    ShopSettingsService,
    ShopMaintenanceGuard,
    InstallationService,
    CartService,
    CheckoutService,
  ],
  exports: [ShopSettingsService],
})
export class ShopModule {}
