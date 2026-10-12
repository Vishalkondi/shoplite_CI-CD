import { formatPrice } from '../format.js';
import ProductImage from './ProductImage.jsx';

function stockLabel(stock) {
  if (stock === 0) return { text: 'Out of stock', tone: 'out' };
  if (stock <= 5) return { text: `Only ${stock} left`, tone: 'low' };
  return { text: `${stock} in stock`, tone: 'ok' };
}

export default function ProductCard({ product, inCart, onAdd }) {
  const soldOut = product.stock === 0;
  const maxedOut = inCart >= product.stock;
  const stock = stockLabel(product.stock);

  return (
    <article className="card">
      <ProductImage product={product} className="card__image" />
      <div className="card__body">
        <div className="card__meta">
          <span className="card__category">{product.category}</span>
          <span className={`stock stock--${stock.tone}`}>{stock.text}</span>
        </div>
        <h2 className="card__title">{product.name}</h2>
        <p className="card__description">{product.description}</p>
        <div className="card__footer">
          <span className="price">{formatPrice(product.price)}</span>
          <button
            className="btn btn--primary"
            onClick={() => onAdd(product)}
            disabled={soldOut || maxedOut}
            aria-label={`Add ${product.name} to cart`}
          >
            {soldOut ? 'Sold out' : maxedOut ? 'Max in cart' : 'Add to cart'}
          </button>
        </div>
        {inCart > 0 && <p className="in-cart">✓ {inCart} in cart</p>}
      </div>
    </article>
  );
}
