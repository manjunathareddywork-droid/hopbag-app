import { profileFormSchema } from '@/features/profile/schema';

const valid = { fullName: 'Asha Rao', homeState: 'KA', homeCity: 'Bengaluru', photoUri: null };

describe('profileFormSchema', () => {
  it('accepts a valid profile and trims text', () => {
    expect(
      profileFormSchema.parse({ ...valid, fullName: '  Asha Rao ', homeCity: ' Bengaluru ' }),
    ).toEqual(valid);
  });

  it.each([
    [{ fullName: 'A' }, 'profile.errors.nameShort'],
    [{ fullName: '   ' }, 'profile.errors.nameShort'],
    [{ fullName: 'x'.repeat(81) }, 'profile.errors.nameLong'],
    [{ homeState: '' }, 'profile.errors.stateRequired'],
    [{ homeState: 'ka' }, 'profile.errors.stateRequired'],
    [{ homeCity: 'B' }, 'profile.errors.cityShort'],
    [{ homeCity: 'x'.repeat(61) }, 'profile.errors.cityLong'],
  ])('rejects %j with %s', (override, message) => {
    const result = profileFormSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});
