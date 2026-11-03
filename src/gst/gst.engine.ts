import {
  GstInvoiceBreakdown,
  GstLineBreakdown,
  GstLineInput,
  GstPriceMode,
  GstSupplyType,
} from './gst.types';

/** Paisa-safe round to 2 decimal places (INR). */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * CGST Rule 35 — tax when value of supply is inclusive of tax:
 * Tax = (Inclusive × Rate) / (100 + Rate)
 * Taxable = Inclusive − Tax
 *
 * Same reverse formula used by OpenCart/Tally/StackOverflow for tax-inclusive MRP.
 */
export function extractInclusiveTax(
  inclusiveAmount: number,
  taxPercent: number,
): { taxableAmount: number; taxAmount: number } {
  const inclusive = Math.max(0, Number(inclusiveAmount) || 0);
  const rate = Math.max(0, Number(taxPercent) || 0);
  if (inclusive === 0 || rate === 0) {
    return { taxableAmount: roundMoney(inclusive), taxAmount: 0 };
  }
  const taxAmount = roundMoney((inclusive * rate) / (100 + rate));
  const taxableAmount = roundMoney(inclusive - taxAmount);
  return { taxableAmount, taxAmount };
}

/** Exclusive pricing: tax added on top of taxable value. */
export function applyExclusiveTax(
  taxableAmount: number,
  taxPercent: number,
): { taxableAmount: number; taxAmount: number; totalAmount: number } {
  const taxable = Math.max(0, roundMoney(Number(taxableAmount) || 0));
  const rate = Math.max(0, Number(taxPercent) || 0);
  const taxAmount = roundMoney((taxable * rate) / 100);
  return {
    taxableAmount: taxable,
    taxAmount,
    totalAmount: roundMoney(taxable + taxAmount),
  };
}

export function splitTaxComponents(
  taxAmount: number,
  supplyType: GstSupplyType,
  taxPercent: number,
) {
  const tax = roundMoney(taxAmount);
  if (supplyType === 'INTER') {
    return {
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: tax,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: taxPercent,
    };
  }
  const half = roundMoney(tax / 2);
  // Keep CGST+SGST exact: put remainder on SGST if odd paisa.
  const cgstAmount = half;
  const sgstAmount = roundMoney(tax - half);
  return {
    cgstAmount,
    sgstAmount,
    igstAmount: 0,
    cgstRate: taxPercent ? taxPercent / 2 : 0,
    sgstRate: taxPercent ? taxPercent / 2 : 0,
    igstRate: 0,
  };
}

export function breakdownLine(
  input: GstLineInput,
  taxPercent: number,
  priceMode: GstPriceMode = 'INCLUSIVE',
  supplyType: GstSupplyType = 'INTRA',
): GstLineBreakdown {
  const quantity = Math.max(1, Number(input.quantity) || 1);
  const unitPrice = Math.max(0, Number(input.unitPrice) || 0);
  const lineGross = roundMoney(quantity * unitPrice);

  let taxableAmount: number;
  let taxAmount: number;
  let amount: number;

  if (priceMode === 'EXCLUSIVE') {
    const exclusive = applyExclusiveTax(lineGross, taxPercent);
    taxableAmount = exclusive.taxableAmount;
    taxAmount = exclusive.taxAmount;
    amount = exclusive.totalAmount;
  } else {
    const inclusive = extractInclusiveTax(lineGross, taxPercent);
    taxableAmount = inclusive.taxableAmount;
    taxAmount = inclusive.taxAmount;
    amount = lineGross; // customer-facing total stays unchanged
  }

  const parts = splitTaxComponents(taxAmount, supplyType, taxPercent);

  return {
    description: String(input.description || '').trim() || 'Item',
    quantity,
    unitPrice,
    amount,
    taxableAmount,
    taxAmount,
    cgstAmount: parts.cgstAmount,
    sgstAmount: parts.sgstAmount,
    igstAmount: parts.igstAmount,
    hsn: input.hsn,
  };
}

export function breakdownInvoice(input: {
  lineItems: GstLineInput[];
  taxPercent?: number;
  priceMode?: GstPriceMode;
  supplyType?: GstSupplyType;
}): GstInvoiceBreakdown {
  const taxPercent = Math.max(0, Number(input.taxPercent) || 0);
  const priceMode: GstPriceMode = input.priceMode === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE';
  const supplyType: GstSupplyType = input.supplyType === 'INTER' ? 'INTER' : 'INTRA';

  const lineItems = (input.lineItems || []).map((row) =>
    breakdownLine(row, taxPercent, priceMode, supplyType),
  );

  const taxableValue = roundMoney(
    lineItems.reduce((sum, row) => sum + row.taxableAmount, 0),
  );
  const taxAmount = roundMoney(
    lineItems.reduce((sum, row) => sum + row.taxAmount, 0),
  );
  const totalAmount = roundMoney(
    lineItems.reduce((sum, row) => sum + row.amount, 0),
  );
  const parts = splitTaxComponents(taxAmount, supplyType, taxPercent);

  return {
    priceMode,
    supplyType,
    taxPercent,
    lineItems,
    taxableValue,
    subtotal: taxableValue,
    taxAmount,
    cgstAmount: parts.cgstAmount,
    sgstAmount: parts.sgstAmount,
    igstAmount: parts.igstAmount,
    totalAmount,
    cgstRate: parts.cgstRate,
    sgstRate: parts.sgstRate,
    igstRate: parts.igstRate,
  };
}
