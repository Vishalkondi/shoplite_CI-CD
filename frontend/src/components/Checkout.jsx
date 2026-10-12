import { useState } from 'react';
import { api } from '../api/client.js';
import { formatPrice } from '../format.js';

export default function Checkout({ cart, onBack, onOrderPlaced }) {
  const [form, setForm] = useState({ customerName: '', customerEmail: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.placeOrder({
        ...form,
        items: cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      });
      onOrderPlaced(order);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.lines.length === 0) {
    return (
      <section className="panel">
        <h1>Checkout</h1>
        <p className="notice">Your cart is empty.</p>
        <button className="btn" onClick={onBack}>
          Back to shop
        </button>
      </section>
    );
  }

  return (
    <section className="checkout">
      <form className="panel" onSubmit={handleSubmit}>
        <h1>Checkout</h1>
        <label className="field">
          Full name
          <input value={form.customerName} onChange={update('customerName')} required minLength={2} maxLength={100} autoComplete="name" />
        </label>
        <label className="field">
          Email
          <input type="email" value={form.customerEmail} onChange={update('customerEmail')} required autoComplete="email" />
        </label>
        <p className="muted small">Demo store: no payment is taken.</p>

        {error && (
          <div className="notice notice--error" role="alert">
            <p>{error.message}</p>
            {error.details?.length > 0 && (
              <ul>
                {error.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="actions">
          <button type="button" className="btn" onClick={onBack} disabled={submitting}>
            Back
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Placing order...' : `Place order · ${formatPrice(cart.subtotal)}`}
          </button>
        </div>
      </form>

      <aside className="panel">
        <h2>Order summary</h2>
        <ul className="summary-list">
          {cart.lines.map(({ product, quantity }) => (
            <li key={product.id} className="summary-row">
              <span>
                {product.icon} {product.name} × {quantity}
              </span>
              <span>{formatPrice(product.price * quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="summary-row summary-row--total">
          <span>Total</span>
          <strong>{formatPrice(cart.subtotal)}</strong>
        </div>
      </aside>
    </section>
  );
}
