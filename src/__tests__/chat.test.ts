import { mergeMessage } from '@/features/chat/hooks';
import { chatOpen, containsPhoneNumber, phoneSharingAllowed } from '@/features/chat/phone';
import type { Message } from '@/lib/database.types';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('containsPhoneNumber (same cases as the database tests)', () => {
  it.each([
    'call me on 98765 43210',
    '+91-98765-43210 anytime',
    'my number 09876543210',
    '(987) 654.3210',
    'whatsapp 9876543210',
  ])('finds a number in "%s"', (text) => {
    expect(containsPhoneNumber(text)).toBe(true);
  });

  it.each([
    'Train 12627 on 10/10, 2 kg, Rs 450',
    'PNR 1234567890',
    'Pickup at 6 pm near gate 2',
    'Order 98765',
  ])('allows "%s"', (text) => {
    expect(containsPhoneNumber(text)).toBe(false);
  });
});

describe('chat rules', () => {
  it('opens the chat once an offer is accepted and closes it after completion', () => {
    expect(chatOpen('offered')).toBe(false);
    expect(chatOpen('accepted')).toBe(true);
    expect(chatOpen('picked_up')).toBe(true);
    expect(chatOpen('settled')).toBe(false);
  });

  it('allows phone numbers only after payment', () => {
    expect(phoneSharingAllowed('accepted')).toBe(false);
    expect(phoneSharingAllowed('paid')).toBe(true);
  });
});

describe('mergeMessage', () => {
  const m = (id: number) => ({ id, body: `m${id}` }) as Message;

  it('adds a new message in order', () => {
    expect(mergeMessage([m(1), m(3)], m(2)).map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it('ignores a message it already has (Realtime and the send reply both deliver it)', () => {
    const list = [m(1), m(2)];
    expect(mergeMessage(list, m(2))).toBe(list);
  });
});
