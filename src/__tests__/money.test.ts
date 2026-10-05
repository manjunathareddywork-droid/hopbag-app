import { formatPaise, rupeesToPaise } from '@/lib/money';

describe('rupeesToPaise', () => {
  it.each([
    ['500', 50000],
    ['1,200', 120000],
    [' ₹ 2,500 ', 250000],
    ['0', 0],
  ])('%s -> %i paise', (input, expected) => {
    expect(rupeesToPaise(input)).toBe(expected);
  });

  it.each(['', 'abc', '12.50', '-5', '12345678'])('rejects %s', (input) => {
    expect(rupeesToPaise(input)).toBeNull();
  });
});

describe('formatPaise', () => {
  it.each([
    [5000, 'Rs 50'],
    [120000, 'Rs 1,200'],
    [10000000, 'Rs 1,00,000'],
    [12345650, 'Rs 1,23,456.50'],
    [105, 'Rs 1.05'],
  ])('%i -> %s', (paise, expected) => {
    expect(formatPaise(paise)).toBe(expected);
  });
});
