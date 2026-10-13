// Whole-app tests: the real components and cart hook, with only the API mocked.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { api, ApiError } from '../src/api/client.js';
import { keyboard, mug, products } from './fixtures.js';

const productNames = () => screen.queryAllByRole('article').map((a) => within(a).getByRole('heading').textContent);
const cartDrawer = () => screen.getByRole('complementary', { name: 'Shopping cart' });

describe('App', () => {
  it('shows loading skeletons, then the products', async () => {
    vi.spyOn(api, 'getProducts').mockResolvedValue(products);
    render(<App />);

    expect(screen.getByLabelText('Loading products')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Coffee Mug' })).toBeInTheDocument();
    expect(productNames()).toEqual(['Mechanical Keyboard', 'Coffee Mug', 'Clean Code']);
  });

  it('shows the error and loads again when "Try again" is clicked', async () => {
    vi.spyOn(api, 'getProducts')
      .mockRejectedValueOnce(new ApiError('Cannot reach the server. Is the backend running?', 0))
      .mockResolvedValueOnce(products);
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Coffee Mug' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('filters by category and searches name and description', async () => {
    vi.spyOn(api, 'getProducts').mockResolvedValue(products);
    render(<App />);
    await screen.findByRole('heading', { name: 'Coffee Mug' });

    await userEvent.click(screen.getByRole('button', { name: 'Books' }));
    expect(productNames()).toEqual(['Clean Code']);
    expect(screen.getByRole('button', { name: 'Books' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await userEvent.type(screen.getByLabelText('Search products'), '  CERAMIC ');
    expect(productNames()).toEqual(['Coffee Mug']);

    await userEvent.clear(screen.getByLabelText('Search products'));
    await userEvent.type(screen.getByLabelText('Search products'), 'nothing like this');
    expect(screen.getByText('No products match your search.')).toBeInTheDocument();
  });

  it('places an order from the cart and shows the confirmation', async () => {
    const getProducts = vi.spyOn(api, 'getProducts').mockResolvedValue(products);
    vi.spyOn(api, 'placeOrder').mockResolvedValue({
      id: 7,
      customerName: 'Ada',
      customerEmail: 'ada@example.com',
      total: 80.09,
      items: [
        { productId: 1, productName: 'Mechanical Keyboard', quantity: 1, lineTotal: 79.99 },
        { productId: 2, productName: 'Coffee Mug', quantity: 1, lineTotal: 0.1 },
      ],
    });
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Add Mechanical Keyboard to cart' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Coffee Mug to cart' }));

    await userEvent.click(screen.getByRole('button', { name: 'Open cart, 2 items' }));
    await userEvent.click(within(cartDrawer()).getByRole('button', { name: 'Checkout' }));
    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Full name'), 'Ada');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Place order · $80.09' }));

    expect(await screen.findByRole('heading', { name: 'Thank you, Ada!' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open cart, 0 items' })).toBeInTheDocument();
    expect(getProducts).toHaveBeenCalledTimes(2); // stock refreshed after the order

    await userEvent.click(screen.getByRole('button', { name: 'Continue shopping' }));
    expect(await screen.findByRole('heading', { name: 'Coffee Mug' })).toBeInTheDocument();
  });

  it('updates a saved cart with the latest prices from the server', async () => {
    localStorage.setItem('shoplite-cart', JSON.stringify([{ product: { ...mug, price: 5 }, quantity: 2 }]));
    vi.spyOn(api, 'getProducts').mockResolvedValue([keyboard, mug]);
    render(<App />);
    await screen.findByRole('heading', { name: 'Coffee Mug' });

    await userEvent.click(screen.getByRole('button', { name: 'Open cart, 2 items' }));
    expect(within(cartDrawer()).getByText('Subtotal (2 items)').nextSibling).toHaveTextContent('$0.20');
  });
});
