import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

/**
 * Home hero slideshow — "which spice comes from where".
 * Slides come from the admin-editable site-content block `home-hero`
 * ({ intervalSeconds, slides: [{ image, imageSmall, spice, region, text, alt }] }).
 *
 *  useHeroSlides(block)  → state shared by the background and the caption
 *  <HeroBackdrop />       → cross-fading full-bleed photos (slow zoom), lazy-loads upcoming slides
 *  <HeroCaption />        → spice · region chip + description that changes with the photo, dots
 *  <HeroArrows />         → prev / next buttons (desktop)
 *
 * Auto-advances every `intervalSeconds` (3–30 s), pauses on hover / keyboard focus / hidden tab,
 * supports swipe on phones and respects prefers-reduced-motion (no zoom; still changes slides).
 */
export function useHeroSlides(block, fallbackImage, fallbackText) {
  const raw = Array.isArray(block?.slides) ? block.slides : [];
  const slides = raw.filter((s) => s && s.image);
  const list = slides.length ? slides : [{ image: fallbackImage, spice: '', region: '', text: fallbackText, alt: 'Indian spices and masala' }];
  const count = list.length;
  const interval = Math.min(30, Math.max(3, Number(block?.intervalSeconds) || 6)) * 1000;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(typeof document !== 'undefined' && document.hidden);
  const [loaded, setLoaded] = useState(() => new Set([0]));
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const go = useCallback((i) => setIndex(((i % count) + count) % count), [count]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // Keep the index valid when the admin removes slides
  useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);

  // Mount the current and the next slide's image (the rest load only when they are about to show)
  useEffect(() => {
    setLoaded((prevSet) => {
      const nextIdx = (index + 1) % count;
      if (prevSet.has(index) && prevSet.has(nextIdx)) return prevSet;
      const s = new Set(prevSet); s.add(index); s.add(nextIdx); return s;
    });
  }, [index, count]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || hidden) return undefined;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearTimeout(t);
  }, [index, count, paused, hidden, interval]);

  // Swipe (phones)
  const touchX = useRef(null);
  const swipe = {
    onTouchStart: (e) => { touchX.current = e.touches[0].clientX; },
    onTouchEnd: (e) => {
      if (touchX.current == null) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      touchX.current = null;
      if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    },
  };
  const hover = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
  };

  return { slides: list, count, index, current: list[index] || list[0], go, next, prev, loaded, interval, reduceMotion, swipe, hover };
}

export function HeroBackdrop({ hero }) {
  const { slides, index, loaded, interval, reduceMotion } = hero;
  return (
    <>
      {slides.map((s, i) => {
        if (!loaded.has(i)) return null;
        const active = i === index;
        return (
          <img
            key={`${s.image}-${i}`}
            src={s.image}
            srcSet={s.imageSmall ? `${s.imageSmall} 960w, ${s.image} 1920w` : undefined}
            sizes="100vw"
            alt={active ? (s.alt || [s.spice, s.region].filter(Boolean).join(' — ') || 'Indian spices') : ''}
            aria-hidden={!active}
            fetchPriority={i === 0 ? 'high' : 'auto'}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover object-center will-change-[opacity,transform]"
            style={{
              opacity: active ? 1 : 0,
              transform: active && !reduceMotion ? 'scale(1.08)' : 'scale(1)',
              transition: `opacity 1.2s ease-in-out, transform ${active ? interval + 1500 : 1200}ms ${active ? 'linear' : 'ease-out'}`,
            }}
          />
        );
      })}
    </>
  );
}

export function HeroCaption({ hero, className = '' }) {
  const { current, index, count, slides, go } = hero;
  return (
    <div className={className}>
      <div className="min-h-[9.5rem] sm:min-h-[8rem] md:min-h-[7.5rem]" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45 }}
          >
            {(current.spice || current.region) && (
              <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 max-w-full bg-black/25 backdrop-blur-sm border border-white/20 rounded-full px-3.5 py-1 mb-3 text-xs md:text-sm font-body">
                <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                {current.spice && <span className="font-bold text-brand-orange">{current.spice}</span>}
                {current.spice && current.region && <span className="text-white/40">·</span>}
                {current.region && <span className="text-green-100">{current.region}</span>}
              </span>
            )}
            <p className="text-white text-base md:text-lg font-body max-w-xl mx-auto leading-relaxed [text-shadow:0_1px_8px_rgba(0,0,0,0.55)]">{current.text}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      {count > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4" role="tablist" aria-label="Spice origins">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${[s.spice, s.region].filter(Boolean).join(' from ') || `slide ${i + 1}`}`}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === index ? 'w-7 bg-brand-orange' : 'w-2 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HeroArrows({ hero }) {
  if (hero.count < 2) return null;
  const btn = 'hidden md:flex absolute top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm transition-all';
  return (
    <>
      <button type="button" aria-label="Previous spice" onClick={hero.prev} className={`${btn} left-4 lg:left-8`}><ChevronLeft className="w-5 h-5" /></button>
      <button type="button" aria-label="Next spice" onClick={hero.next} className={`${btn} right-4 lg:right-8`}><ChevronRight className="w-5 h-5" /></button>
    </>
  );
}
