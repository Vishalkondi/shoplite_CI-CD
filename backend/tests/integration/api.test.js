// API integration tests: real Express app + real HTTP (via Supertest),
// with the database layer replaced by Jest mocks. These run anywhere,
// no PostgreSQL required.
const request = require('supertest');
const { createApp } = require('../../src/app');
const { AppError } = require('../../src/errors');

const sampleProducts = [
  { id: 1, name: 'Coffee Mug', description: 'Ceramic', price: 12.5, icon: '☕', category: 'Home', stock: 100 },
  { id: 2, name: 'Backpack', description: '25L', price: 39.99, icon: '🎒', category: 'Fashion', stock: 40 },
];

function buildApp(overrides = {}) {
  const deps = {
    productRepository: {
      findAll: jest.fn().mockResolvedValue(sampleProducts),
      findById: jest.fn(async (id) => sampleProducts.find((p) => p.id === id) || null),
    },
    orderRepository: {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
    },
    checkDatabase: jest.fn().mockResolvedValue(),
    logRequests: false,
    ...overrides,
  };
  return { app: createApp(deps), deps };
}

// Mimics the error object Node/pg produce when the DB host refuses a connection.
function connectionError(message) {
  const err = new Error(message);
  err.code = 'ECONNREFUSED';
  return err;
}

const validOrder = {
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  items: [{ productId: 1, quantity: 2 }],
};

describe('Health endpoints', () => {
  test('GET /api/health returns ok', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  test('GET /api/health/ready returns 200 when the database responds', async () => {
    const { app, deps } = buildApp();
    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', database: 'up' });
    expect(deps.checkDatabase).toHaveBeenCalledTimes(1);
  });

  test('GET /api/health/ready returns 503 without leaking connection details when the database is down', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = buildApp({
      checkDatabase: jest.fn().mockRejectedValue(connectionError('connect ECONNREFUSED 10.0.0.5:5432')),
    });
    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not ready', database: 'down' });
    expect(JSON.stringify(res.body)).not.toMatch(/10\.0\.0\.5/);
    consoleError.mockRestore();
  });
});

describe('Database unavailable', () => {
  let consoleError;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  const UNAVAILABLE = { error: 'Service temporarily unavailable. Please try again shortly.' };

  test('GET /api/products returns 503 when the database refuses connections', async () => {
    const { app } = buildApp({
      productRepository: { findAll: jest.fn().mockRejectedValue(connectionError('connect ECONNREFUSED 127.0.0.1:5432')) },
    });
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(503);
    expect(res.body).toEqual(UNAVAILABLE);
  });

  test('POST /api/orders returns 503 when PostgreSQL is shutting down (SQLSTATE 57P01)', async () => {
    const { app, deps } = buildApp();
    const err = new Error('terminating connection due to administrator command');
    err.code = '57P01';
    deps.orderRepository.create.mockRejectedValue(err);

    const res = await request(app).post('/api/orders').send(validOrder);

    expect(res.status).toBe(503);
    expect(res.body).toEqual(UNAVAILABLE);
  });

  test('GET /api/orders/:id returns 503 when the connection is terminated mid-request', async () => {
    const { app, deps } = buildApp();
    deps.orderRepository.findById.mockRejectedValue(new Error('Connection terminated unexpectedly'));

    const res = await request(app).get('/api/orders/1');

    expect(res.status).toBe(503);
  });
});

