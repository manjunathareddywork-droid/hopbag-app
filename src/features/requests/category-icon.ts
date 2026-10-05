import type { IconName } from '@/components/icon';

/** Icons for the category grid, in the outline style of the designs. */
const ICONS: Record<string, IconName> = {
  coffee_tea: 'cup',
  sweets_snacks: 'store',
  books: 'book',
  clothes: 'shirt',
  spices: 'droplet',
  cosmetics: 'smile',
  pickles: 'jar',
  chocolates: 'candy',
  dry_fruits: 'peanut',
  handicrafts: 'palette',
  toys: 'toy',
};

export function categoryIcon(categoryId: string): IconName {
  return ICONS[categoryId] ?? 'package';
}
