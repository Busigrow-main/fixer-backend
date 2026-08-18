import {
  buildTechnicianPayoutLines,
  computeTechnicianSettlement,
  earningDisplayLabel,
} from './settlement';

describe('computeTechnicianSettlement', () => {
  it('gives 100% of service charges to the technician', () => {
    const s = computeTechnicianSettlement({
      serviceTotal: 1199,
      additionalCharges: [{ amount: 100 }],
      parts: [],
    });
    expect(s.labour).toBe(1299);
    expect(s.technicianNet).toBe(1299);
    expect(s.fixxerNet).toBe(0);
    expect(s.customerTotal).toBe(1299);
  });

  it('splits Fixxer inventory parts 10% technician / 90% Fixxer', () => {
    const s = computeTechnicianSettlement({
      serviceTotal: 500,
      parts: [
        { sourcedBy: 'INVENTORY', cost: 1000, quantity: 2 },
        { isThirdParty: false, cost: 200, quantity: 1 },
      ],
    });
    expect(s.inventoryPartsTotal).toBe(2200);
    expect(s.inventoryCommission).toBe(220);
    expect(s.inventoryToFixxer).toBe(1980);
    expect(s.technicianNet).toBe(720); // 500 labour + 220 commission
    expect(s.fixxerNet).toBe(1980);
    expect(s.customerTotal).toBe(2700);
  });

  it('charges ₹100 per self-sourced part line and keeps the part sale with the technician', () => {
    const s = computeTechnicianSettlement({
      serviceTotal: 500,
      parts: [
        { isThirdParty: true, sourcedBy: 'SELF', cost: 800, quantity: 1 },
        { isThirdParty: true, cost: 200, quantity: 2, platformFeeAmount: 100 },
      ],
    });
    expect(s.selfPartsTotal).toBe(1200);
    expect(s.selfPartCount).toBe(2);
    expect(s.selfPartFee).toBe(200);
    expect(s.technicianNet).toBe(1500); // 500 + 1200 - 200
    expect(s.fixxerNet).toBe(200);
    expect(s.customerTotal).toBe(1700);
  });

  it('combines labour, inventory commission, self parts, and fees', () => {
    const s = computeTechnicianSettlement({
      serviceTotal: 1000,
      additionalCharges: [{ amount: 50 }],
      parts: [
        { sourcedBy: 'INVENTORY', cost: 3000, quantity: 1 },
        { isThirdParty: true, sourcedBy: 'SELF', cost: 500, quantity: 1 },
      ],
    });
    expect(s.labour).toBe(1050);
    expect(s.inventoryCommission).toBe(300);
    expect(s.inventoryToFixxer).toBe(2700);
    expect(s.selfPartsTotal).toBe(500);
    expect(s.selfPartFee).toBe(100);
    expect(s.technicianNet).toBe(1750); // 1050 + 300 + 500 - 100
    expect(s.fixxerNet).toBe(2800);
    expect(s.customerTotal).toBe(4550);
  });

  it('does not charge covered warranty replacements', () => {
    const s = computeTechnicianSettlement({
      serviceTotal: 0,
      parts: [
        { sourcedBy: 'INVENTORY', cost: 0, quantity: 1, warrantyCovered: true },
        { isThirdParty: true, cost: 0, quantity: 1, warrantyCovered: true },
        { sourcedBy: 'INVENTORY', cost: 500, quantity: 1 },
      ],
    });
    expect(s.inventoryPartsTotal).toBe(500);
    expect(s.inventoryCommission).toBe(50);
    expect(s.selfPartsTotal).toBe(0);
    expect(s.selfPartFee).toBe(0);
    expect(s.customerTotal).toBe(500);
  });
});

describe('buildTechnicianPayoutLines', () => {
  const settlement = computeTechnicianSettlement({
    serviceTotal: 1000,
    parts: [
      { sourcedBy: 'INVENTORY', cost: 2000, quantity: 1 },
      { isThirdParty: true, cost: 400, quantity: 1 },
    ],
  });

  it('credits labour, 10% commission and self-sourced parts without fees by default', () => {
    const lines = buildTechnicianPayoutLines(settlement, 'job1');
    expect(lines.map((l) => [l.type, l.amount])).toEqual([
      ['LABOUR', 1000],
      ['PARTS', 200],
      ['PARTS', 400],
    ]);
  });

  it('can include the outside-parts fee as a debit', () => {
    const lines = buildTechnicianPayoutLines(settlement, 'job1', { includeFees: true });
    expect(lines[lines.length - 1]).toMatchObject({
      type: 'SELF_PART_FEE',
      amount: -100,
    });
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(settlement.technicianNet);
  });
});

describe('earningDisplayLabel', () => {
  it('maps payout types to technician-facing labels', () => {
    expect(earningDisplayLabel({ type: 'LABOUR' })).toBe('Service charges');
    expect(
      earningDisplayLabel({
        type: 'PARTS',
        description: '10% inventory parts commission for x',
      }),
    ).toBe('Inventory commission (10%)');
    expect(earningDisplayLabel({ type: 'SELF_PART_FEE' })).toBe('Outside-parts fee');
  });
});
