import { formatIndianPhone, toIndianE164 } from '@/features/auth/phone';

describe('toIndianE164', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['98765-43210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['6000000000', '+916000000000'],
  ])('accepts %s', (input, expected) => {
    expect(toIndianE164(input)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['987654321', '9 digits'],
    ['98765432101', '11 digits without leading 0'],
    ['5876543210', 'starts with 5'],
    ['1234567890', 'starts with 1'],
    ['+1 415 555 0100', 'non-Indian number'],
  ])('rejects %s (%s)', (input) => {
    expect(toIndianE164(input)).toBeNull();
  });
});

describe('formatIndianPhone', () => {
  it('groups digits for reading', () => {
    expect(formatIndianPhone('+919876543210')).toBe('+91 98765 43210');
  });

  it('leaves other formats untouched', () => {
    expect(formatIndianPhone('+14155550100')).toBe('+14155550100');
  });
});
