import {
  applyExclusiveTax,
  breakdownInvoice,
  extractInclusiveTax,
  roundMoney,
} from './gst.engine';
import {
  FIXXER_AC_SERVICE_SAC,
  FIXXER_SERVICE_GST_PERCENT,
  FIXXER_SERVICE_SAC,
  fixxerServiceSac,
} from './gst.types';

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

  it('Fixxer appliance service bills add 18% GST on top (exclusive)', () => {
    expect(FIXXER_SERVICE_GST_PERCENT).toBe(18);
    expect(fixxerServiceSac('Refrigerator')).toBe(FIXXER_SERVICE_SAC);
    expect(fixxerServiceSac('ac-repair')).toBe(FIXXER_AC_SERVICE_SAC);
    expect(fixxerServiceSac('Air Conditioner Service')).toBe(
      FIXXER_AC_SERVICE_SAC,
    );

    const bill = breakdownInvoice({
      lineItems: [
        {
          description: 'AC Repair',
          quantity: 1,
          unitPrice: 1000,
          hsn: fixxerServiceSac('ac-repair'),
        },
      ],
      taxPercent: FIXXER_SERVICE_GST_PERCENT,
      priceMode: 'EXCLUSIVE',
      supplyType: 'INTRA',
    });
    expect(bill.taxableValue).toBe(1000);
    expect(bill.taxAmount).toBe(180);
    expect(bill.totalAmount).toBe(1180);
    expect(bill.cgstAmount + bill.sgstAmount).toBe(180);
    expect(bill.lineItems[0].hsn).toBe(FIXXER_AC_SERVICE_SAC);
  });
});
