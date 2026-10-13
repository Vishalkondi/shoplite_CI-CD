import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Checkout from '../../src/components/Checkout.jsx';
import Confirmation from '../../src/components/Confirmation.jsx';
import { api, ApiError } from '../../src/api/client.js';
import { keyboard, mug } from '../fixtures.js';

const cart = {
  lines: [
    { product: keyboard, quantity: 1 },
    { product: mug, quantity: 2 },
  ],
  subtotal: 80.19,
};

async function fillForm() {
  await userEvent.type(screen.getByLabelText('Full name'), 'Ada Lovelace');
  await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
}

describe('Checkout', () => {
  it('shows an empty state with a way back to the shop', async () => {
    const onBack = vi.fn();
    render(<Checkout cart={{ lines: [], subtotal: 0 }} onBack={onBack} onOrderPlaced={() => {}} />);
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to shop' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('sends the form and cart items to the API, then reports the placed order', async () => {
    const order = { id: 42 };
    const placeOrder = vi.spyOn(api, 'placeOrder').mockResolvedValue(order);
    const onOrderPlaced = vi.fn();
    render(<Checkout cart={cart} onBack={() => {}} onOrderPlaced={onOrderPlaced} />);

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Place order · $80.19' }));

    expect(placeOrder).toHaveBeenCalledWith({
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
      items: [
        { productId: keyboard.id, quantity: 1 },
        { productId: mug.id, quantity: 2 },
      ],
    });
    expect(onOrderPlaced).toHaveBeenCalledWith(order);
  });

  it('disables the buttons while the order is being placed', async () => {
    let finish;
    vi.spyOn(api, 'placeOrder').mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<Checkout cart={cart} onBack={() => {}} onOrderPlaced={() => {}} />);

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /Place order/ }));
    expect(screen.getByRole('button', { name: 'Placing order...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();

    finish({ id: 1 });
    expect(await screen.findByRole('button', { name: /Place order/ })).toBeEnabled();
  });

  it('shows the server error and its details, and keeps the form filled in', async () => {
    vi.spyOn(api, 'placeOrder').mockRejectedValue(
      new ApiError('Not enough stock', 409, ['Mechanical Keyboard: only 0 left'])
    );
    const onOrderPlaced = vi.fn();
    render(<Checkout cart={cart} onBack={() => {}} onOrderPlaced={onOrderPlaced} />);

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /Place order/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Not enough stock');
    expect(alert).toHaveTextContent('Mechanical Keyboard: only 0 left');
    expect(screen.getByLabelText('Full name')).toHaveValue('Ada Lovelace');
    expect(onOrderPlaced).not.toHaveBeenCalled();
  });
});

describe('Confirmation', () => {
  it('shows the order ID, items and total', async () => {
    const onContinue = vi.fn();
    const order = {
      id: 42,
      customerName: 'Ada',
      customerEmail: 'ada@example.com',
      total: 80.19,
      items: [
        { productId: 1, productName: 'Mechanical Keyboard', quantity: 1, lineTotal: 79.99 },
        { productId: 2, productName: 'Coffee Mug', quantity: 2, lineTotal: 0.2 },
      ],
    };
    render(<Confirmation order={order} onContinue={onContinue} />);

    expect(screen.getByRole('heading', { name: 'Thank you, Ada!' })).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Coffee Mug × 2')).toBeInTheDocument();
    expect(screen.getByText('$80.19')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue shopping' }));
    expect(onContinue).toHaveBeenCalled();
  });
});
