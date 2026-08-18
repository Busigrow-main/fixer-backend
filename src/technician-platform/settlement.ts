import {
  INVENTORY_PART_COMMISSION_RATE,
  SELF_PART_PLATFORM_FEE,
} from './constants';

export type SettlementPart = {
  isThirdParty?: boolean;
  sourcedBy?: string;
  cost?: number;
  quantity?: number;
  platformFeeAmount?: number;
  warrantyCovered?: boolean;
};

export type TechnicianSettlement = {
  customerTotal: number;
  labour: number;
  additionalTotal: number;
  inventoryPartsTotal: number;
  inventoryCommission: number;
  inventoryCommissionRate: number;
  inventoryToFixxer: number;
  selfPartsTotal: number;
  selfPartCount: number;
  selfPartFee: number;
  technicianNet: number;
  fixxerNet: number;
};

export function isSelfSourcedPart(usage: SettlementPart): boolean {
  return usage.isThirdParty === true || usage.sourcedBy === 'SELF';
}

export function roundMoney(amount?: number | null): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export function partLineAmount(usage: SettlementPart): number {
  const qty = usage.quantity != null && Number.isFinite(Number(usage.quantity))
    ? Number(usage.quantity)
    : 1;
  return (Number(usage.cost) || 0) * qty;
}

export function collectPartsFromVisits(
  visits: Array<{ partsUsed?: SettlementPart[] | null }> | null | undefined,
): SettlementPart[] {
  if (!visits?.length) return [];
  return visits.flatMap((v) => v.partsUsed || []);
}

/**
 * Technician / Fixxer split of a collected job payment.
 *
 * - Service (+ additional) charges: 100% technician
 * - Fixxer inventory parts: 10% technician commission, 90% Fixxer
 * - Self-sourced parts: 100% technician (they supplied them), minus ₹100/line to Fixxer
 */
export function computeTechnicianSettlement(opts: {
  serviceTotal?: number;
  additionalCharges?: Array<{ amount?: number }> | null;
  parts?: SettlementPart[] | null;
}): TechnicianSettlement {
  const labour = roundMoney(opts.serviceTotal);
  const additionalTotal = roundMoney(
    (opts.additionalCharges || []).reduce(
      (sum, c) => sum + (Number(c.amount) || 0),
      0,
    ),
  );

  let inventoryPartsTotal = 0;
  let selfPartsTotal = 0;
  let selfPartCount = 0;
  let selfPartFee = 0;

  for (const part of opts.parts || []) {
    if (part.warrantyCovered) continue;
    const amount = partLineAmount(part);
    if (isSelfSourcedPart(part)) {
      selfPartsTotal += amount;
      selfPartCount += 1;
      selfPartFee += Number(part.platformFeeAmount) || SELF_PART_PLATFORM_FEE;
    } else {
      inventoryPartsTotal += amount;
    }
  }

  inventoryPartsTotal = roundMoney(inventoryPartsTotal);
  selfPartsTotal = roundMoney(selfPartsTotal);
  selfPartFee = roundMoney(selfPartFee);

  const inventoryCommission = roundMoney(
    inventoryPartsTotal * INVENTORY_PART_COMMISSION_RATE,
  );
  const inventoryToFixxer = roundMoney(inventoryPartsTotal - inventoryCommission);
  const technicianLabour = roundMoney(labour + additionalTotal);
  const technicianNet = roundMoney(
    technicianLabour + inventoryCommission + selfPartsTotal - selfPartFee,
  );
  const fixxerNet = roundMoney(inventoryToFixxer + selfPartFee);
  const customerTotal = roundMoney(
    labour + additionalTotal + inventoryPartsTotal + selfPartsTotal,
  );

  return {
    customerTotal,
    labour: technicianLabour,
    additionalTotal,
    inventoryPartsTotal,
    inventoryCommission,
    inventoryCommissionRate: INVENTORY_PART_COMMISSION_RATE,
    inventoryToFixxer,
    selfPartsTotal,
    selfPartCount,
    selfPartFee,
    technicianNet,
    fixxerNet,
  };
}

export type TechnicianPayoutLine = {
  amount: number;
  type: 'LABOUR' | 'PARTS' | 'SELF_PART_FEE';
  description: string;
};

/** Ledger lines that make up the technician's net for a job. */
export function buildTechnicianPayoutLines(
  settlement: TechnicianSettlement,
  bookingId: string,
  opts: { includeFees?: boolean } = {},
): TechnicianPayoutLine[] {
  const lines: TechnicianPayoutLine[] = [];
  if (settlement.labour > 0) {
    lines.push({
      amount: settlement.labour,
      type: 'LABOUR',
      description: `Service charges for ${bookingId}`,
    });
  }
  if (settlement.inventoryCommission > 0) {
    lines.push({
      amount: settlement.inventoryCommission,
      type: 'PARTS',
      description: `10% inventory parts commission for ${bookingId}`,
    });
  }
  if (settlement.selfPartsTotal > 0) {
    lines.push({
      amount: settlement.selfPartsTotal,
      type: 'PARTS',
      description: `Self-sourced parts for ${bookingId}`,
    });
  }
  if (opts.includeFees && settlement.selfPartFee > 0) {
    lines.push({
      amount: -Math.abs(settlement.selfPartFee),
      type: 'SELF_PART_FEE',
      description: `Outside-parts fee (₹100 × ${settlement.selfPartCount}) for ${bookingId}`,
    });
  }
  return lines;
}

export function earningDisplayLabel(earning: {
  type?: string;
  description?: string;
}): string {
  const type = earning.type || '';
  const desc = (earning.description || '').toLowerCase();
  if (type === 'LABOUR') return 'Service charges';
  if (type === 'SELF_PART_FEE') return 'Outside-parts fee';
  if (type === 'PARTS') {
    if (desc.includes('commission')) return 'Inventory commission (10%)';
    if (desc.includes('self')) return 'Self-sourced parts';
    return 'Parts';
  }
  if (type === 'BONUS') return 'Bonus';
  if (type === 'JOINING_FEE_REFUND') return 'Joining fee refund';
  return type.replace(/_/g, ' ');
}
