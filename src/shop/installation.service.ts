import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AppliancesService } from '../appliances/appliances.service';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { ServiceablePincodesService } from '../serviceable-pincodes/serviceable-pincodes.service';
import {
  DELIVERY_CHARGE_RUPEES,
  INSTALLATION_CHARGES,
  PROFESSIONAL_PART_INSTALL_CHARGE,
  ShopProductType,
} from './shop-pricing';

export type InstallationOption = {
  id: string;
  label: string;
  charge: number;
  included: boolean;
};

@Injectable()
export class InstallationService {
  constructor(
    private readonly appliancesService: AppliancesService,
    private readonly sparePartsService: SparePartsService,
    private readonly serviceablePincodesService: ServiceablePincodesService,
  ) {}

  async getOptions(productId: string, pincode: string, productType?: ShopProductType) {
    const pin = String(pincode || '').trim();
    if (!/^\d{6}$/.test(pin)) {
      throw new BadRequestException('Enter a valid 6-digit pincode');
    }
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException('Product not found');
    }

    const product = await this.loadProduct(productId, productType);
    const serviceable = await this.serviceablePincodesService.isServiceable(pin);
    const options = this.optionsFor(product);

    return {
      productId: String(product.doc._id),
      productType: product.productType,
      name: product.doc.name,
      pincode: pin,
      serviceable,
      deliveryCharge: serviceable ? DELIVERY_CHARGE_RUPEES : null,
      options,
    };
  }

  optionsFor(product: { productType: ShopProductType; doc: any }): InstallationOption[] {
    if (product.productType === 'appliance') {
      const category = product.doc.applianceCategory || 'ac';
      const charge = INSTALLATION_CHARGES[category] ?? INSTALLATION_CHARGES.ac;
      if (product.doc.installationIncluded) {
        return [
          {
            id: 'included',
            label: 'Standard installation included',
            charge: 0,
            included: true,
          },
        ];
      }
      return [
        {
          id: 'standard',
          label: 'Standard installation',
          charge,
          included: false,
        },
        {
          id: 'skip',
          label: 'I will arrange installation',
          charge: 0,
          included: false,
        },
      ];
    }

    const difficulty = String(product.doc.installationDifficulty?.type || '');
    const needsPro = ['Medium', 'Hard', 'Professional Only'].includes(difficulty);
    const options: InstallationOption[] = [
      { id: 'skip', label: 'No installation', charge: 0, included: false },
    ];
    if (needsPro) {
      options.unshift({
        id: 'professional',
        label: 'Professional installation',
        charge: PROFESSIONAL_PART_INSTALL_CHARGE,
        included: false,
      });
    }
    return options;
  }

  resolveOption(
    product: { productType: ShopProductType; doc: any },
    optionId?: string,
  ): InstallationOption {
    const options = this.optionsFor(product);
    if (!optionId) return options[0];
    const match = options.find((option) => option.id === optionId);
    if (!match) {
      throw new BadRequestException('Invalid installation option');
    }
    return match;
  }

  async loadProduct(productId: string, productType?: ShopProductType) {
    if (productType === 'part') {
      const doc = await this.sparePartsService.findById(productId);
      if (!doc?.isActive) throw new NotFoundException('Product not found');
      return { productType: 'part' as const, doc };
    }
    if (productType === 'appliance') {
      const doc = await this.appliancesService.findById(productId);
      return { productType: 'appliance' as const, doc };
    }

    try {
      const doc = await this.appliancesService.findById(productId);
      return { productType: 'appliance' as const, doc };
    } catch {
      const doc = await this.sparePartsService.findById(productId);
      if (!doc?.isActive) throw new NotFoundException('Product not found');
      return { productType: 'part' as const, doc };
    }
  }
}
