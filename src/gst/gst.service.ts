import { Injectable } from '@nestjs/common';
import {
  breakdownInvoice,
  breakdownLine,
  extractInclusiveTax,
  roundMoney,
  splitTaxComponents,
} from './gst.engine';
import { STANDARD_GST_RATES } from './gst.types';
import type { GstBreakdownDto, GstExtractDto } from './gst.dto';

@Injectable()
export class GstService {
  /** Published GST Council slabs for admin pickers — not seller credentials. */
  listStandardRates() {
    return {
      rates: [...STANDARD_GST_RATES],
      defaultRate: 18,
      priceModeDefault: 'INCLUSIVE' as const,
      note:
        'Catalog and customer-facing prices are GST-inclusive. Invoice engine reverse-calculates taxable value via CGST Rule 35.',
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
