import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import ProductCard from '@/components/ui/ProductCard';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchCategories } from '@/store/slices/productSlice';
import { SkProductGrid } from '@/components/ui/Skeleton';
import api from '@/services/api';
import { normalizeList } from '@/utils/product';

// Products load page by page as the shopper scrolls (infinite scroll); sorting happens on the server
const PAGE_SIZE = 12;
const API_SORT = { 'price-asc': 'price_asc', 'price-desc': 'price_desc', rating: 'rating', name: 'name' };

const sortOptions = [
  { value: 'default', label: 'Default' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Best Rated' },
  { value: 'name', label: 'Name: A to Z' },
];

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState('default');
  const dispatch = useAppDispatch();
  const { categories } = useAppSelector((s) => s.products);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);            // last page loaded
  const [loading, setLoading] = useState(true);   // first page
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestId = useRef(0);
  const sentinelRef = useRef(null);

  const activeCategory = searchParams.get('category') || 'all';
  const activeSub = searchParams.get('sub') || 'all';
  const searchQuery = searchParams.get('search') || '';

  // Categories come back flat; split into main categories and their sub-categories
  const byOrder = (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0);
  const mainCategories = useMemo(() => categories.filter((c) => !c.parentId).sort(byOrder), [categories]);
  const activeMain = mainCategories.find((c) => c.slug === activeCategory);
  const subCategories = useMemo(
    () => (activeMain ? categories.filter((c) => c.parentId === activeMain.id).sort(byOrder) : []),
    [categories, activeMain]
  );

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  const loadPage = useCallback(async (nextPage) => {
    const id = nextPage === 1 ? ++requestId.current : requestId.current;
    const params = { page: nextPage, limit: PAGE_SIZE };
    if (activeCategory !== 'all') params.category = activeCategory;
    if (activeSub !== 'all') params.subCategory = activeSub;
    if (searchQuery) params.search = searchQuery;
    if (API_SORT[sortBy]) params.sort = API_SORT[sortBy];
    if (nextPage === 1) setLoading(true); else setLoadingMore(true);
    setLoadError(false);
    try {
      const res = await api.get('/products', { params });
      if (id !== requestId.current) return;   // filters changed while this page was loading
      const data = res.data?.data;
      const items = normalizeList(data);
      setProducts((prev) => {
        if (nextPage === 1) return items;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...items.filter((p) => !seen.has(p.id))];
      });
      setTotal(data?.total ?? items.length);
      setPage(nextPage);
    } catch {
      if (id === requestId.current) setLoadError(true);
    } finally {
      if (id === requestId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [activeCategory, activeSub, searchQuery, sortBy]);

  // New filters / search / sort → start again from page 1
  useEffect(() => {
    setProducts([]);
    setPage(0);
    loadPage(1);
  }, [loadPage]);

  const hasMore = page > 0 && products.length < total;

  // Load the next page when the sentinel below the grid comes near the viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadingMore || loadError) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadPage(page + 1);
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, loadError, page, loadPage]);

  const setCategory = (cat) => {
    const params = new URLSearchParams(searchParams);
    if (cat === 'all') params.delete('category');
    else params.set('category', cat);
    params.delete('sub');
    setSearchParams(params);
  };

  const setSub = (sub) => {
    const params = new URLSearchParams(searchParams);
    if (sub === 'all') params.delete('sub');
    else params.set('sub', sub);
    setSearchParams(params);
  };

  const sortedProducts = products;   // already sorted by the server

  const allCategories = [
    { id: 'all', name: 'All Products', icon: '🌿' },
    ...mainCategories.map((c) => ({ id: c.slug, name: c.name, icon: c.icon || '' })),
  ];

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-12">
        <div className="container-custom">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-3">Our Products</h1>
            <p className="text-green-300 font-body">Authentic masala varieties from the finest spice growing regions</p>
          </motion.div>
        </div>
      </div>

      <div className="container-custom py-8">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-6">
          {allCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full whitespace-nowrap font-body font-medium text-sm transition-all ${
                activeCategory === cat.id
                  ? 'bg-brand-green text-white shadow-brand'
                  : 'bg-white text-gray-600 hover:bg-brand-green/10 hover:text-brand-green border border-gray-200'
              }`}
            >
              {cat.icon && <span>{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
        </div>

        {subCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mt-2 mb-6">
            {[{ slug: 'all', name: `All ${activeMain.name}`, icon: '' }, ...subCategories].map((sub) => (
              <button
                key={sub.slug}
                onClick={() => setSub(sub.slug)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full whitespace-nowrap font-body text-xs font-medium transition-all ${
                  activeSub === sub.slug
                    ? 'bg-brand-orange text-white shadow'
                    : 'bg-white text-gray-600 hover:text-brand-orange border border-gray-200'
                }`}
              >
                {sub.icon && <span>{sub.icon}</span>}
                {sub.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {searchQuery && (
            <div className="flex items-center gap-2 bg-brand-green/10 text-brand-green px-4 py-2 rounded-full text-sm">
              <Search className="w-4 h-4" />
              <span>"{searchQuery}"</span>
              <button onClick={() => { const p = new URLSearchParams(searchParams); p.delete('search'); setSearchParams(p); }} className="ml-1 hover:text-brand-red">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{total} products</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-green/30 bg-white">
              {sortOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <SkProductGrid count={8} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
        ) : sortedProducts.length === 0 && loadError ? (
          <div className="text-center py-24">
            <h3 className="font-heading font-bold text-2xl text-gray-700 mb-2">Couldn't load products</h3>
            <p className="text-gray-500 mb-6">Please check your connection and try again.</p>
            <button onClick={() => loadPage(1)} className="btn-primary">Try again</button>
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🫙</div>
            <h3 className="font-heading font-bold text-2xl text-gray-700 mb-2">No products found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your filters or search terms</p>
            <button onClick={() => { setSearchParams({}); setSortBy('default'); }} className="btn-primary">Clear Filters</button>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {sortedProducts.map((product, i) => (
              <motion.div key={product.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i % PAGE_SIZE) * 0.04 }}>
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {!loading && sortedProducts.length > 0 && (
          <>
            {loadingMore && <div className="mt-4 md:mt-6"><SkProductGrid count={4} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" /></div>}
            {loadError && (
              <div className="text-center py-8">
                <button onClick={() => loadPage(page + 1)} className="btn-primary">Couldn't load more — try again</button>
              </div>
            )}
            <div ref={sentinelRef} aria-hidden="true" className="h-1" />
          </>
        )}
      </div>
    </div>
  );
}
