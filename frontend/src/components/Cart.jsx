import { useEffect } from 'react';
import { formatPrice } from '../format.js';
import QuantityControl from './QuantityControl.jsx';
import ProductImage from './ProductImage.jsx';

// Slide-in cart panel.
export default function Cart({ open, cart, onClose, onCheckout }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`overlay ${open ? 'overlay--visible' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drawer ${open ? 'drawer--open' : ''}`} aria-label="Shopping cart" aria-hidden={!open}>
        <div className="drawer__header">
          <h2>Your cart</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close cart">
            ✕
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <p className="notice">Your cart is empty.</p>
        ) : (
          <>
            <ul className="cart-lines">
              {cart.lines.map(({ product, quantity }) => (
                <li key={product.id} className="cart-line">
                  <ProductImage product={product} className="cart-line__image" />
                  <div className="cart-line__info">
                    <strong>{product.name}</strong>
                    <span className="muted">{formatPrice(product.price)} each</span>
                    <QuantityControl
                      quantity={quantity}
                      max={product.stock}
                      onChange={(q) => cart.setQuantity(product.id, q)}
                      label={product.name}
                    />
                  </div>
                  <div className="cart-line__right">
                    <strong>{formatPrice(product.price * quantity)}</strong>
                    <button className="link-button" onClick={() => cart.remove(product.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="drawer__footer">
              <div className="summary-row">
                <span>
                  Subtotal ({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'})
                </span>
                <strong>{formatPrice(cart.subtotal)}</strong>
              </div>
              <button className="btn btn--primary btn--block" onClick={onCheckout}>
                Checkout
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
