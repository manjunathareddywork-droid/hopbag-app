import { profileFormSchema } from '@/features/profile/schema';

const valid = { fullName: 'Asha Rao', homeCityId: '12', photoUri: null, intent: 'get' as const };

describe('profileFormSchema', () => {
  it('accepts a valid profile and trims the name', () => {
    expect(profileFormSchema.parse({ ...valid, fullName: '  Asha Rao ' })).toEqual(valid);
  });

  it.each([
    [{ fullName: 'A' }, 'profile.errors.nameShort'],
    [{ fullName: '   ' }, 'profile.errors.nameShort'],
    [{ fullName: 'x'.repeat(81) }, 'profile.errors.nameLong'],
    [{ homeCityId: '' }, 'profile.errors.cityRequired'],
    [{ homeCityId: 'Hyderabad' }, 'profile.errors.cityRequired'],
  ])('rejects %j with %s', (override, message) => {
    const result = profileFormSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});
