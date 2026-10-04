import { en } from '@/i18n/en';
import type { Category, City, State } from '@/lib/database.types';

type CategoryText = { name: string; description: string };

/** Translated category text by id; falls back to the database text for new categories. */
export function categoryText(
  category: Pick<Category, 'id' | 'name' | 'description'>,
): CategoryText {
  const known = (en.categories as Record<string, CategoryText>)[category.id];
  return known ?? { name: category.name, description: category.description };
}

/** "Mysuru, Karnataka" */
export function cityLabel(city: City | undefined, states: State[] | undefined): string {
  if (!city) return '';
  const state = states?.find((s) => s.code === city.state_code)?.name ?? city.state_code;
  return `${city.name}, ${state}`;
}
