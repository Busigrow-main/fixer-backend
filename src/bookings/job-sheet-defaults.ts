export type JobSheetPart = {
  partName?: string;
  serialNumber?: string;
  warrantyMonths?: number;
  warrantyCovered?: boolean;
  installedAt?: string | Date;
  sparePartId?: { name?: string; warrantyMonths?: number } | null;
};

const LABOUR_WARRANTY = '60-day labour warranty for the same fault';

const VISIT_CATEGORY: Record<string, string> = {
  REPAIR: 'Repair',
  INSTALLATION: 'Installation',
  MAINTENANCE: 'Maintenance',
  WARRANTY_CHECK: 'Warranty check',
};

function blank(current: Record<string, unknown>, key: string): boolean {
  return !String(current[key] ?? '').trim();
}

function formatDate(value: Date): string {
  const dd = String(value.getDate()).padStart(2, '0');
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${value.getFullYear()}`;
}

function addMonths(value: Date, months: number): Date {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function partLabel(part: JobSheetPart): string {
  const name = part.partName || part.sparePartId?.name || 'Spare part';
  return part.serialNumber ? `${name} [${part.serialNumber}]` : name;
}

function isGeneratedWarrantyDesc(value: string): boolean {
  return (
    value === LABOUR_WARRANTY ||
    value === 'Warranty replacement · no charge' ||
    /^\d+-month part warranty$/.test(value)
  );
}

export function buildJobSheetDefaults(input: {
  bookingId: string;
  createdAt?: Date | string;
  serviceType?: string;
  jobDetails?: Record<string, unknown> | null;
  parts?: JobSheetPart[];
}): Record<string, string> {
  const current = input.jobDetails || {};
  const next: Record<string, string> = {};
  const parts = (input.parts || []).filter((part) => partLabel(part) !== 'Spare part' || part.serialNumber);

  if (blank(current, 'warrantyPeriod')) next.warrantyPeriod = '60 Days';
  if (blank(current, 'visitCategory')) {
    next.visitCategory = VISIT_CATEGORY[String(input.serviceType || '')] || 'Repair';
  }
  if (blank(current, 'invoiceNumber')) {
    const id = String(input.bookingId || '');
    next.invoiceNumber = `FX-${id.slice(-8).toUpperCase()}`;
  }
  if (blank(current, 'contractCode')) next.contractCode = 'FX-60';
  if (blank(current, 'contractDesc')) next.contractDesc = '60-day service warranty';

  const created = input.createdAt ? new Date(input.createdAt) : new Date();
  if (!Number.isNaN(created.getTime())) {
    if (blank(current, 'contractStartDate')) next.contractStartDate = formatDate(created);
    if (blank(current, 'contractExpiryDate')) {
      const end = new Date(created);
      end.setDate(end.getDate() + 60);
      next.contractExpiryDate = formatDate(end);
    }
  }

  const currentDesc = String(current.warrantyDesc || '');
  if (blank(current, 'warrantyDesc')) next.warrantyDesc = LABOUR_WARRANTY;

  if (!parts.length) return next;

  const names = parts.map(partLabel);
  const generatedAsset = names.join(', ');
  if (blank(current, 'asset') || names.slice(0, -1).join(', ') === String(current.asset || '')) {
    next.asset = generatedAsset;
  }

  const primary =
    parts.find((part) => Number(part.warrantyMonths) > 0 || part.warrantyCovered) || parts[0];
  const months = Number(primary.warrantyMonths || primary.sparePartId?.warrantyMonths) || 0;

  if (blank(current, 'warrantyCode')) {
    next.warrantyCode = primary.serialNumber
      ? `W-${primary.serialNumber}`
      : months > 0
        ? `W-${months}M`
        : 'W-PART';
  }

  if (blank(current, 'warrantyDesc') || isGeneratedWarrantyDesc(currentDesc)) {
    if (primary.warrantyCovered) next.warrantyDesc = 'Warranty replacement · no charge';
    else if (months > 0) next.warrantyDesc = `${months}-month part warranty`;
  }

  const installed = primary.installedAt ? new Date(primary.installedAt) : new Date();
  if (!Number.isNaN(installed.getTime())) {
    if (blank(current, 'assetSaleDate')) next.assetSaleDate = formatDate(installed);
    if (blank(current, 'assetExpiryDate') && months > 0) {
      next.assetExpiryDate = formatDate(addMonths(installed, months));
    }
  }

  return next;
}

export function partsFromVisits(visits: Array<{ partsUsed?: JobSheetPart[] }> | null | undefined): JobSheetPart[] {
  return (visits || []).flatMap((visit) => visit.partsUsed || []);
}
