import { en, type Strings } from './en';

export type Locale = 'en';

const locales: Record<Locale, Strings> = { en };

let current: Locale = 'en';

export function setLocale(locale: Locale) {
  current = locale;
}

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type StringKey = Leaves<Strings>;

/** Look up a string by dotted key, filling {{placeholders}} from params. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], locales[current]);
  if (typeof value !== 'string') return key;
  return params ? format(value, params) : value;
}

/** Replace {{name}} placeholders; unknown placeholders are left as-is. */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
