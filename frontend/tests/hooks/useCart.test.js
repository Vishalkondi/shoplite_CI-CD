import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCart } from '../../src/hooks/useCart.js';
import { book, keyboard, mug } from '../fixtures.js';

const STORAGE_KEY = 'shoplite-cart';

function renderCart() {
  return renderHook(() => useCart()).result;
}

describe('useCart', () => {
  it('starts empty', () => {
    const cart = renderCart();
    expect(cart.current.lines).toEqual([]);
    expect(cart.current.itemCount).toBe(0);
    expect(cart.current.subtotal).toBe(0);
  });

  it('adds a product, and adding it again increases the quantity', () => {
    const cart = renderCart();
    act(() => cart.current.add(keyboard));
    act(() => cart.current.add(keyboard));
    expect(cart.current.lines).toEqual([{ product: keyboard, quantity: 2 }]);
    expect(cart.current.itemCount).toBe(2);
  });

  it('never adds more than the product stock', () => {
    const cart = renderCart();
    for (let i = 0; i < 5; i++) act(() => cart.current.add(keyboard)); // stock is 3
    expect(cart.current.lines[0].quantity).toBe(3);
  });

  it('calculates the subtotal in exact cents (0.1 + 0.2 = 0.3)', () => {
    const cart = renderCart();
    act(() => cart.current.add(mug)); // 0.10
    act(() => cart.current.add({ ...book, stock: 5 })); // 0.20
    expect(cart.current.subtotal).toBe(0.3);
  });

  it('setQuantity changes a line, caps it at stock and removes it at 0', () => {
    const cart = renderCart();
    act(() => cart.current.add(keyboard));
    act(() => cart.current.add(mug));

    act(() => cart.current.setQuantity(keyboard.id, 99));
    expect(cart.current.lines[0].quantity).toBe(3);

    act(() => cart.current.setQuantity(keyboard.id, 0));
    expect(cart.current.lines).toEqual([{ product: mug, quantity: 1 }]);
  });

  it('remove deletes one line and clear empties the cart', () => {
    const cart = renderCart();
    act(() => cart.current.add(keyboard));
    act(() => cart.current.add(mug));

    act(() => cart.current.remove(mug.id));
    expect(cart.current.lines.map((l) => l.product.id)).toEqual([keyboard.id]);

    act(() => cart.current.clear());
    expect(cart.current.lines).toEqual([]);
  });

  it('saves the cart to localStorage and restores it on the next render', () => {
    const first = renderCart();
    act(() => first.current.add(mug));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([{ product: mug, quantity: 1 }]);

    const second = renderCart();
    expect(second.current.lines).toEqual([{ product: mug, quantity: 1 }]);
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['a non-array value', '{"product":1}'],
  ])('ignores %s in localStorage', (_, saved) => {
    localStorage.setItem(STORAGE_KEY, saved);
    expect(renderCart().current.lines).toEqual([]);
  });

  it('keeps working in memory when localStorage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const cart = renderCart();
    act(() => cart.current.add(mug));
    expect(cart.current.itemCount).toBe(1);
  });

  it('syncProducts updates prices, caps quantities at new stock and drops missing or sold-out products', () => {
    const cart = renderCart();
    act(() => cart.current.add(keyboard));
    act(() => cart.current.add(keyboard));
    act(() => cart.current.add(mug));
    act(() => cart.current.add({ ...book, stock: 5 }));

    act(() =>
      cart.current.syncProducts([
        { ...keyboard, price: 59.99, stock: 1 }, // cheaper, only 1 left
        { ...book, stock: 0 }, // sold out
        // mug no longer exists
      ])
    );

    expect(cart.current.lines).toEqual([{ product: { ...keyboard, price: 59.99, stock: 1 }, quantity: 1 }]);
    expect(cart.current.subtotal).toBe(59.99);
  });
});
