import { fetchMyRequests } from '@/features/requests/api';
import { supabase } from '@/lib/supabase';

const mockQuery = {
  select: jest.fn(),
  eq: jest.fn(),
  order: jest.fn(),
};
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

describe('fetchMyRequests', () => {
  it('asks only for requests the user posted, not every request RLS lets them read', async () => {
    (supabase.from as jest.Mock).mockReturnValue(mockQuery);
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockQuery.order.mockResolvedValue({ data: [], error: null });

    await fetchMyRequests('user-1');

    expect(supabase.from).toHaveBeenCalledWith('item_requests');
    expect(mockQuery.eq).toHaveBeenCalledWith('requester_id', 'user-1');
  });
});
