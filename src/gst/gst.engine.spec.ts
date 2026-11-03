import {
  applyExclusiveTax,
  breakdownInvoice,
  extractInclusiveTax,
  roundMoney,
} from './gst.engine';

describe('GST engine (Rule 35 inclusive)', () => {
  it('rounds money to 2 decimals', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
  });

  it('extracts tax from inclusive price (StackOverflow / Tally formula)', () => {
    // ₹1,180 inclusive @ 18% → taxable ₹1,000, tax ₹180
    const result = extractInclusiveTax(1180, 18);
    expect(result.taxableAmount).toBe(1000);
    expect(result.taxAmount).toBe(180);
  });

  it('keeps inclusive grand total unchanged on invoice breakdown', () => {
    const invoice = breakdownInvoice({
      lineItems: [{ description: 'AC', quantity: 2, unitPrice: 49999 }],
      taxPercent: 18,
      priceMode: 'INCLUSIVE',
      supplyType: 'INTRA',
    });

    expect(invoice.totalAmount).toBe(99998);
    expect(invoice.taxableValue + invoice.taxAmount).toBe(invoice.totalAmount);
    expect(invoice.cgstAmount + invoice.sgstAmount).toBe(invoice.taxAmount);
    expect(invoice.igstAmount).toBe(0);
  });

  it('uses IGST for inter-state inclusive supplies', () => {
    const invoice = breakdownInvoice({
      lineItems: [{ description: 'Part', quantity: 1, unitPrice: 1180 }],
      taxPercent: 18,
      priceMode: 'INCLUSIVE',
      supplyType: 'INTER',
    });

    expect(invoice.totalAmount).toBe(1180);
    expect(invoice.igstAmount).toBe(180);
    expect(invoice.cgstAmount).toBe(0);
    expect(invoice.sgstAmount).toBe(0);
  });

  it('still supports exclusive add-on mode', () => {
    const exclusive = applyExclusiveTax(1000, 18);
    expect(exclusive.taxAmount).toBe(180);
    expect(exclusive.totalAmount).toBe(1180);

    const invoice = breakdownInvoice({
      lineItems: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      taxPercent: 18,
      priceMode: 'EXCLUSIVE',
      supplyType: 'INTRA',
    });
    expect(invoice.totalAmount).toBe(1180);
    expect(invoice.taxableValue).toBe(1000);
  });
});
