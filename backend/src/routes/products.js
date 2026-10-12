const { Router } = require('express');
const { AppError } = require('../errors');
const { parseId } = require('./params');

function productsRouter({ productRepository }) {
  const router = Router();

  // GET /api/products?category=Electronics
  router.get('/', async (req, res) => {
    const { category } = req.query;
    // ?category=a&category=b arrives as an array; reject it and over-long values.
    if (category !== undefined && (typeof category !== 'string' || category.trim() === '' || category.length > 60)) {
      throw new AppError(400, 'category must be a single non-empty value of at most 60 characters');
    }
    const products = await productRepository.findAll({ category });
    res.json(products);
  });

  // GET /api/products/:id
  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError(404, `Product ${id} not found`);
    }
    res.json(product);
  });

  return router;
}

module.exports = productsRouter;
