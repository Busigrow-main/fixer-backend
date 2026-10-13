import { buildJobSheetDefaults } from './job-sheet-defaults';

describe('buildJobSheetDefaults', () => {
  const createdAt = new Date('2026-10-01T00:00:00.000Z');

  it('fills the labour warranty and contract when the sheet is empty', () => {
    const patch = buildJobSheetDefaults({
      bookingId: '6ace14f1c84c9f8ab9895c10',
      createdAt,
      serviceType: 'REPAIR',
      jobDetails: {},
      parts: [],
    });

    expect(patch.warrantyPeriod).toBe('60 Days');
    expect(patch.warrantyDesc).toBe('60-day labour warranty for the same fault');
    expect(patch.visitCategory).toBe('Repair');
    expect(patch.invoiceNumber).toBe('FX-B9895C10');
    expect(patch.contractCode).toBe('FX-60');
    expect(patch.contractDesc).toBe('60-day service warranty');
    expect(patch.contractStartDate).toMatch(/^\d{2}\/\d{2}\/2026$/);
    expect(patch.contractExpiryDate).toMatch(/^\d{2}\/\d{2}\/2026$/);
    expect(patch.asset).toBeUndefined();
  });

  it('fills asset and part warranty from installed spare parts', () => {
    const patch = buildJobSheetDefaults({
      bookingId: '6ace14f1c84c9f8ab9895c10',
      createdAt,
      serviceType: 'INSTALLATION',
      jobDetails: { warrantyDesc: '60-day labour warranty for the same fault' },
      parts: [
        {
          partName: 'Compressor',
          serialNumber: 'SN-9',
          warrantyMonths: 12,
          installedAt: '2026-10-13T00:00:00.000Z',
        },
      ],
    });

    expect(patch.asset).toBe('Compressor [SN-9]');
    expect(patch.warrantyCode).toBe('W-SN-9');
    expect(patch.warrantyDesc).toBe('12-month part warranty');
    expect(patch.assetSaleDate).toMatch(/^\d{2}\/\d{2}\/2026$/);
    expect(patch.assetExpiryDate).toMatch(/^\d{2}\/\d{2}\/2027$/);
    expect(patch.visitCategory).toBe('Installation');
  });

  it('does not replace an admin-entered asset or warranty description', () => {
    const patch = buildJobSheetDefaults({
      bookingId: 'abc123',
      createdAt,
      serviceType: 'REPAIR',
      jobDetails: {
        asset: 'Customer unit A1',
        warrantyDesc: 'Extended shop warranty',
        warrantyCode: 'CUSTOM',
        invoiceNumber: 'INV-9',
      },
      parts: [
        {
          partName: 'Fan motor',
          warrantyMonths: 6,
          warrantyCovered: false,
          installedAt: '2026-10-13T00:00:00.000Z',
        },
      ],
    });

    expect(patch.asset).toBeUndefined();
    expect(patch.warrantyDesc).toBeUndefined();
    expect(patch.warrantyCode).toBeUndefined();
    expect(patch.invoiceNumber).toBeUndefined();
    expect(patch.assetSaleDate).toBeDefined();
  });

  it('includes a second part when the asset still matches the first auto value', () => {
    const patch = buildJobSheetDefaults({
      bookingId: 'abc123',
      createdAt,
      serviceType: 'REPAIR',
      jobDetails: { asset: 'Compressor [SN-9]' },
      parts: [
        { partName: 'Compressor', serialNumber: 'SN-9', warrantyMonths: 12 },
        { partName: 'Capacitor', serialNumber: 'SN-2', warrantyMonths: 6 },
      ],
    });

    expect(patch.asset).toBe('Compressor [SN-9], Capacitor [SN-2]');
  });
});
