// All SQL for the products table lives here.
// pg returns NUMERIC columns as strings, so we convert price to a number.

function toProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    icon: row.icon,
    imageUrl: row.image_url,
    category: row.category,
    stock: row.stock,
  };
}

function createProductRepository(pool) {
  return {
    async findAll({ category } = {}) {
      const params = [];
      let sql = `SELECT id, name, description, price, icon, image_url, category, stock
                 FROM products`;
      if (category) {
        params.push(category);
        sql += ' WHERE category = $1';
      }
      sql += ' ORDER BY id';
      const { rows } = await pool.query(sql, params);
      return rows.map(toProduct);
    },

    async findById(id) {
      const { rows } = await pool.query(
        `SELECT id, name, description, price, icon, image_url, category, stock
         FROM products WHERE id = $1`,
        [id]
      );
      return rows[0] ? toProduct(rows[0]) : null;
    },
  };
}

module.exports = { createProductRepository, toProduct };
