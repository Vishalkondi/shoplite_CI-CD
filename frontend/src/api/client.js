// Thin wrapper around fetch for the backend REST API.
// All paths are relative (/api/...), so the same build works behind the Vite
// dev proxy and behind nginx in Docker.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(body?.error || `Request failed (${response.status})`, response.status, body?.details);
  }
  return body;
}

export const api = {
  getProducts: () => request('/products'),
  placeOrder: (order) => request('/orders', { method: 'POST', body: JSON.stringify(order) }),
};
