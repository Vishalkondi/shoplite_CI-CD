export default function Header({ itemCount, view, onNavigate, onCartClick }) {
  return (
    <header className="header">
      <div className="container header__inner">
        <button className="logo" onClick={() => onNavigate('shop')}>
          <span aria-hidden="true">🛍️</span> ShopLite
        </button>

        <nav className="nav" aria-label="Main">
          <button
            className={`nav__link ${view === 'shop' ? 'nav__link--active' : ''}`}
            onClick={() => onNavigate('shop')}
            aria-current={view === 'shop' ? 'page' : undefined}
          >
            Shop
          </button>
          <button
            className={`nav__link ${view === 'checkout' ? 'nav__link--active' : ''}`}
            onClick={() => onNavigate('checkout')}
            aria-current={view === 'checkout' ? 'page' : undefined}
          >
            Checkout
          </button>
          <button className="cart-button" onClick={onCartClick} aria-label={`Open cart, ${itemCount} items`}>
            <span aria-hidden="true">🛒</span>
            <span className="cart-button__label">Cart</span>
            {itemCount > 0 && <span className="badge">{itemCount}</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}
