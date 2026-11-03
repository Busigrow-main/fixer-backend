/** GST price mode for catalog / bill lines. */
export type GstPriceMode = 'INCLUSIVE' | 'EXCLUSIVE';

/** Intra-state → CGST+SGST; inter-state → IGST. */
export type GstSupplyType = 'INTRA' | 'INTER';

export type GstLineInput = {
  description?: string;
  quantity: number;
  /** Unit price as shown to the customer (inclusive by default). */
  unitPrice: number;
  hsn?: string;
};

export type GstLineBreakdown = {
  description: string;
  quantity: number;
  unitPrice: number;
  /** Line total as charged (inclusive amount when priceMode=INCLUSIVE). */
  amount: number;
  /** Taxable value after reverse-calc (Rule 35) or exclusive base. */
  taxableAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  hsn?: string;
};

export type GstInvoiceBreakdown = {
  priceMode: GstPriceMode;
  supplyType: GstSupplyType;
  taxPercent: number;
  lineItems: GstLineBreakdown[];
  /** Sum of taxable amounts (invoice "Taxable Value"). */
  taxableValue: number;
  /** Alias of taxableValue for legacy bill fields. */
  subtotal: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  /** Grand total charged to customer (unchanged when inclusive). */
  totalAmount: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
};

/** Common GST slabs published by GST Council (not seller-specific credentials). */
export const STANDARD_GST_RATES = [0, 5, 12, 18, 28] as const;
