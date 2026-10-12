// End-to-end API tests against a REAL PostgreSQL database.
//
// Skipped unless TEST_DATABASE_URL is set. The tests DROP and recreate all
// tables, so the database name must end in "_test" as a safety guard.
// CI provides one automatically; locally see README "Running database tests".
const request = require('supertest');
const { createPool } = require('../../src/db');
const { createApp } = require('../../src/app');
const { createProductRepository } = require('../../src/repositories/productRepository');
const { createOrderRepository } = require('../../src/repositories/orderRepository');
const { initDb } = require('../../src/scripts/initDb');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

if (!TEST_DATABASE_URL) {
  // CI sets REQUIRE_TEST_DATABASE so a misconfigured pipeline fails loudly
  // instead of going green without running these tests.
  if (process.env.REQUIRE_TEST_DATABASE === 'true') {
    throw new Error('REQUIRE_TEST_DATABASE is set but TEST_DATABASE_URL is missing.');
  }
  console.warn(
    'SKIPPED: PostgreSQL integration tests (TEST_DATABASE_URL is not set). ' +
      'These tests did NOT run. See README "Database integration tests".'
  );
}

describeIfDb('API with PostgreSQL', () => {
  let pool;
  let app;

  beforeAll(() => {
    const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
    if (!dbName.endsWith('_test')) {
      throw new Error(`Refusing to run destructive tests against database '${dbName}'. Name must end in _test.`);
    }
    pool = createPool({ connectionString: TEST_DATABASE_URL });
    app = createApp({
      productRepository: createProductRepository(pool),
      orderRepository: createOrderRepository(pool),
      checkDatabase: () => pool.query('SELECT 1'),
      logRequests: false,
    });
  });

  // Fresh schema + sample data before every test, so tests are independent.
  beforeEach(async () => {
    await pool.query('DROP TABLE IF EXISTS order_items, orders, products CASCADE');
    await initDb(pool);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  async function stockOf(productId) {
    const { rows } = await pool.query('SELECT stock FROM products WHERE id = $1', [productId]);
    return rows[0].stock;
  }

  test('readiness check reports the database as up', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('up');
  });

  test('seed data is loaded and prices are numbers', async () => {
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);
    expect(res.body[0]).toMatchObject({
      id: 1,
      name: 'Wireless Headphones',
      price: 79.99,
      imageUrl: '/images/products/wireless-headphones.svg',
    });
    expect(typeof res.body[0].price).toBe('number');
    expect(new Set(res.body.map((p) => p.category)).size).toBeGreaterThanOrEqual(4);
  });

  test('init.sql is safe to run again: no duplicate products, existing data kept', async () => {
    await pool.query('UPDATE products SET stock = 7 WHERE id = 1');
    await initDb(pool);

    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products');
    expect(rows[0].n).toBe(12);
    expect(await stockOf(1)).toBe(7);
  });

  test('GET /api/products/:id returns a single product from the database', async () => {
    const res = await request(app).get('/api/products/11');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 11, name: 'Clean Code', price: 37.49, category: 'Books' });

    const missing = await request(app).get('/api/products/9999');
    expect(missing.status).toBe(404);
  });

  test('category filter returns only matching products', async () => {
    const res = await request(app).get('/api/products?category=Books');

    expect(res.body.map((p) => p.name)).toEqual(['Learning DevOps', 'Clean Code']);
  });

  test('placing an order stores it, computes the total and reduces stock', async () => {
    const before = await stockOf(7); // Coffee Mug, 12.50

    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Grace Hopper',
        customerEmail: 'grace@example.com',
        items: [
          { productId: 7, quantity: 3 },
          { productId: 10, quantity: 1 }, // Learning DevOps, 32.00
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(69.5);
    expect(res.body.items).toHaveLength(2);
    expect(await stockOf(7)).toBe(before - 3);

    const fetched = await request(app).get(`/api/orders/${res.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toMatchObject({ id: res.body.id, customerEmail: 'grace@example.com', total: 69.5 });
    expect(fetched.body.items.map((i) => i.productName)).toEqual(['Coffee Mug', 'Learning DevOps']);

    const list = await request(app).get('/api/orders');
    expect(list.body.map((o) => o.id)).toEqual([res.body.id]);
  });

  test('ordering more than the stock returns 409 and changes nothing', async () => {
    // Yoga Mat (id 12) has stock 3. Mug (id 7) is valid, so this also checks
    // that the transaction rolls back the whole order, not just one line.
    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Grace Hopper',
        customerEmail: 'grace@example.com',
        items: [
          { productId: 7, quantity: 1 },
          { productId: 12, quantity: 4 },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.details).toEqual(["Only 3 left of 'Yoga Mat'"]);
    expect(await stockOf(12)).toBe(3);
    expect(await stockOf(7)).toBe(100);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM orders');
    expect(rows[0].n).toBe(0);
  });

  test('duplicate lines for the same product are merged into one order item', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Grace',
        customerEmail: 'g@example.com',
        items: [
          { productId: 9, quantity: 1 }, // Scented Candle, 15.75
          { productId: 9, quantity: 2 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.items).toEqual([
      expect.objectContaining({ productId: 9, quantity: 3, unitPrice: 15.75, lineTotal: 47.25 }),
    ]);
    expect(res.body.total).toBe(47.25);
    expect(await stockOf(9)).toBe(32);
  });

  test('ordering an unknown product returns 404', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ customerName: 'Grace', customerEmail: 'g@example.com', items: [{ productId: 9999, quantity: 1 }] });

    expect(res.status).toBe(404);
    expect(res.body.details).toEqual(['Product 9999 does not exist']);
  });

  test('concurrent orders cannot oversell the last items', async () => {
    // 3 Yoga Mats in stock, 5 customers each try to buy 1 at the same time.
    const attempts = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/api/orders')
        .send({ customerName: `Buyer ${i}`, customerEmail: `b${i}@example.com`, items: [{ productId: 12, quantity: 1 }] })
    );
    const statuses = (await Promise.all(attempts)).map((r) => r.status).sort();

    expect(statuses).toEqual([201, 201, 201, 409, 409]);
    expect(await stockOf(12)).toBe(0);
  });

  test('returns 503 when the database server cannot be reached', async () => {
    // Same credentials, but a port where nothing is listening.
    const url = new URL(TEST_DATABASE_URL);
    url.port = '1';
    const deadPool = createPool({ connectionString: url.toString() });
    const deadApp = createApp({
      productRepository: createProductRepository(deadPool),
      orderRepository: createOrderRepository(deadPool),
      checkDatabase: () => deadPool.query('SELECT 1'),
      logRequests: false,
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const ready = await request(deadApp).get('/api/health/ready');
      expect(ready.status).toBe(503);

      const products = await request(deadApp).get('/api/products');
      expect(products.status).toBe(503);
      expect(products.body.error).toMatch(/temporarily unavailable/);

      const live = await request(deadApp).get('/api/health');
      expect(live.status).toBe(200); // the process itself is still alive
    } finally {
      consoleError.mockRestore();
      await deadPool.end();
    }
  });
});