describe('Products API', () => {
  test('GET /api/products lists products as JSON', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual(sampleProducts);
  });

  test('GET /api/products?category= passes the filter to the repository', async () => {
    const { app, deps } = buildApp();
    await request(app).get('/api/products?category=Home');

    expect(deps.productRepository.findAll).toHaveBeenCalledWith({ category: 'Home' });
  });

  test.each([
    ['repeated parameter', '/api/products?category=Home&category=Books'],
    ['empty value', '/api/products?category='],
    ['value over 60 characters', `/api/products?category=${'x'.repeat(61)}`],
  ])('GET /api/products returns 400 for an invalid category (%s)', async (_label, url) => {
    const { app, deps } = buildApp();
    const res = await request(app).get(url);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/);
    expect(deps.productRepository.findAll).not.toHaveBeenCalled();
  });

  test('GET /api/products/:id returns one product', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/products/2');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Backpack');
  });

  test('GET /api/products/:id returns 404 for an unknown product', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/products/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Product 999 not found');
  });

  test('GET /api/products/:id returns 400 for a non-numeric id', async () => {
    const { app, deps } = buildApp();
    const res = await request(app).get('/api/products/abc');

    expect(res.status).toBe(400);
    expect(deps.productRepository.findById).not.toHaveBeenCalled();
  });

  test('returns 500 without leaking internals when the repository fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = buildApp({
      productRepository: { findAll: jest.fn().mockRejectedValue(new Error('relation "products" does not exist')) },
    });
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toMatch(/relation/);
    consoleError.mockRestore();
  });
});

describe('Orders API', () => {
  test('POST /api/orders creates an order and returns 201', async () => {
    const created = { id: 7, ...validOrder, total: 25, status: 'placed', items: [] };
    const { app, deps } = buildApp();
    deps.orderRepository.create.mockResolvedValue(created);

    const res = await request(app).post('/api/orders').send(validOrder);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/orders/7');
    expect(res.body).toEqual(created);
    expect(deps.orderRepository.create).toHaveBeenCalledWith(validOrder);
  });

  test('POST /api/orders returns 400 with details for invalid input', async () => {
    const { app, deps } = buildApp();
    const res = await request(app)
      .post('/api/orders')
      .send({ customerName: '', customerEmail: 'nope', items: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid order');
    expect(res.body.details).toHaveLength(3);
    expect(deps.orderRepository.create).not.toHaveBeenCalled();
  });

  test('POST /api/orders returns 400 for malformed JSON', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send('{"customerName": ');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Request body is not valid JSON');
  });

  test('POST /api/orders passes through a 409 stock error from the repository', async () => {
    const { app, deps } = buildApp();
    deps.orderRepository.create.mockRejectedValue(
      new AppError(409, 'Insufficient stock', ["Only 1 left of 'Coffee Mug'"])
    );

    const res = await request(app).post('/api/orders').send(validOrder);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Insufficient stock', details: ["Only 1 left of 'Coffee Mug'"] });
  });

  test('GET /api/orders lists orders', async () => {
    const { app, deps } = buildApp();
    deps.orderRepository.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('GET /api/orders/:id returns the order', async () => {
    const { app, deps } = buildApp();
    deps.orderRepository.findById.mockResolvedValue({ id: 5, total: 25, items: [] });

    const res = await request(app).get('/api/orders/5');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 5, total: 25, items: [] });
    expect(deps.orderRepository.findById).toHaveBeenCalledWith(5);
  });

  test('GET /api/orders/:id returns 400 for an invalid id', async () => {
    const { app, deps } = buildApp();
    const res = await request(app).get('/api/orders/-3');

    expect(res.status).toBe(400);
    expect(deps.orderRepository.findById).not.toHaveBeenCalled();
  });

  test('GET /api/orders/:id returns 404 for an unknown order', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/orders/123');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order 123 not found');
  });
});

describe('Middleware', () => {
  test('logs one line per request with method, path, status and duration', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { app } = buildApp({ logRequests: true });

    await request(app).get('/api/health');

    expect(consoleLog).toHaveBeenCalledWith(expect.stringMatching(/^GET \/api\/health 200 \d+\.\dms$/));
    consoleLog.mockRestore();
  });

  test('sends CORS headers only for allowed origins', async () => {
    const { app } = buildApp({ corsOrigin: 'http://localhost:3000, http://localhost:5173' });

    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const blocked = await request(app).get('/api/health').set('Origin', 'http://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('does not advertise the Express version', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Unknown routes', () => {
  test('return 404 JSON', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route GET /api/does-not-exist not found');
  });
});
