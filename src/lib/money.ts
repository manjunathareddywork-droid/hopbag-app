/** Money is stored in paise (integers). These helpers never use floating point. */

/** "1,200" or "1200" -> 120000 paise. Whole rupees only. Null if not a number. */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, '');
  if (!/^\d{1,7}$/.test(cleaned)) return null;
  return Number(cleaned) * 100;
}

/** 12345650 -> "₹1,23,456.50"; 120000 -> "₹1,200" (Indian digit grouping). */
export function formatPaise(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  const digits = String(rupees);
  const last3 = digits.slice(-3);
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = head ? `${head},${last3}` : last3;
  return `₹${grouped}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}
