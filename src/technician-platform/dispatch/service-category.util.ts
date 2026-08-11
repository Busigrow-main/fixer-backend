/**
 * Maps catalog Service.slug → technician serviceCategories slugs
 * (see Fixxer-mobile SERVICE_CATEGORIES).
 */
export const SERVICE_SLUG_TO_CATEGORIES: Record<string, string[]> = {
  ac: ['ac-repair'],
  'ac-repair': ['ac-repair'],
  refrigerator: ['refrigerator'],
  'washing-machine': ['washing-machine'],
  microwave: ['microwave'],
  television: ['television'],
  geyser: ['geyser'],
  chimney: ['chimney'],
  'water-purifier': ['water-purifier'],
};

/** Resolve technician category slugs that match a service document slug. */
export function categoriesForServiceSlug(serviceSlug: string | null | undefined): string[] {
  if (!serviceSlug) return [];
  const key = serviceSlug.trim().toLowerCase();
  if (SERVICE_SLUG_TO_CATEGORIES[key]) {
    return SERVICE_SLUG_TO_CATEGORIES[key];
  }
  // Fallback: treat the service slug itself as a category.
  return [key];
}

export function technicianOffersCategories(
  technician: { serviceCategories?: string[]; skills?: string[] },
  requiredCategories: string[],
): boolean {
  if (!requiredCategories.length) return false;
  const offered = new Set(
    [...(technician.serviceCategories ?? []), ...(technician.skills ?? [])].map((s) =>
      s.trim().toLowerCase(),
    ),
  );
  return requiredCategories.some((c) => offered.has(c.toLowerCase()));
}
