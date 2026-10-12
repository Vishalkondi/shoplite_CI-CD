import ProductCard from './ProductCard.jsx';

export default function ProductList({ products, cartLines, onAdd }) {
  if (products.length === 0) {
    return <p className="notice">No products match your search.</p>;
  }

  return (
    <section className="grid" aria-label="Products">
      {products.map((product) => {
        const inCart = cartLines.find((l) => l.product.id === product.id)?.quantity || 0;
        return <ProductCard key={product.id} product={product} inCart={inCart} onAdd={onAdd} />;
      })}
    </section>
  );
}
