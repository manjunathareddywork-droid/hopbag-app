import { en } from '@/i18n/en';
import type { Category } from '@/lib/database.types';

type CategoryText = { name: string; description: string };

/** Translated category text by id; falls back to the database text for new categories. */
export function categoryText(
  category: Pick<Category, 'id' | 'name' | 'description'>,
): CategoryText {
  const known = (en.categories as Record<string, CategoryText>)[category.id];
  return known ?? { name: category.name, description: category.description };
}
