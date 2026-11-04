import { Injectable } from '@nestjs/common';
import {
  breakdownInvoice,
  breakdownLine,
  extractInclusiveTax,
  roundMoney,
  splitTaxComponents,
} from './gst.engine';
import {
  FIXXER_AC_SERVICE_SAC,
  FIXXER_SERVICE_GST_PERCENT,
  FIXXER_SERVICE_SAC,
  STANDARD_GST_RATES,
} from './gst.types';
import type { GstBreakdownDto, GstExtractDto } from './gst.dto';

@Injectable()
export class GstService {
  /** Published GST Council slabs for admin pickers — not seller credentials. */
  listStandardRates() {
    return {
      rates: [...STANDARD_GST_RATES],
      defaultRate: FIXXER_SERVICE_GST_PERCENT,
      priceModeDefault: 'INCLUSIVE' as const,
      note:
        'Catalog and customer-facing prices are GST-inclusive. Invoice engine reverse-calculates taxable value via CGST Rule 35.',
      fixxerServices: {
        taxPercent: FIXXER_SERVICE_GST_PERCENT,
        priceMode: 'EXCLUSIVE' as const,
        sacHouseholdAppliances: FIXXER_SERVICE_SAC,
        sacAirConditioning: FIXXER_AC_SERVICE_SAC,
        basis:
          'Notification 11/2017-Central Tax (Rate) heading 9987 residual — maintenance/repair at 18%. Service bills add GST on top of labour/parts; shop catalog stays GST-inclusive.',
      },
    };
  }

  extractFromInclusive(body: GstExtractDto) {
    const supplyType = body.supplyType === 'INTER' ? 'INTER' : 'INTRA';
    const { taxableAmount, taxAmount } = extractInclusiveTax(
      body.inclusiveAmount,
      body.taxPercent,
    );
    const parts = splitTaxComponents(taxAmount, supplyType, body.taxPercent);
    return {
      priceMode: 'INCLUSIVE' as const,
      supplyType,
      taxPercent: body.taxPercent,
      inclusiveAmount: roundMoney(body.inclusiveAmount),
      taxableAmount,
      taxAmount,
      ...parts,
      formula: 'Tax = Inclusive × Rate / (100 + Rate)  [CGST Rule 35]',
    };
  }

  breakdown(body: GstBreakdownDto) {
    return breakdownInvoice({
      lineItems: body.lineItems || [],
      taxPercent: body.taxPercent,
      priceMode: body.priceMode,
      supplyType: body.supplyType,
    });
  }

  breakdownSingleLine(
    line: {
      description?: string;
      quantity: number;
      unitPrice: number;
      hsn?: string;
    },
    taxPercent = 0,
    priceMode: 'INCLUSIVE' | 'EXCLUSIVE' = 'INCLUSIVE',
    supplyType: 'INTRA' | 'INTER' = 'INTRA',
  ) {
    return breakdownLine(line, taxPercent, priceMode, supplyType);
  }
}
