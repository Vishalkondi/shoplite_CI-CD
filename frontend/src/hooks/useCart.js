import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'shoplite-cart';

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/**
 * Cart state, persisted to localStorage so it survives a page refresh.
 * Each line is { product, quantity }. Quantities are capped at product stock.
 */
export function useCart() {
  const [lines, setLines] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage can be unavailable (private mode); the cart still works in memory.
    }
  }, [lines]);

  function add(product) {
    setLines((current) => {
      const existing = current.find((l) => l.product.id === product.id);
      if (existing) {
        return current.map((l) =>
          l.product.id === product.id ? { ...l, quantity: Math.min(l.quantity + 1, product.stock) } : l
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function setQuantity(productId, quantity) {
    setLines((current) =>
      current
        .map((l) => (l.product.id === productId ? { ...l, quantity: Math.min(quantity, l.product.stock) } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function remove(productId) {
    setLines((current) => current.filter((l) => l.product.id !== productId));
  }

  function clear() {
    setLines([]);
  }

  // A cart saved in localStorage may hold out-of-date prices or stock.
  // Replace each saved product with the latest server version, cap quantities
  // at the current stock and drop products that no longer exist.
  const syncProducts = useCallback((latestProducts) => {
    const byId = new Map(latestProducts.map((p) => [p.id, p]));
    setLines((current) =>
      current
        .filter((l) => byId.has(l.product.id))
        .map((l) => {
          const product = byId.get(l.product.id);
          return { product, quantity: Math.min(l.quantity, product.stock) };
        })
        .filter((l) => l.quantity > 0)
    );
  }, []);

  const totals = useMemo(() => {
    const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
    // Work in cents to avoid floating-point rounding errors.
    const cents = lines.reduce((sum, l) => sum + Math.round(l.product.price * 100) * l.quantity, 0);
    return { itemCount, subtotal: cents / 100 };
  }, [lines]);

  return { lines, add, setQuantity, remove, clear, syncProducts, ...totals };
}
