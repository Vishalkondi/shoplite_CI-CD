import { useState } from 'react';

// Shows the product image, falling back to the product's emoji icon if the
// image is missing or fails to load.
export default function ProductImage({ product, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (!product.imageUrl || failed) {
    return (
      <div className={`product-image product-image--fallback ${className}`} role="img" aria-label={product.name}>
        {product.icon}
      </div>
    );
  }

  return (
    <img
      className={`product-image ${className}`}
      src={product.imageUrl}
      alt={product.name}
      loading="lazy"
      width="400"
      height="250"
      onError={() => setFailed(true)}
    />
  );
}
