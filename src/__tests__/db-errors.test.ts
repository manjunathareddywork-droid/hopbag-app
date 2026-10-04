import { dbErrorMessage } from '@/lib/db-errors';
import { en } from '@/i18n/en';

describe('dbErrorMessage', () => {
  it('explains a blocked item with its reason', () => {
    expect(dbErrorMessage({ code: 'HB001', details: 'alcohol' }, 'requests.submitFailed')).toBe(
      `This item cannot be carried on Hopbag. ${en.blockedReasons.alcohol}`,
    );
  });

  it('shows the weight limit from the database', () => {
    expect(dbErrorMessage({ code: 'HB003', details: '1000' }, 'requests.submitFailed')).toBe(
      'Too heavy for this kind of item. The limit is 1 kg.',
    );
  });

  it('maps the same-state rule', () => {
    expect(dbErrorMessage({ code: 'HB004' }, 'requests.submitFailed')).toBe(
      en.requests.errors.sameState,
    );
  });

  it('falls back for unknown errors', () => {
    expect(dbErrorMessage(new Error('offline'), 'requests.submitFailed')).toBe(
      en.requests.submitFailed,
    );
  });

  it('explains trip limits with the current values', () => {
    expect(dbErrorMessage({ code: 'HB007', details: '3,5000' }, 'trips.submitFailed')).toBe(
      'A trip can carry at most 3 items and 5 kg.',
    );
  });

  it('explains the travel date window', () => {
    expect(dbErrorMessage({ code: 'HB006', details: '60' }, 'trips.submitFailed')).toBe(
      'Choose a date between today and 60 days from now.',
    );
  });

  it('tells non-admins they cannot review', () => {
    expect(dbErrorMessage({ code: 'HB012' }, 'admin.reviewFailed')).toBe(en.errors.adminsOnly);
  });

  it('shows the fare band from the database', () => {
    expect(dbErrorMessage({ code: 'HB015', details: '10000,50000' }, 'offers.sendFailed')).toBe(
      'Choose a fare between ₹100 and ₹500.',
    );
  });

  it('says how much space is left on a full trip', () => {
    expect(dbErrorMessage({ code: 'HB018', details: '0,1500' }, 'offers.sendFailed')).toBe(
      'Your trip is full: 0 more items and 1.5 kg left.',
    );
  });

  it('explains a duplicate offer', () => {
    expect(dbErrorMessage({ code: '23505' }, 'offers.sendFailed')).toBe(
      en.offers.errors.alreadyOffered,
    );
  });
});
