export const APPLIANCE_CATEGORIES = [
  'ac',
  'refrigerator',
  'washing-machine',
  'microwave',
] as const;

export type ApplianceCategory = (typeof APPLIANCE_CATEGORIES)[number];

const APPLIANCE_TYPE_ALIASES: Record<string, ApplianceCategory> = {
  ac: 'ac',
  acs: 'ac',
  'air-conditioner': 'ac',
  'air-conditioners': 'ac',
  airconditioner: 'ac',
  refrigerator: 'refrigerator',
  refrigerators: 'refrigerator',
  fridge: 'refrigerator',
  fridges: 'refrigerator',
  'washing-machine': 'washing-machine',
  'washing-machines': 'washing-machine',
  washer: 'washing-machine',
  washers: 'washing-machine',
  washingmachine: 'washing-machine',
  microwave: 'microwave',
  microwaves: 'microwave',
};

export function resolveApplianceCategory(
  type?: string,
): ApplianceCategory | undefined {
  const key = String(type || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  if (!key) return undefined;
  return APPLIANCE_TYPE_ALIASES[key];
}

export function assertApplianceCategory(type?: string): ApplianceCategory | undefined {
  if (!type || !String(type).trim()) return undefined;
  const resolved = resolveApplianceCategory(type);
  if (!resolved) {
    throw new Error(
      'Supported appliance types: ac, refrigerator, washing-machine, microwave',
    );
  }
  return resolved;
}
