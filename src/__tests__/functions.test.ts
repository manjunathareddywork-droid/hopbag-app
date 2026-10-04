import { FunctionsHttpError } from '@supabase/supabase-js';

import { callFunction, FunctionError } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

const invoke = supabase.functions.invoke as jest.Mock;

describe('callFunction', () => {
  it('returns the data', async () => {
    invoke.mockResolvedValue({ data: { order_id: 'order_1' }, error: null });
    await expect(callFunction('create-order', { request_id: 'r1' })).resolves.toEqual({
      order_id: 'order_1',
    });
    expect(invoke).toHaveBeenCalledWith('create-order', { body: { request_id: 'r1' } });
  });

  it('turns a function error into its code and details', async () => {
    const response = { json: async () => ({ error: { code: 'HB022', details: null } }) };
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(response) });

    await expect(callFunction('create-order', { request_id: 'r1' })).rejects.toEqual(
      new FunctionError('HB022', null),
    );
    await expect(callFunction('create-order', { request_id: 'r1' })).rejects.toMatchObject({
      code: 'HB022',
    });
  });
});
