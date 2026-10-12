import { formatPrice } from '../format.js';

export default function Confirmation({ order, onContinue }) {
  return (
    <section className="panel confirmation" aria-labelledby="confirmation-title">
      <div className="confirmation__icon" aria-hidden="true">
        ✅
      </div>
      <h1 id="confirmation-title">Thank you, {order.customerName}!</h1>
      <p className="order-id">
        Order ID <strong>#{order.id}</strong>
      </p>
      <p className="muted">
        Your order has been placed. Confirmation details are linked to <strong>{order.customerEmail}</strong>.
      </p>
      <ul className="summary-list">
        {order.items.map((item) => (
          <li key={item.productId} className="summary-row">
            <span>
              {item.productName} × {item.quantity}
            </span>
            <span>{formatPrice(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <div className="summary-row summary-row--total">
        <span>Order total</span>
        <strong>{formatPrice(order.total)}</strong>
      </div>
      <p className="muted small">This is a demo store: no payment was taken and nothing will be shipped.</p>
      <button className="btn btn--primary" onClick={onContinue}>
        Continue shopping
      </button>
    </section>
  );
}
