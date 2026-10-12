const { Router } = require('express');
const { AppError } = require('../errors');
const { validateOrderInput } = require('../services/orderService');
const { parseId } = require('./params');

function ordersRouter({ orderRepository }) {
  const router = Router();

  // POST /api/orders  { customerName, customerEmail, items: [{ productId, quantity }] }
  router.post('/', async (req, res) => {
    const result = validateOrderInput(req.body);
    if (!result.valid) {
      throw new AppError(400, 'Invalid order', result.errors);
    }
    const order = await orderRepository.create(result.value);
    res.status(201).location(`/api/orders/${order.id}`).json(order);
  });

  // GET /api/orders  (most recent first)
  router.get('/', async (req, res) => {
    const orders = await orderRepository.findAll();
    res.json(orders);
  });

  // GET /api/orders/:id
  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const order = await orderRepository.findById(id);
    if (!order) {
      throw new AppError(404, `Order ${id} not found`);
    }
    res.json(order);
  });

  return router;
}

module.exports = ordersRouter;
