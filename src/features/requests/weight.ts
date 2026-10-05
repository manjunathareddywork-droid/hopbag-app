/** Weights are stored in grams (integers). People type kilograms. */

/** "1.5" -> 1500, "0.25" -> 250, "2" -> 2000. Up to 3 decimals. Null if invalid. */
export function kgToGrams(input: string): number | null {
  const m = /^(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(input.trim());
  if (!m) return null;
  const grams = Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0'));
  return grams > 0 ? grams : null;
}

/** 500 -> "500 g", 1500 -> "1.5 kg", 2000 -> "2 kg". */
export function formatGrams(grams: number): string {
  if (grams < 1000) return `${grams} g`;
  const kg = Math.floor(grams / 1000);
  const fraction = String(grams % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return fraction ? `${kg}.${fraction} kg` : `${kg} kg`;
}

/** 4500 -> "4.5", 500 -> "0.5", 5000 -> "5": kilograms as people type them. */
export function gramsToKg(grams: number): string {
  const rest = String(grams % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return rest ? `${Math.floor(grams / 1000)}.${rest}` : String(Math.floor(grams / 1000));
}
