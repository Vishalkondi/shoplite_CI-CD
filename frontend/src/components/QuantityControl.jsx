export default function QuantityControl({ quantity, max, onChange, label }) {
  return (
    <div className="qty" role="group" aria-label={`Quantity of ${label}`}>
      <button onClick={() => onChange(quantity - 1)} aria-label="Decrease quantity">
        −
      </button>
      <span aria-live="polite">{quantity}</span>
      <button onClick={() => onChange(quantity + 1)} disabled={quantity >= max} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}
