const { withTransaction } = require('../db');
const { AppError } = require('../errors');
const { calculateTotals, findStockProblems } = require('../services/orderService');
const { toProduct } = require('./productRepository');

function toOrder(orderRow, itemRows) {
  return {
    id: orderRow.id,
    customerName: orderRow.customer_name,
    customerEmail: orderRow.customer_email,
    total: Number(orderRow.total),
    status: orderRow.status,
    createdAt: orderRow.created_at,
    items: itemRows.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      // Multiply in integer cents to avoid floating-point errors (0.1 * 3).
      lineTotal: (Math.round(Number(item.unit_price) * 100) * item.quantity) / 100,
    })),
  };
}

const ITEMS_SQL = `
  SELECT oi.order_id, oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE oi.order_id = ANY($1)
  ORDER BY oi.id`;

function createOrderRepository(pool) {
  return {
    /**
     * Creates an order atomically:
     * lock the products -> check stock -> insert order + items -> reduce stock.
     * If any step fails the whole transaction is rolled back.
     */
    async create({ customerName, customerEmail, items }) {
      return withTransaction(pool, async (client) => {
        const ids = items.map((i) => i.productId);

        // FOR UPDATE locks these rows so two simultaneous orders
        // cannot both buy the last item in stock. ORDER BY id makes every
        // transaction lock rows in the same order, which prevents deadlocks.
        const { rows: productRows } = await client.query(
          `SELECT id, name, description, price, icon, image_url, category, stock
           FROM products WHERE id = ANY($1)
           ORDER BY id
           FOR UPDATE`,
          [ids]
        );
        const productsById = new Map(productRows.map((r) => [r.id, toProduct(r)]));

        const missing = ids.filter((id) => !productsById.has(id));
        if (missing.length > 0) {
          throw new AppError(404, 'Some products were not found', missing.map((id) => `Product ${id} does not exist`));
        }

        const stockProblems = findStockProblems(items, productsById);
        if (stockProblems.length > 0) {
          throw new AppError(409, 'Insufficient stock', stockProblems);
        }

        const { lines, total } = calculateTotals(items, productsById);

        const { rows: [orderRow] } = await client.query(
          `INSERT INTO orders (customer_name, customer_email, total)
           VALUES ($1, $2, $3)
           RETURNING id, customer_name, customer_email, total, status, created_at`,
          [customerName, customerEmail, total]
        );

        for (const line of lines) {
          await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
             VALUES ($1, $2, $3, $4)`,
            [orderRow.id, line.productId, line.quantity, line.unitPrice]
          );
          await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [line.quantity, line.productId]);
        }

        const itemRows = lines.map((line) => ({
          product_id: line.productId,
          product_name: productsById.get(line.productId).name,
          quantity: line.quantity,
          unit_price: line.unitPrice,
        }));
        return toOrder(orderRow, itemRows);
      });
    },

    async findById(id) {
      const { rows } = await pool.query(
        `SELECT id, customer_name, customer_email, total, status, created_at
         FROM orders WHERE id = $1`,
        [id]
      );
      if (!rows[0]) return null;
      const { rows: itemRows } = await pool.query(ITEMS_SQL, [[id]]);
      return toOrder(rows[0], itemRows);
    },

    async findAll({ limit = 50 } = {}) {
      const { rows } = await pool.query(
        `SELECT id, customer_name, customer_email, total, status, created_at
         FROM orders ORDER BY id DESC LIMIT $1`,
        [limit]
      );
      if (rows.length === 0) return [];
      const { rows: itemRows } = await pool.query(ITEMS_SQL, [rows.map((r) => r.id)]);
      return rows.map((row) => toOrder(row, itemRows.filter((i) => i.order_id === row.id)));
    },
  };
}

module.exports = { createOrderRepository };
