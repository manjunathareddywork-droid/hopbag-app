import { format, t } from '@/i18n';
import { en } from '@/i18n/en';

describe('t', () => {
  it('returns the English string for a key', () => {
    expect(t('common.appName')).toBe('Hopbag');
    expect(t('home.tagline')).toBe(en.home.tagline);
  });
});

describe('format', () => {
  it('fills placeholders', () => {
    expect(format('{{n}} of {{max}} items', { n: 2, max: 3 })).toBe('2 of 3 items');
  });

  it('leaves unknown placeholders alone', () => {
    expect(format('Hello {{name}}', {})).toBe('Hello {{name}}');
  });
});
