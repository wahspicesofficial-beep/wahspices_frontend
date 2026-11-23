import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Heart, User, Search, Menu, X, ChevronDown } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleDrawer } from '@/store/slices/cartSlice';
import { fetchCategories } from '@/store/slices/productSlice';
import { useSiteContent, isInternal } from '@/content/useSiteContent';
import { safeHref } from '@/utils/safeUrl';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownTimeout = useRef(null);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const cartItems = useAppSelector((s) => s.cart.items);
  const wishlistItems = useAppSelector((s) => s.wishlist.items);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const user = useAppSelector((s) => s.auth.user);
  const categories = useAppSelector((s) => s.products.categories);
  const { block, settings, tel } = useSiteContent();
  const header = block('header');
  const staticNav = header.navLinks;

  useEffect(() => {
    if (categories.length === 0) dispatch(fetchCategories());
  }, [dispatch, categories.length]);

  // Build nav dynamically
  const navLinks = useMemo(() => [
    { label: 'Home', path: '/' },
    {
      label: 'Products',
      path: '/products',
      children: [
        { label: 'All Products', path: '/products', icon: '🌿' },
        ...categories
          .filter((c) => !c.parentId)
          .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
          .map((c) => ({
          label: c.name,
          path: `/products?category=${c.slug}`,
          icon: c.icon || '',
        })),
      ],
    },
    ...(Array.isArray(staticNav) ? staticNav : []).map((l) => ({
      ...l,
      path: safeHref(l.path, '/'),
      children: Array.isArray(l.children) ? l.children.map((c) => ({ ...c, path: safeHref(c.path, '/') })) : l.children,
    })),
  ], [categories, staticNav]);

  const totalCartItems = cartItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setActiveDropdown(null);
  }, [location]);

  const openDropdown = (label) => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    setActiveDropdown(label);
  };

  const closeDropdown = () => {
    dropdownTimeout.current = setTimeout(() => setActiveDropdown(null), 180);
  };

  const keepDropdown = () => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      <div className="bg-brand-green text-white text-xs py-2 hidden md:block">
        <div className="container-custom flex items-center justify-between">
          <span className="font-body tracking-wide">
            {(header.announcementItems || []).join(' \u00a0|\u00a0 ')}
          </span>
          <div className="flex items-center gap-6 font-body">
            {(header.topLinks || []).map((l) => (isInternal(l.path)
              ? <Link key={`${l.label}${l.path}`} to={l.path} className="hover:text-brand-orange transition-colors">{l.label}</Link>
              : <a key={`${l.label}${l.path}`} href={safeHref(l.path)} target="_blank" rel="noreferrer" className="hover:text-brand-orange transition-colors">{l.label}</a>))}
            {header.showPhone !== false && settings.phone && (
              <a href={tel(settings.phone)} className="hover:text-brand-orange transition-colors font-medium">
                📞 {settings.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      <header className={`sticky top-0 z-50 transition-all duration-300 bg-white ${scrolled ? 'shadow-md border-b border-gray-100' : ''}`}>
        <div className="container-custom">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center flex-shrink-0">
              <img src="/wah_logo.jpg" alt="Wah Spices" className="h-12 md:h-16 w-auto object-contain" />
            </Link>

            <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
              {navLinks.map((link) => (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => link.children && openDropdown(link.label)}
                  onMouseLeave={() => link.children && closeDropdown()}
                >
                  <Link
                    to={link.path}
                    className={`flex items-center gap-1 font-body font-medium text-sm text-gray-700 hover:text-brand-green transition-colors duration-200 py-2 ${location.pathname === link.path ? 'text-brand-green' : ''}`}
                  >
                    {link.label}
                    {link.children && (
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === link.label ? 'rotate-180 text-brand-green' : ''}`} />
                    )}
                  </Link>

                  {link.children && activeDropdown === link.label && (
                    <div className="absolute top-full left-0 pt-1 w-56 z-50">
                      <div
                        className="bg-white rounded-2xl shadow-xl border border-gray-100 py-2 animate-scale-in"
                        onMouseEnter={keepDropdown}
                        onMouseLeave={closeDropdown}
                      >
                        {link.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-brand-green/5 hover:text-brand-green transition-all duration-150 font-body"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="flex items-center gap-1 md:gap-2">
              <button onClick={() => setSearchOpen(true)} className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-600 hover:text-brand-green" aria-label="Search">
                <Search className="w-5 h-5" />
              </button>

              <Link to="/wishlist" className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-600 hover:text-brand-red" aria-label="Wishlist">
                <Heart className="w-5 h-5" />
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-red text-white text-[10px] rounded-full flex items-center justify-center font-bold font-body">
                    {wishlistItems.length}
                  </span>
                )}
              </Link>

              <button onClick={() => dispatch(toggleDrawer())} className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-600 hover:text-brand-green" aria-label="Cart">
                <ShoppingCart className="w-5 h-5" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-green text-white text-[10px] rounded-full flex items-center justify-center font-bold font-body">
                    {totalCartItems > 9 ? '9+' : totalCartItems}
                  </span>
                )}
              </button>

              {isAuthenticated && <NotificationBell />}

              <Link
                to={isAuthenticated ? '/profile' : '/login'}
                className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-brand-green text-white rounded-xl text-sm font-body font-semibold hover:bg-brand-green-dark transition-all duration-200 shadow-brand hover:shadow-brand-hover ml-1"
              >
                <User className="w-4 h-4" />
                <span>{isAuthenticated ? user?.name?.split(' ')[0] || 'Profile' : 'Login'}</span>
              </Link>

              <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-700" aria-label="Menu">
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
            <div className="container-custom py-4 space-y-1">
              {navLinks.map((link) => (
                <div key={link.path}>
                  <Link to={link.path} className="block py-3 px-4 rounded-xl text-gray-800 hover:bg-brand-green/5 hover:text-brand-green font-body font-medium transition-colors">
                    {link.label}
                  </Link>
                  {link.children && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {link.children.slice(1).map((child) => (
                        <Link key={child.path} to={child.path} className="block py-2.5 px-4 rounded-xl text-sm text-gray-500 hover:bg-brand-green/5 hover:text-brand-green font-body transition-colors">
                          — {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="pt-3 mt-3 border-t border-gray-100">
                <Link to={isAuthenticated ? '/profile' : '/login'} className="flex items-center gap-2 py-3 px-4 rounded-xl text-gray-800 hover:bg-brand-green/5 hover:text-brand-green font-body font-medium transition-colors">
                  <User className="w-4 h-4" />
                  {isAuthenticated ? 'My Profile' : 'Login / Register'}
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {searchOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-24 px-4" onClick={() => setSearchOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={header.searchPlaceholder}
                  className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl font-body text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary px-5">Search</button>
            </form>
            <div className="mt-4">
              <p className="text-xs text-gray-400 font-body mb-2 uppercase tracking-wider">Popular searches</p>
              <div className="flex flex-wrap gap-2">
                {(header.popularSearches || []).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { navigate(`/products?search=${encodeURIComponent(tag)}`); setSearchOpen(false); setSearchQuery(''); }}
                    className="badge-green cursor-pointer hover:bg-brand-green/20 transition-colors font-body text-xs"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
