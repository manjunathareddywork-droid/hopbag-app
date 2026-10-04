import { formatGrams, kgToGrams } from '@/features/requests/weight';

describe('kgToGrams', () => {
  it.each([
    ['2', 2000],
    ['1.5', 1500],
    ['1,5', 1500],
    ['0.25', 250],
    ['0.005', 5],
    [' 3 ', 3000],
  ])('%s kg -> %i g', (input, expected) => {
    expect(kgToGrams(input)).toBe(expected);
  });

  it.each(['', '0', '0.0', 'abc', '1.2345', '-1', '100'])('rejects %s', (input) => {
    expect(kgToGrams(input)).toBeNull();
  });
});

describe('formatGrams', () => {
  it.each([
    [500, '500 g'],
    [1000, '1 kg'],
    [1500, '1.5 kg'],
    [2250, '2.25 kg'],
    [5000, '5 kg'],
  ])('%i -> %s', (grams, expected) => {
    expect(formatGrams(grams)).toBe(expected);
  });
});
