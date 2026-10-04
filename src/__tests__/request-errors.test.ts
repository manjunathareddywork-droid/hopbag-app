import { requestErrorMessage } from '@/features/requests/errors';
import { en } from '@/i18n/en';

describe('requestErrorMessage', () => {
  it('explains a blocked item with its reason', () => {
    expect(
      requestErrorMessage({ code: 'HB001', details: 'alcohol' }, 'requests.submitFailed'),
    ).toBe(`This item cannot be carried on Hopbag. ${en.blockedReasons.alcohol}`);
  });

  it('shows the weight limit from the database', () => {
    expect(requestErrorMessage({ code: 'HB003', details: '1000' }, 'requests.submitFailed')).toBe(
      'Too heavy for this kind of item. The limit is 1 kg.',
    );
  });

  it('maps the same-state rule', () => {
    expect(requestErrorMessage({ code: 'HB004' }, 'requests.submitFailed')).toBe(
      en.requests.errors.sameState,
    );
  });

  it('falls back for unknown errors', () => {
    expect(requestErrorMessage(new Error('offline'), 'requests.submitFailed')).toBe(
      en.requests.submitFailed,
    );
  });
});
