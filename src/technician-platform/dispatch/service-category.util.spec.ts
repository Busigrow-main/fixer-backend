import {
  categoriesForServiceSlug,
  technicianOffersCategories,
} from './service-category.util';

describe('service-category.util', () => {
  it('maps ac service slug to ac-repair category', () => {
    expect(categoriesForServiceSlug('ac')).toEqual(['ac-repair']);
  });

  it('passes through matching slugs', () => {
    expect(categoriesForServiceSlug('refrigerator')).toEqual(['refrigerator']);
    expect(categoriesForServiceSlug('washing-machine')).toEqual(['washing-machine']);
  });

  it('falls back to the slug itself when unknown', () => {
    expect(categoriesForServiceSlug('custom-widget')).toEqual(['custom-widget']);
  });

  it('returns empty for missing slug', () => {
    expect(categoriesForServiceSlug(undefined)).toEqual([]);
    expect(categoriesForServiceSlug('')).toEqual([]);
  });

  it('matches technician categories case-insensitively', () => {
    expect(
      technicianOffersCategories(
        { serviceCategories: ['AC-Repair'], skills: [] },
        ['ac-repair'],
      ),
    ).toBe(true);
    expect(
      technicianOffersCategories(
        { serviceCategories: ['microwave'], skills: [] },
        ['ac-repair'],
      ),
    ).toBe(false);
    expect(
      technicianOffersCategories(
        { serviceCategories: [], skills: ['refrigerator'] },
        ['refrigerator'],
      ),
    ).toBe(true);
  });
});
