import { useEffect, useMemo, useState } from 'react';
import { api } from './api/client.js';
import { useCart } from './hooks/useCart.js';
import Header from './components/Header.jsx';
import ProductList from './components/ProductList.jsx';
import Cart from './components/Cart.jsx';
import Checkout from './components/Checkout.jsx';
import Confirmation from './components/Confirmation.jsx';

// Views: 'shop' (browse + cart) -> 'checkout' -> 'confirmation'
export default function App() {
  const cart = useCart();
  const { syncProducts } = cart;
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [view, setView] = useState('shop');
  const [placedOrder, setPlacedOrder] = useState(null);

  async function loadProducts() {
    setStatus('loading');
    try {
      setProducts(await api.getProducts());
      setStatus('ready');
    } catch (err) {
      setLoadError(err.message);
      setStatus('error');
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // Keep the saved cart's prices and stock in line with the latest server data.
  useEffect(() => {
    if (status === 'ready') syncProducts(products);
  }, [products, status, syncProducts]);

  const categories = useMemo(() => ['All', ...new Set(products.map((p) => p.category))], [products]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!term || p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term))
    );
  }, [products, category, search]);

  function navigate(nextView) {
    setView(nextView);
    if (nextView !== 'confirmation') setPlacedOrder(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleOrderPlaced(order) {
    setPlacedOrder(order);
    cart.clear();
    navigate('confirmation');
    loadProducts(); // refresh stock levels
  }

  return (
    <div className="app">
      <Header itemCount={cart.itemCount} view={view} onNavigate={navigate} onCartClick={() => setCartOpen(true)} />

      <main>
        {view === 'shop' && (
          <>
            <section className="hero">
              <div className="container hero__inner">
                <div>
                  <p className="hero__eyebrow">New season · Free returns</p>
                  <h1 className="hero__title">Everyday essentials, delivered by a CI/CD pipeline.</h1>
                  <p className="hero__text">
                    Browse gadgets, clothing, home goods and books. Add a few to your cart and place a demo order —
                    no payment required.
                  </p>
                  <a className="btn btn--primary btn--lg" href="#products">
                    Shop now
                  </a>
                </div>
                <div className="hero__art" aria-hidden="true">
                  <span>🎧</span>
                  <span>👟</span>
                  <span>📘</span>
                  <span>🪴</span>
                </div>
              </div>
            </section>

            <div className="container page" id="products">
              <section className="toolbar" aria-label="Filter products">
                <input
                  type="search"
                  className="search"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search products"
                />
                <div className="chips" role="group" aria-label="Categories">
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={`chip ${c === category ? 'chip--active' : ''}`}
                      onClick={() => setCategory(c)}
                      aria-pressed={c === category}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </section>

              {status === 'loading' && products.length === 0 && (
                <div className="grid" aria-busy="true" aria-label="Loading products">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="card card--skeleton" />
                  ))}
                </div>
              )}
              {status === 'error' && (
                <div className="notice notice--error" role="alert">
                  <p>Could not load products: {loadError}</p>
                  <button className="btn" onClick={loadProducts}>
                    Try again
                  </button>
                </div>
              )}
              {(status === 'ready' || (status === 'loading' && products.length > 0)) && (
                <ProductList products={visibleProducts} cartLines={cart.lines} onAdd={cart.add} />
              )}
            </div>
          </>
        )}

        {view === 'checkout' && (
          <div className="container page">
            <Checkout cart={cart} onBack={() => navigate('shop')} onOrderPlaced={handleOrderPlaced} />
          </div>
        )}

        {view === 'confirmation' && placedOrder && (
          <div className="container page">
            <Confirmation order={placedOrder} onContinue={() => navigate('shop')} />
          </div>
        )}
      </main>

      <Cart
        open={cartOpen}
        cart={cart}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          navigate('checkout');
        }}
      />

      <footer className="footer">ShopLite &middot; demo store for learning CI/CD &middot; no real payments</footer>
    </div>
  );
}
