// Pure business logic for orders. No database or HTTP code lives here,
// which makes these functions easy to unit test.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_QUANTITY_PER_ITEM = 99;

/**
 * Validates the body of POST /api/orders.
 * Returns { valid: true, value } with a normalised order, or
 * { valid: false, errors } with a list of human-readable problems.
 */
function validateOrderInput(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';

  if (customerName.length < 2 || customerName.length > 100) {
    errors.push('customerName must be between 2 and 100 characters');
  }
  if (!EMAIL_PATTERN.test(customerEmail)) {
    errors.push('customerEmail must be a valid email address');
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('items must be a non-empty array');
    return { valid: false, errors };
  }

  // Merge duplicate product lines so { id: 1, qty: 1 } twice becomes qty 2.
  const quantities = new Map();
  body.items.forEach((item, index) => {
    const productId = Number(item && item.productId);
    const quantity = Number(item && item.quantity);

    if (!Number.isInteger(productId) || productId <= 0) {
      errors.push(`items[${index}].productId must be a positive integer`);
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
      errors.push(`items[${index}].quantity must be an integer between 1 and ${MAX_QUANTITY_PER_ITEM}`);
      return;
    }
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  });

  for (const [productId, quantity] of quantities) {
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      errors.push(`Total quantity for product ${productId} cannot exceed ${MAX_QUANTITY_PER_ITEM}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      customerName,
      customerEmail,
      items: [...quantities].map(([productId, quantity]) => ({ productId, quantity })),
    },
  };
}

/**
 * Calculates line totals and the order total.
 * Money is handled in integer cents to avoid floating-point rounding errors
 * (0.1 + 0.2 !== 0.3 in JavaScript).
 *
 * @param {Array<{productId:number, quantity:number}>} items
 * @param {Map<number, {price:number}>} productsById
 */
function calculateTotals(items, productsById) {
  let totalCents = 0;

  const lines = items.map(({ productId, quantity }) => {
    const product = productsById.get(productId);
    if (!product) {
      throw new Error(`Unknown product ${productId}`);
    }
    const unitCents = Math.round(Number(product.price) * 100);
    const lineCents = unitCents * quantity;
    totalCents += lineCents;
    return {
      productId,
      quantity,
      unitPrice: unitCents / 100,
      lineTotal: lineCents / 100,
    };
  });

  return { lines, total: totalCents / 100 };
}

/**
 * Returns a list of stock problems, e.g. ["Only 2 left of 'Mug'"].
 * An empty list means every item can be fulfilled.
 */
function findStockProblems(items, productsById) {
  const problems = [];
  for (const { productId, quantity } of items) {
    const product = productsById.get(productId);
    if (!product) {
      problems.push(`Product ${productId} does not exist`);
    } else if (product.stock < quantity) {
      problems.push(`Only ${product.stock} left of '${product.name}'`);
    }
  }
  return problems;
}

module.exports = {
  validateOrderInput,
  calculateTotals,
  findStockProblems,
  MAX_QUANTITY_PER_ITEM,
};
