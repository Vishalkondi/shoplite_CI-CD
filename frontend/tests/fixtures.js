// Sample products shaped like the GET /api/products response.
export const keyboard = {
  id: 1,
  name: 'Mechanical Keyboard',
  description: 'Tactile switches and RGB lighting',
  category: 'Electronics',
  price: 79.99,
  stock: 3,
  icon: '⌨️',
  imageUrl: '/images/products/mechanical-keyboard.svg',
};

export const mug = {
  id: 2,
  name: 'Coffee Mug',
  description: 'Ceramic, 350 ml',
  category: 'Home',
  price: 0.1,
  stock: 10,
  icon: '☕',
  imageUrl: '/images/products/coffee-mug.svg',
};

export const book = {
  id: 3,
  name: 'Clean Code',
  description: 'A handbook of agile software craftsmanship',
  category: 'Books',
  price: 0.2,
  stock: 0,
  icon: '📘',
  imageUrl: null,
};

export const products = [keyboard, mug, book];
