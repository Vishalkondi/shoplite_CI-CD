const {
  validateOrderInput,
  calculateTotals,
  findStockProblems,
  MAX_QUANTITY_PER_ITEM,
} = require('../../src/services/orderService');

const validOrder = () => ({
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  items: [{ productId: 1, quantity: 2 }],
});

describe('validateOrderInput', () => {
  test('accepts a valid order and normalises name and email', () => {
    const result = validateOrderInput({
      ...validOrder(),
      customerName: '  Ada Lovelace  ',
      customerEmail: ' ADA@Example.COM ',
    });

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
      items: [{ productId: 1, quantity: 2 }],
    });
  });

  test('accepts numeric strings for productId and quantity', () => {
    const result = validateOrderInput({ ...validOrder(), items: [{ productId: '3', quantity: '4' }] });
    expect(result.valid).toBe(true);
    expect(result.value.items).toEqual([{ productId: 3, quantity: 4 }]);
  });

  test('merges duplicate product lines', () => {
    const result = validateOrderInput({
      ...validOrder(),
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
        { productId: 1, quantity: 3 },
      ],
    });
    expect(result.value.items).toEqual([
      { productId: 1, quantity: 5 },
      { productId: 2, quantity: 1 },
    ]);
  });

  test.each([
    [null, 'Request body must be a JSON object'],
    ['a string', 'Request body must be a JSON object'],
  ])('rejects non-object body %p', (body, message) => {
    expect(validateOrderInput(body)).toEqual({ valid: false, errors: [message] });
  });

  test('reports every invalid customer field at once', () => {
    const result = validateOrderInput({ customerName: 'A', customerEmail: 'not-an-email', items: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'customerName must be between 2 and 100 characters',
      'customerEmail must be a valid email address',
      'items must be a non-empty array',
    ]);
  });

  test.each([
    [{ productId: 0, quantity: 1 }, 'items[0].productId must be a positive integer'],
    [{ productId: 1.5, quantity: 1 }, 'items[0].productId must be a positive integer'],
    [{ productId: 'abc', quantity: 1 }, 'items[0].productId must be a positive integer'],
    [{ productId: 1, quantity: 0 }, 'items[0].quantity must be an integer between 1 and 99'],
    [{ productId: 1, quantity: -2 }, 'items[0].quantity must be an integer between 1 and 99'],
    [{ productId: 1, quantity: 100 }, 'items[0].quantity must be an integer between 1 and 99'],
    [null, 'items[0].productId must be a positive integer'],
  ])('rejects invalid item %p', (item, message) => {
    const result = validateOrderInput({ ...validOrder(), items: [item] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(message);
  });

  test('rejects merged quantities above the per-product limit', () => {
    const result = validateOrderInput({
      ...validOrder(),
      items: [
        { productId: 1, quantity: MAX_QUANTITY_PER_ITEM },
        { productId: 1, quantity: 1 },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([`Total quantity for product 1 cannot exceed ${MAX_QUANTITY_PER_ITEM}`]);
  });
});

describe('calculateTotals', () => {
  const products = new Map([
    [1, { name: 'Mug', price: 12.5 }],
    [2, { name: 'Pen', price: 0.1 }],
    [3, { name: 'Ink', price: 0.2 }],
  ]);

  test('computes line totals and the order total', () => {
    const { lines, total } = calculateTotals(
      [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 3 },
      ],
      products
    );
    expect(lines).toEqual([
      { productId: 1, quantity: 2, unitPrice: 12.5, lineTotal: 25 },
      { productId: 2, quantity: 3, unitPrice: 0.1, lineTotal: 0.3 },
    ]);
    expect(total).toBe(25.3);
  });

  test('avoids floating-point rounding errors', () => {
    // In plain JS, 0.1 + 0.2 === 0.30000000000000004
    const { total } = calculateTotals(
      [
        { productId: 2, quantity: 1 },
        { productId: 3, quantity: 1 },
      ],
      products
    );
    expect(total).toBe(0.3);
  });

  test('accepts prices given as strings (as returned by PostgreSQL NUMERIC)', () => {
    const { total } = calculateTotals([{ productId: 9, quantity: 3 }], new Map([[9, { price: '19.99' }]]));
    expect(total).toBe(59.97);
  });

  test('throws for an unknown product', () => {
    expect(() => calculateTotals([{ productId: 42, quantity: 1 }], products)).toThrow('Unknown product 42');
  });
});

describe('findStockProblems', () => {
  const products = new Map([
    [1, { name: 'Mug', stock: 5 }],
    [2, { name: 'Yoga Mat', stock: 0 }],
  ]);

  test('returns an empty list when everything is in stock', () => {
    expect(findStockProblems([{ productId: 1, quantity: 5 }], products)).toEqual([]);
  });

  test('reports insufficient stock and missing products', () => {
    expect(
      findStockProblems(
        [
          { productId: 1, quantity: 6 },
          { productId: 2, quantity: 1 },
          { productId: 3, quantity: 1 },
        ],
        products
      )
    ).toEqual(["Only 5 left of 'Mug'", "Only 0 left of 'Yoga Mat'", 'Product 3 does not exist']);
  });
});
