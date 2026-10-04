import { fingerprint, reportError, scrub, track } from '@/lib/monitoring';
import { supabase } from '@/lib/supabase';

const mockInsert = jest.fn(() => Promise.resolve({ error: null }));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => ({ insert: mockInsert })) },
}));
jest.mock('expo-device', () => ({ modelName: 'Test Phone' }));

beforeEach(() => {
  mockInsert.mockClear();
  (supabase.from as jest.Mock).mockClear();
});

describe('scrub', () => {
  it('masks phone numbers, codes and PNRs before anything leaves the phone', () => {
    expect(scrub('Call 98765 43210 or use code 123456, PNR 4521367890', 200)).toBe(
      'Call # or use code #, PNR #',
    );
  });

  it('keeps short numbers and limits length', () => {
    expect(scrub('Step 2 of 3', 200)).toBe('Step 2 of 3');
    expect(scrub('x'.repeat(50), 10)).toHaveLength(10);
  });
});

describe('fingerprint', () => {
  it('is the same for the same error and differs for another', () => {
    const stack = 'Error: boom\n    at Pay (pay.tsx:10)\n    at App';
    expect(fingerprint('boom', stack)).toBe(fingerprint('boom', stack));
    expect(fingerprint('boom', stack)).not.toBe(fingerprint('bang', stack));
  });
});

describe('reportError', () => {
  it('records unexpected errors in app_errors', () => {
    reportError(new Error('Cannot read property x of undefined'), { screen: 'pay' });
    expect(supabase.from).toHaveBeenCalledWith('app_errors');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        message: 'Cannot read property x of undefined',
        screen: 'pay',
        device_model: 'Test Phone',
      }),
    );
  });

  it('skips expected rule errors from the database', () => {
    reportError({ code: 'HB015', message: 'Fare out of band' });
    reportError({ code: '23505', message: 'duplicate' });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe('track', () => {
  it('records funnel events without personal data', () => {
    track('request_posted', { category: 'spices' });
    expect(supabase.from).toHaveBeenCalledWith('app_events');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'request_posted', properties: { category: 'spices' } }),
    );
  });
});

describe('logging never breaks the app', () => {
  it('swallows a failure to even start the insert', () => {
    (supabase.from as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no client');
    });
    expect(() => track('app_opened')).not.toThrow();
    (supabase.from as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no client');
    });
    expect(() => reportError(new Error('x'))).not.toThrow();
  });
});
