import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cart from '../../src/components/Cart.jsx';
import Header from '../../src/components/Header.jsx';
import QuantityControl from '../../src/components/QuantityControl.jsx';
import { keyboard, mug } from '../fixtures.js';

function fakeCart(lines) {
  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0),
    setQuantity: vi.fn(),
    remove: vi.fn(),
  };
}

describe('Cart drawer', () => {
  it('shows an empty message', () => {
    render(<Cart open cart={fakeCart([])} onClose={() => {}} onCheckout={() => {}} />);
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  });

  it('lists lines with totals and wires up the buttons', async () => {
    const cart = fakeCart([{ product: keyboard, quantity: 2 }]);
    const onCheckout = vi.fn();
    render(<Cart open cart={cart} onClose={() => {}} onCheckout={onCheckout} />);

    expect(screen.getByText('Subtotal (2 items)')).toBeInTheDocument();
    expect(screen.getAllByText('$159.98')).toHaveLength(2); // line total and subtotal

    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(cart.setQuantity).toHaveBeenCalledWith(keyboard.id, 3);

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(cart.remove).toHaveBeenCalledWith(keyboard.id);

    await userEvent.click(screen.getByRole('button', { name: 'Checkout' }));
    expect(onCheckout).toHaveBeenCalled();
  });

  it('says "item" for a single item', () => {
    render(<Cart open cart={fakeCart([{ product: mug, quantity: 1 }])} onClose={() => {}} onCheckout={() => {}} />);
    expect(screen.getByText('Subtotal (1 item)')).toBeInTheDocument();
  });

  it('closes with the close button and with Escape, but only listens for Escape while open', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Cart open cart={fakeCart([])} onClose={onClose} onCheckout={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Close cart' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(<Cart open={false} cart={fakeCart([])} onClose={onClose} onCheckout={() => {}} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('QuantityControl', () => {
  it('decreases, and disables + at the maximum', async () => {
    const onChange = vi.fn();
    render(<QuantityControl quantity={3} max={3} onChange={onChange} label="Keyboard" />);
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe('Header', () => {
  it('shows the item count and navigates', async () => {
    const onNavigate = vi.fn();
    const onCartClick = vi.fn();
    render(<Header itemCount={3} view="checkout" onNavigate={onNavigate} onCartClick={onCartClick} />);

    expect(screen.getByRole('button', { name: 'Checkout' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Open cart, 3 items' }));
    expect(onCartClick).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Shop' }));
    expect(onNavigate).toHaveBeenCalledWith('shop');
  });

  it('hides the badge when the cart is empty', () => {
    render(<Header itemCount={0} view="shop" onNavigate={() => {}} onCartClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Open cart, 0 items' })).not.toHaveTextContent('0');
  });
});
