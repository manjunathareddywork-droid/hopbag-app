/**
 * Indian mobile numbers only (Phase 1 is India-only). Accepts what people type:
 * spaces, dashes, a leading 0, or +91 / 91. Returns E.164 (+91XXXXXXXXXX) or null.
 */
export function toIndianE164(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** +919876543210 -> +91 98765 43210 */
export function formatIndianPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
