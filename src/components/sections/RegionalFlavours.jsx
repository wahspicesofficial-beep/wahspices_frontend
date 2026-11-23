import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import RegionCard from '@/components/regions/RegionCard';
import { fetchRegions } from '@/utils/regions';

const ROTATE_MS = 4500;
const perViewFor = (w) => (w >= 1024 ? 4 : w >= 640 ? 3 : 2);

function usePerView() {
  const [n, setN] = useState(() => (typeof window === 'undefined' ? 4 : perViewFor(window.innerWidth)));
  useEffect(() => {
    const on = () => setN(perViewFor(window.innerWidth));
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return n;
}

function useReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setR(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return r;
}

/**
 * Home "Regional Flavours": the published state stories (admin → Website → Regions, "show on home", in the
 * admin's order) as an auto-rotating carousel. Advances one card every 4.5 s; pauses while hovered / focused,
 * while the tab is hidden and for reduced-motion users; arrows, dots and swipe for manual control.
 * Memoised and self-contained: Home re-renders every few seconds for the hero slider, which must not reset this timer.
 */
function RegionalFlavours() {
  const [regions, setRegions] = useState(null);   // null = loading
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [hidden, setHidden] = useState(typeof document !== 'undefined' && document.hidden);
  const perView = usePerView();
  const reduced = useReducedMotion();
  const touch = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchRegions({ home: true })
      .then((list) => { if (alive) setRegions(list); })
      .catch(() => { if (alive) setRegions([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const count = regions?.length || 0;
  const positions = Math.max(1, count - perView + 1);
  const pos = Math.min(index, positions - 1);
  const go = useCallback((i) => setIndex(((i % positions) + positions) % positions), [positions]);

  useEffect(() => {
    if (positions < 2 || hover || focus || hidden || reduced) return undefined;
    const t = setTimeout(() => go(pos + 1), ROTATE_MS);
    return () => clearTimeout(t);
  }, [pos, positions, hover, focus, hidden, reduced, go]);

  if (regions && count === 0) return null;   // nothing published → section hidden

  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    const t = touch.current; touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(pos + (dx < 0 ? 1 : -1));
  };

  return (
    <section className="section-padding bg-white">
      <div className="container-custom">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 text-sm font-body font-semibold px-4 py-1.5 rounded-full mb-3">
            🗺️ Regional Flavours
          </span>
          <h2 className="text-3xl md:text-5xl font-body font-black text-gray-900 mt-2 mb-2">
            Every Masala Tells a <span className="text-brand-red">State&apos;s Story</span>
          </h2>
          <p className="text-gray-500 font-body text-base max-w-2xl mx-auto">
            Each Wah Spices masala is inspired by and sourced from its home state —
            authentic flavors, authentic origins
          </p>
        </motion.div>

        <div
          className="relative"
          role="region"
          aria-roledescription="carousel"
          aria-label="Regional flavours"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => setFocus(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {!regions ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5" aria-hidden="true">
              {Array.from({ length: perView }).map((_, i) => <div key={i} className="h-[13.5rem] sm:h-[14.5rem] rounded-2xl bg-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <>
              <div className="overflow-hidden -mx-2 py-3">
                <div
                  className="flex"
                  style={{
                    transform: `translateX(-${(pos * 100) / perView}%)`,
                    transition: reduced ? 'none' : 'transform 650ms cubic-bezier(.22,.61,.36,1)',
                  }}
                >
                  {regions.map((r, i) => {
                    const visible = i >= pos && i < pos + perView;
                    return (
                      <div
                        key={r.slug}
                        className="shrink-0 px-2"
                        style={{ width: `${100 / perView}%` }}
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`${i + 1} of ${count}: ${r.name}`}
                        aria-hidden={!visible}
                      >
                        <RegionCard region={r} tabIndex={visible ? undefined : -1} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {positions > 1 && (
                <>
                  <button type="button" onClick={() => go(pos - 1)} aria-label="Previous regions"
                    className="hidden sm:flex absolute -left-3 lg:-left-5 top-[42%] -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg border border-gray-100 text-gray-700 hover:text-brand-green hover:scale-105 transition">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => go(pos + 1)} aria-label="Next regions"
                    className="hidden sm:flex absolute -right-3 lg:-right-5 top-[42%] -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg border border-gray-100 text-gray-700 hover:text-brand-green hover:scale-105 transition">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="flex justify-center gap-1.5 mt-4" role="tablist" aria-label="Choose regions">
                    {Array.from({ length: positions }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        role="tab"
                        aria-selected={i === pos}
                        aria-label={`Show ${regions[i]?.name || `set ${i + 1}`}${perView > 1 && regions[i + perView - 1] ? ` to ${regions[i + perView - 1].name}` : ''}`}
                        onClick={() => go(i)}
                        className={`h-2 rounded-full transition-all duration-300 ${i === pos ? 'w-6 bg-brand-green' : 'w-2 bg-gray-300 hover:bg-gray-400'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="text-center mt-8">
          <Link to="/regions" className="inline-flex items-center gap-2 text-brand-green font-body font-bold hover:gap-3 transition-all">
            Explore India&apos;s spice map <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default memo(RegionalFlavours);
