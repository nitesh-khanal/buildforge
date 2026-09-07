import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useCompare } from '../context/CompareContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_LABELS } from '../utils/specs';
import SearchBar from './SearchBar';
import NotificationBell from './NotificationBell';

const CATEGORIES = Object.entries(CATEGORY_LABELS);

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <Link to="/login" className="px-3 py-2 text-sm text-muted hover:text-ink rounded transition-colors">
        Log in
      </Link>
    );
  }

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate('/');
  }

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted hover:text-ink rounded transition-colors"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="8" r="3.4" />
          <path d="M4.5 20c1.4-3.6 4.4-5.6 7.5-5.6s6.1 2 7.5 5.6" />
        </svg>
        <span className="hidden sm:inline">{user.name?.split(' ')[0] || 'Account'}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-surface border border-border-soft rounded shadow-lg py-1 z-50">
          <Link
            to="/orders"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-muted hover:text-ink hover:bg-raised transition-colors"
          >
            Orders
          </Link>
          <Link
            to="/account/addresses"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-muted hover:text-ink hover:bg-raised transition-colors"
          >
            Addresses
          </Link>
          {user.role === 'admin' && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-muted hover:text-ink hover:bg-raised transition-colors"
            >
              Admin dashboard
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-muted hover:text-ink hover:bg-raised transition-colors"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { count: compareCount, items: compareItems } = useCompare();
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-base/95 backdrop-blur border-b border-border-soft">
      <div className="max-w-content mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-8 h-16">
          <Link to="/" className="font-display font-semibold text-lg text-ink tracking-tight shrink-0">
            Build<span className="text-accent">Forge</span>
          </Link>

          <SearchBar className="flex-1 max-w-xl hidden sm:block" />

          <nav className="ml-auto flex items-center gap-1 shrink-0">
            <NavLink
              to="/shop"
              className={({ isActive }) =>
                `hidden md:inline-block px-3 py-2 text-sm rounded transition-colors ${
                  isActive ? 'text-ink' : 'text-muted hover:text-ink'
                }`
              }
            >
              Shop
            </NavLink>
            <NavLink
              to="/build"
              className={({ isActive }) =>
                `hidden md:inline-block px-3 py-2 text-sm rounded transition-colors ${
                  isActive ? 'text-ink' : 'text-muted hover:text-ink'
                }`
              }
            >
              Build
            </NavLink>
            <NavLink
              to="/community"
              className={({ isActive }) =>
                `hidden md:inline-block px-3 py-2 text-sm rounded transition-colors ${
                  isActive ? 'text-ink' : 'text-muted hover:text-ink'
                }`
              }
            >
              Community
            </NavLink>
            {isAuthenticated && <NotificationBell />}
            <AccountMenu />
            <Link
              to="/wishlist"
              className="relative flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-ink rounded transition-colors"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 20.3s-7.5-4.6-9.8-9.2C.7 7.6 2.4 4 6 4c2 0 3.6 1.1 4.5 2.6C11.4 5.1 13 4 15 4c3.6 0 5.3 3.6 3.8 7.1-2.3 4.6-9.8 9.2-9.8 9.2Z" />
              </svg>
              <span className="hidden sm:inline">Wishlist</span>
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 sm:static sm:ml-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[11px] font-mono flex items-center justify-center text-ink">
                  {wishlistCount}
                </span>
              )}
            </Link>
            {compareCount > 0 && (
              <Link
                to={`/compare?ids=${compareItems.map((i) => i._id).join(',')}`}
                className="relative flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-ink rounded transition-colors"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M9 3v18M15 3v18" />
                  <path d="M5 8h4M15 8h4M5 16h4M15 16h4" />
                </svg>
                <span className="hidden sm:inline">Compare</span>
                <span className="absolute -top-0.5 -right-0.5 sm:static sm:ml-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[11px] font-mono flex items-center justify-center text-ink">
                  {compareCount}
                </span>
              </Link>
            )}
            <Link
              to="/cart"
              className="relative flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-ink rounded transition-colors"
            >
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.6L21 8H6" />
                <circle cx="9.5" cy="20.5" r="1.3" />
                <circle cx="17" cy="20.5" r="1.3" />
              </svg>
              <span className="hidden sm:inline">Cart</span>
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 sm:static sm:ml-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[11px] font-mono flex items-center justify-center text-ink">
                  {itemCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
        <div className="sm:hidden pb-3">
          <SearchBar />
        </div>
      </div>

      <div className="border-t border-border-soft overflow-x-auto scrollbar-none">
        <div className="max-w-content mx-auto px-4 sm:px-6 flex items-center gap-1 h-10 whitespace-nowrap">
          {CATEGORIES.map(([slug, label]) => (
            <NavLink
              key={slug}
              to={`/shop?category=${slug}`}
              className={({ isActive }) =>
                `text-xs font-mono px-2.5 py-1 rounded transition-colors ${
                  isActive ? 'text-accent' : 'text-faint hover:text-muted'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  );
}
