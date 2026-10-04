import { fireEvent, screen } from '@testing-library/react-native';

import { OfferCard } from '@/features/offers/offer-card';
import { en } from '@/i18n/en';
import type { Offer, Profile } from '@/lib/database.types';
import { renderWithQuery } from '@/test-utils';

const offer = {
  id: 'o1',
  traveler_id: 't1',
  fare_paise: 25000,
  message: 'I can pick it up Friday',
  travel_date: '2026-10-12',
  mode: 'train',
  status: 'pending',
} as Offer;
const traveler = {
  id: 't1',
  full_name: 'Bala Reddy',
  traveler_verified_at: '2026-10-04T10:00:00Z',
} as Profile;

describe('OfferCard', () => {
  it('shows who, when, how and the fare, with Accept and Decline', async () => {
    const onAccept = jest.fn();
    await renderWithQuery(
      <OfferCard
        offer={offer}
        traveler={traveler}
        canRespond
        busy={false}
        onAccept={onAccept}
        onDecline={jest.fn()}
      />,
    );

    expect(screen.getByText('Bala Reddy')).toBeTruthy();
    expect(screen.getByText('₹250')).toBeTruthy();
    expect(screen.getByText('Train on 12 Oct 2026')).toBeTruthy();
    expect(screen.getByText(en.badge.verified)).toBeTruthy();
    await fireEvent.press(screen.getByText(en.offers.accept));
    expect(onAccept).toHaveBeenCalled();
  });

  it('hides the buttons once the request is no longer taking offers', async () => {
    await renderWithQuery(
      <OfferCard
        offer={{ ...offer, status: 'accepted' }}
        traveler={traveler}
        canRespond={false}
        busy={false}
        onAccept={jest.fn()}
        onDecline={jest.fn()}
      />,
    );

    expect(screen.queryByText(en.offers.accept)).toBeNull();
    expect(screen.getByText(en.offers.status.accepted)).toBeTruthy();
  });
});
