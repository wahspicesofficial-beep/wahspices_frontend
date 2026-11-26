import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import ProductCard from '@/components/ui/ProductCard';
import { SkProductGrid } from '@/components/ui/Skeleton';
import ComingSoon from '@/components/ui/ComingSoon';
import api from '@/services/api';
import { normalizeList } from '@/utils/product';

const PER_CATEGORY = 8;
const ROTATE_MS = 8000;

/**
 * Home "Our Products": cycles through the main categories (Blended Masala → Whole Spices → Ground Spices → …)
 * showing each category's top products (featured first, then best rated). Categories and their order come
 * from the admin (Categories page); a category with no products yet shows "Coming soon". Auto-advances every 8 s, pauses while the
 * shopper hovers / focuses the section or the tab is hidden, and stops rotating once they pick a tab.
 * Products for a category are fetched once and cached; the next category is prefetched.
 */
function CategoryShowcase() {
  const [cats, setCats] = useState([]);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [active, setActive] = useState(0);
  const [cache, setCache] = useState({});          // slug → { items, total }
  const [paused, setPaused] = useState(false);
  const [userPicked, setUserPicked] = useState(false);
  const [hidden, setHidden] = useState(typeof document !== 'undefined' && document.hidden);
  const inflight = useRef(new Set());

  useEffect(() => {
    let alive = true;
    api.get('/categories')
      .then((res) => {
        const list = (res.data?.data || [])
          .filter((c) => !c.parentId && c.isActive !== false)
          .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        if (alive) { setCats(list); setCatsLoaded(true); }
      })
      .catch(() => { if (alive) { setCats([]); setCatsLoaded(true); } });
    return () => { alive = false; };
  }, []);

  const load = useCallback((slug) => {
    if (!slug || inflight.current.has(slug)) return;
    inflight.current.add(slug);
    api.get('/products', { params: { category: slug, limit: PER_CATEGORY } })
      .then((res) => {
        const data = res.data?.data;
        setCache((c) => ({ ...c, [slug]: { items: normalizeList(data), total: data?.total ?? 0 } }));
      })
      .catch(() => {
        inflight.current.delete(slug);   // allow a retry later
        setCache((c) => ({ ...c, [slug]: c[slug] || { items: [], total: 0, error: true } }));
      });
  }, []);

  // Load the current category and prefetch the next one
  useEffect(() => {
    if (!cats.length) return;
    load(cats[active]?.slug);
    load(cats[(active + 1) % cats.length]?.slug);
  }, [cats, active, load]);

  // Every category keeps its tab — one without products shows "Coming soon" in the panel
  const visible = cats;
  const visibleKey = visible.map((c) => c.slug).join('|');
  const current = cats[active];

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (visibleKey.split('|').length < 2 || !visibleKey || paused || hidden || userPicked) return undefined;
    const slugs = visibleKey.split('|');
    const t = setTimeout(() => {
      const pos = slugs.indexOf(cats[active]?.slug);
      const nextSlug = slugs[(pos + 1) % slugs.length];
      setActive(cats.findIndex((c) => c.slug === nextSlug));
    }, ROTATE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, visibleKey, paused, hidden, userPicked]);

  const pick = (i) => { setUserPicked(true); setActive(i); };
  const entry = current ? cache[current.slug] : null;

  if (!catsLoaded) return <SkProductGrid count={4} cols="grid-cols-2 sm:grid-cols-4" />;
  if (!cats.length) return <ComingSoon compact />;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-6 md:justify-center" role="tablist" aria-label="Product categories">
        {visible.map((c) => {
          const i = cats.indexOf(c);
          const on = i === active;
          return (
            <button
              key={c.slug}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(i)}
              className={`relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-full whitespace-nowrap font-body font-medium text-sm transition-all ${
                on ? 'bg-brand-green text-white shadow-brand' : 'bg-white text-gray-600 hover:bg-brand-green/10 hover:text-brand-green border border-gray-200'
              }`}
            >
              {c.icon && <span>{c.icon}</span>}
              {c.name}
              {/* progress bar for the auto-rotation */}
              {on && !userPicked && visible.length > 1 && (
                <span
                  key={`${c.slug}-${paused || hidden ? 'p' : 'r'}`}
                  aria-hidden="true"
                  className="absolute bottom-0 h-[3px] bg-brand-orange/90 left-0"
                  style={{ width: '100%', transformOrigin: 'left', animation: paused || hidden ? 'none' : `wahTabProgress ${ROTATE_MS}ms linear forwards` }}
                />
              )}
            </button>
          );
        })}
      </div>
      <style>{'@keyframes wahTabProgress{from{transform:scaleX(0)}to{transform:scaleX(1)}}@media (prefers-reduced-motion: reduce){[aria-hidden="true"][style*="wahTabProgress"]{animation:none!important}}'}</style>

      <div className="min-h-[24rem]" role="tabpanel" aria-label={current?.name}>
        {!entry ? (
          <SkProductGrid count={4} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
        ) : entry.items.length === 0 && !entry.error ? (
          <ComingSoon key={current.slug} compact name={current.name} icon={current.icon} showBrowseAll={false} />
        ) : entry.items.length === 0 ? (
          <div className="py-16 text-center font-body text-gray-500">Couldn&apos;t load products right now — please try again in a moment.</div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={current.slug}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5"
            >
              {entry.items.map((product, i) => (
                <motion.div key={product.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 7) * 0.05 }}>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <div className="text-center mt-10 flex flex-wrap items-center justify-center gap-3">
        {current && entry?.total > PER_CATEGORY && (
          <Link
            to={`/products?category=${current.slug}`}
            className="inline-flex items-center gap-2 border-2 border-brand-green text-brand-green px-7 py-3 rounded-2xl font-body font-semibold hover:bg-brand-green/10 transition-all"
          >
            All {entry.total} {current.name} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
        <Link
          to="/products"
          className="inline-flex items-center gap-2 bg-brand-green text-white px-8 py-3.5 rounded-2xl font-body font-semibold hover:bg-brand-green-dark transition-all shadow-brand hover:-translate-y-0.5"
        >
          View All Products <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// memo: the home hero re-renders the page every few seconds; that must not reset this rotation timer
export default memo(CategoryShowcase);
