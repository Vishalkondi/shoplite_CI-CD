-- Database schema and sample data for ShopLite.
--
-- The official postgres Docker image runs every *.sql file in
-- /docker-entrypoint-initdb.d the FIRST time the data volume is created.
-- You can also run it yourself with `npm run db:init` (in backend/).
--
-- The script is safe to run more than once: tables are only created if
-- missing, and sample products are only inserted into an empty table.

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120)  NOT NULL UNIQUE,
  description TEXT          NOT NULL DEFAULT '',
  -- NUMERIC is an exact decimal type: 0.10 + 0.20 is exactly 0.30.
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  icon        VARCHAR(16)   NOT NULL DEFAULT '📦',
  image_url   VARCHAR(255)  NOT NULL DEFAULT '',
  category    VARCHAR(60)   NOT NULL,
  -- The CHECK makes negative stock impossible, even if application code has a bug.
  stock       INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Upgrades a database created by an older version of this script.
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(255) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  customer_name  VARCHAR(100)  NOT NULL,
  customer_email VARCHAR(255)  NOT NULL,
  total          NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  status         VARCHAR(20)   NOT NULL DEFAULT 'placed',
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER       NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER       NOT NULL REFERENCES products(id),
  quantity    INTEGER       NOT NULL CHECK (quantity > 0),
  -- Price is copied at purchase time so later price changes don't alter old orders.
  unit_price  NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  UNIQUE (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product  ON order_items(product_id);

-- ---------------------------------------------------------------------------
-- Sample data. Images live in frontend/public/images/products/.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS pg_temp.seed_products;
CREATE TEMP TABLE seed_products (
  name TEXT, description TEXT, price NUMERIC(10,2), icon TEXT, image_url TEXT, category TEXT, stock INTEGER
);

INSERT INTO seed_products VALUES
  ('Wireless Headphones', 'Over-ear Bluetooth headphones with 30h battery life.', 79.99, '🎧', '/images/products/wireless-headphones.svg', 'Electronics', 25),
  ('Mechanical Keyboard', 'Compact 75% keyboard with hot-swappable switches.',     89.50, '⌨️', '/images/products/mechanical-keyboard.svg', 'Electronics', 15),
  ('Smart Watch',         'Fitness tracking, heart-rate monitor and GPS.',         149.00, '⌚', '/images/products/smart-watch.svg',         'Electronics', 10),
  ('Running Shoes',       'Lightweight, breathable shoes for daily training.',      64.95, '👟', '/images/products/running-shoes.svg',       'Fashion',     30),
  ('Denim Jacket',        'Classic fit jacket in washed blue denim.',               54.00, '🧥', '/images/products/denim-jacket.svg',        'Fashion',     12),
  ('Backpack',            'Water-resistant 25L backpack with laptop sleeve.',       39.99, '🎒', '/images/products/backpack.svg',            'Fashion',     40),
  ('Coffee Mug',          'Ceramic 350ml mug, dishwasher safe.',                    12.50, '☕', '/images/products/coffee-mug.svg',          'Home',       100),
  ('Desk Plant',          'Low-maintenance succulent in a concrete pot.',           18.00, '🪴', '/images/products/desk-plant.svg',          'Home',        20),
  ('Scented Candle',      'Soy wax candle, 40h burn time, vanilla scent.',          15.75, '🕯️', '/images/products/scented-candle.svg',      'Home',        35),
  ('Learning DevOps',     'Paperback guide to CI/CD, containers and the cloud.',    32.00, '📘', '/images/products/learning-devops.svg',     'Books',       50),
  ('Clean Code',          'A handbook of agile software craftsmanship.',            37.49, '📗', '/images/products/clean-code.svg',          'Books',       18),
  ('Yoga Mat',            'Non-slip 6mm mat with carrying strap.',                  27.99, '🧘', '/images/products/yoga-mat.svg',            'Sports',       3);

-- Insert sample products only into an empty table (first run).
INSERT INTO products (name, description, price, icon, image_url, category, stock)
SELECT name, description, price, icon, image_url, category, stock
FROM seed_products
WHERE NOT EXISTS (SELECT 1 FROM products);

-- Fill in images for products created before the image_url column existed.
UPDATE products p
SET image_url = s.image_url
FROM seed_products s
WHERE p.name = s.name AND p.image_url = '';

DROP TABLE pg_temp.seed_products;
