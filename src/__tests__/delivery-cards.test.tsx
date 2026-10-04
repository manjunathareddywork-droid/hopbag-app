import { fireEvent, screen } from '@testing-library/react-native';

import { RequesterDeliveryCard } from '@/features/delivery/requester-delivery-card';
import { TravelerDeliveryCard } from '@/features/delivery/traveler-delivery-card';
import { en } from '@/i18n/en';
import type { Delivery, Dispute, ItemRequest, Payout } from '@/lib/database.types';
import { renderWithQuery } from '@/test-utils';

const mock = {
  delivery: null as Delivery | null,
  dispute: null as Dispute | null,
  payouts: [] as Payout[],
  confirmCode: {
    mutate: jest.fn(),
    isPending: false,
    error: null,
    data: undefined as string | undefined,
  },
};
jest.mock('@/features/delivery/hooks', () => ({
  useDelivery: () => ({ data: mock.delivery }),
  useDispute: () => ({ data: mock.dispute }),
  usePickupPhotoUrl: () => ({ data: undefined }),
  useMyPayouts: () => ({ data: mock.payouts }),
  useConfirmReceived: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useMarkPickedUp: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useMarkHandedOver: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useConfirmDeliveryCode: () => mock.confirmCode,
}));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: unknown }) => children }));
jest.mock('expo-image-picker', () => ({}));

const request = (status: ItemRequest['status']) => ({ id: 'r1', status }) as ItemRequest;
const pickedUp = {
  request_id: 'r1',
  pickup_photo_path: 't/p.jpg',
  pickup_weight_grams: 950,
  picked_up_at: '2026-10-05T10:00:00Z',
  delivered_at: null,
  delivery_method: null,
  confirm_by: null,
} as Delivery;

beforeEach(() => {
  mock.delivery = null;
  mock.dispute = null;
  mock.payouts = [];
  mock.confirmCode = { mutate: jest.fn(), isPending: false, error: null, data: undefined };
});

describe('RequesterDeliveryCard', () => {
  it('waits for pickup after payment and allows reporting a problem', async () => {
    await renderWithQuery(<RequesterDeliveryCard request={request('paid')} />);
    expect(screen.getByText(en.delivery.waitingPickup)).toBeTruthy();
    expect(screen.getByText(en.delivery.reportProblem)).toBeTruthy();
    expect(screen.queryByText(en.delivery.showCode)).toBeNull();
  });

  it('shows the pickup weight and the handover code button after pickup', async () => {
    mock.delivery = pickedUp;
    await renderWithQuery(<RequesterDeliveryCard request={request('picked_up')} />);
    expect(screen.getByText(/Weight: 950 g/)).toBeTruthy();
    expect(screen.getByText(en.delivery.showCode)).toBeTruthy();
  });

  it('asks to confirm a handover without code', async () => {
    mock.delivery = {
      ...pickedUp,
      delivered_at: '2026-10-06T10:00:00Z',
      delivery_method: 'handover',
      confirm_by: '2026-10-08T10:00:00Z',
    };
    await renderWithQuery(<RequesterDeliveryCard request={request('delivered')} />);
    expect(screen.getByText(en.delivery.iReceivedIt)).toBeTruthy();
  });

  it('shows an open dispute and hides actions on a frozen request', async () => {
    mock.dispute = { status: 'open', reason: 'Item arrived damaged' } as Dispute;
    await renderWithQuery(<RequesterDeliveryCard request={request('disputed')} />);
    expect(screen.getByText('Under review: Item arrived damaged')).toBeTruthy();
    expect(screen.queryByText(en.delivery.reportProblem)).toBeNull();
  });
});

describe('TravelerDeliveryCard', () => {
  it('asks for pickup photo and weight after payment', async () => {
    await renderWithQuery(<TravelerDeliveryCard request={request('paid')} />);
    expect(screen.getByText(en.delivery.markPickedUp)).toBeTruthy();
  });

  it('sends the typed code and explains a wrong one', async () => {
    mock.delivery = pickedUp;
    const view = await renderWithQuery(<TravelerDeliveryCard request={request('picked_up')} />);

    await fireEvent.changeText(screen.getByLabelText(en.delivery.codeLabel), '12 34 56');
    await fireEvent.press(screen.getByText(en.delivery.confirmCode));
    expect(mock.confirmCode.mutate).toHaveBeenCalledWith({ requestId: 'r1', code: '123456' });

    mock.confirmCode = { ...mock.confirmCode, data: 'wrong_code' };
    await view.rerender(<TravelerDeliveryCard request={request('picked_up')} />);
    expect(screen.getByText(en.delivery.wrongCode)).toBeTruthy();
  });

  it('shows the unlocked payout after settlement', async () => {
    mock.payouts = [{ request_id: 'r1', net_paise: 58000, fee_paise: 2000 } as Payout];
    await renderWithQuery(<TravelerDeliveryCard request={request('settled')} />);
    expect(screen.getByText('Done. ₹580 unlocked for you (after a ₹20 Hopbag fee).')).toBeTruthy();
  });
});
