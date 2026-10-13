import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductCard from '../../src/components/ProductCard.jsx';
import ProductImage from '../../src/components/ProductImage.jsx';
import ProductList from '../../src/components/ProductList.jsx';
import { book, keyboard, mug } from '../fixtures.js';

describe('ProductCard', () => {
  it('shows the product details and adds it to the cart when clicked', async () => {
    const onAdd = vi.fn();
    render(<ProductCard product={mug} inCart={0} onAdd={onAdd} />);

    expect(screen.getByRole('heading', { name: 'Coffee Mug' })).toBeInTheDocument();
    expect(screen.getByText('$0.10')).toBeInTheDocument();
    expect(screen.getByText('10 in stock')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add Coffee Mug to cart' }));
    expect(onAdd).toHaveBeenCalledWith(mug);
  });

  it.each([
    [keyboard, 0, 'Only 3 left', 'Add to cart', false],
    [keyboard, 3, 'Only 3 left', 'Max in cart', true],
    [book, 0, 'Out of stock', 'Sold out', true],
  ])('%#: stock label and button state', (product, inCart, label, buttonText, disabled) => {
    render(<ProductCard product={product} inCart={inCart} onAdd={() => {}} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: `Add ${product.name} to cart` });
    expect(button).toHaveTextContent(buttonText);
    expect(button.disabled).toBe(disabled);
  });

  it('shows how many are already in the cart', () => {
    render(<ProductCard product={keyboard} inCart={2} onAdd={() => {}} />);
    expect(screen.getByText('✓ 2 in cart')).toBeInTheDocument();
  });
});

describe('ProductImage', () => {
  it('falls back to the emoji icon when there is no image URL', () => {
    render(<ProductImage product={book} />);
    expect(screen.getByRole('img', { name: 'Clean Code' })).toHaveTextContent('📘');
  });

  it('falls back to the emoji icon when the image fails to load', () => {
    render(<ProductImage product={mug} />);
    fireEvent.error(screen.getByRole('img', { name: 'Coffee Mug' }));
    expect(screen.getByRole('img', { name: 'Coffee Mug' })).toHaveTextContent('☕');
  });
});

describe('ProductList', () => {
  it('shows an empty state when nothing matches', () => {
    render(<ProductList products={[]} cartLines={[]} onAdd={() => {}} />);
    expect(screen.getByText('No products match your search.')).toBeInTheDocument();
  });

  it('passes each product its quantity in the cart', () => {
    render(<ProductList products={[keyboard, mug]} cartLines={[{ product: mug, quantity: 4 }]} onAdd={() => {}} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('✓ 4 in cart')).toBeInTheDocument();
  });
});
