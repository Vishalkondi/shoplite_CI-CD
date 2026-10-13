import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../src/api/client.js';

function mockFetch(status, body) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: body === undefined ? () => Promise.reject(new SyntaxError('no JSON')) : () => Promise.resolve(body),
  };
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
}

describe('api client', () => {
  it('getProducts calls GET /api/products and returns the JSON body', async () => {
    const fetch = mockFetch(200, [{ id: 1 }]);
    await expect(api.getProducts()).resolves.toEqual([{ id: 1 }]);
    expect(fetch).toHaveBeenCalledWith('/api/products', {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('placeOrder POSTs the order as JSON', async () => {
    const fetch = mockFetch(201, { id: 7 });
    const order = { customerName: 'Ada', customerEmail: 'ada@example.com', items: [] };
    await expect(api.placeOrder(order)).resolves.toEqual({ id: 7 });
    expect(fetch).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('turns an error response into an ApiError with the server message and details', async () => {
    mockFetch(400, { error: 'Validation failed', details: ['customerEmail is invalid'] });
    const err = await api.placeOrder({}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ message: 'Validation failed', status: 400, details: ['customerEmail is invalid'] });
  });

  it('uses a generic message when the error response is not JSON', async () => {
    mockFetch(502);
    await expect(api.getProducts()).rejects.toMatchObject({ message: 'Request failed (502)', status: 502, details: [] });
  });

  it('reports a network failure as status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.getProducts()).rejects.toMatchObject({
      message: 'Cannot reach the server. Is the backend running?',
      status: 0,
    });
  });
});
