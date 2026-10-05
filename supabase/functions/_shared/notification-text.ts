// English text for push notifications, by kind. No imports and no Deno APIs so
// Jest can test it (src/__tests__/notification-text.test.ts). The in-app Updates
// screen uses the app's i18n file instead; keep the two in step.

export type NotificationParams = {
  item?: string;
  name?: string;
  amount?: number;
  preview?: string;
  reason?: string;
  resolution?: 'released' | 'refunded';
  stars?: number;
};

/** 120000 -> "Rs 1,200", 12345650 -> "Rs 1,23,456.50" (Indian grouping, no floats). */
export function formatRupees(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  const digits = String(rupees);
  const last3 = digits.slice(-3);
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `Rs ${head ? `${head},${last3}` : last3}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

export function renderNotification(
  kind: string,
  p: NotificationParams,
): { title: string; body: string } {
  const item = p.item ?? 'your item';
  const amount = typeof p.amount === 'number' ? formatRupees(p.amount) : '';
  switch (kind) {
    case 'offer_received':
      return {
        title: 'New offer',
        body: `${p.name ?? 'A traveler'} offered ${amount} to carry ${item}.`,
      };
    case 'offer_accepted':
      return { title: 'Offer accepted', body: `Your offer of ${amount} for ${item} was accepted.` };
    case 'offer_not_chosen':
      return {
        title: 'Offer not chosen',
        body: `The requester chose another traveler for ${item}.`,
      };
    case 'request_paid':
      return { title: 'Payment received', body: `${item} is paid. You can buy or collect it now.` };
    case 'picked_up':
      return { title: 'Item picked up', body: `The traveler has picked up ${item}.` };
    case 'handed_over':
      return {
        title: 'Did you get it?',
        body: `The traveler says ${item} was handed over. Confirm within 48 hours.`,
      };
    case 'completed':
      return {
        title: 'Delivery completed',
        body: `${item} is delivered. Thank you for using Hopbag!`,
      };
    case 'payout_unlocked':
      return { title: 'Payment unlocked', body: `${amount} is unlocked for delivering ${item}.` };
    case 'disputed':
      return {
        title: 'Problem reported',
        body: `A problem was reported for ${item}. Payment is on hold.`,
      };
    case 'dispute_resolved':
      return {
        title: 'Review finished',
        body:
          p.resolution === 'refunded'
            ? `Hopbag refunded the requester for ${item}.`
            : `Hopbag released the payment for ${item} to the traveler.`,
      };
    case 'refunded':
      return { title: 'Refunded', body: `The payment for ${item} was refunded.` };
    case 'expired':
      return { title: 'Request expired', body: `${item} passed its date without a traveler.` };
    case 'message':
      return { title: p.name ?? 'New message', body: p.preview ?? `New message about ${item}.` };
    case 'rated':
      return { title: 'You were rated', body: `You got ${p.stars ?? ''} stars for ${item}.` };
    case 'id_approved':
      return { title: 'ID verified', body: 'You are now a verified traveler.' };
    case 'id_rejected':
      return { title: 'ID not accepted', body: p.reason ?? 'Please send a new photo of your ID.' };
    case 'ticket_approved':
      return { title: 'Ticket approved', body: 'You can now offer to carry items on this trip.' };
    case 'ticket_rejected':
      return { title: 'Ticket not accepted', body: p.reason ?? 'Please send a new ticket photo.' };
    case 'route_request':
      return {
        title: 'New request on your route',
        body: `Someone needs ${item}. Send an offer if you can carry it.`,
      };
    case 'pickup_declined':
      return {
        title: `${p.name ?? 'The traveler'} declined your item`,
        body: `${p.reason ?? ''} Your payment for ${item} is being refunded in full.`.trim(),
      };
    default:
      return { title: 'Hopbag', body: 'You have an update.' };
  }
}
