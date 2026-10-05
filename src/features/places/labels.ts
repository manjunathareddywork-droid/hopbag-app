import type { SelectItem } from '@/components/select-field';
import type { City, State } from '@/lib/database.types';

const stateName = (code: string, states: State[] | undefined) =>
  states?.find((s) => s.code === code)?.name ?? code;

/** "Mysuru, Karnataka" */
export function cityLabel(city: City | undefined, states: State[] | undefined): string {
  return city ? `${city.name}, ${stateName(city.state_code, states)}` : '';
}

/** Picker items; search also matches old names (Mysore) and the state. */
export function cityItems(cities: City[], states: State[]): SelectItem[] {
  return cities.map((c) => ({
    value: String(c.id),
    label: cityLabel(c, states),
    shortLabel: c.name,
    keywords: [...c.aliases, stateName(c.state_code, states)],
  }));
}
