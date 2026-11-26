import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowRight, ChevronRight, Eye, MapPin, ShoppingBag, Sparkles, UtensilsCrossed } from 'lucide-react';
import IndiaMap from '@/components/regions/IndiaMap';
import RegionCard from '@/components/regions/RegionCard';
import ProductCard from '@/components/ui/ProductCard';
import ComingSoon from '@/components/ui/ComingSoon';
import { fetchRegion, fetchRegions, paragraphs, regionImage, safeColor, tint } from '@/utils/regions';
import { normalizeList } from '@/utils/product';

const SITE = 'WAH! Spices';
const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.35 } };

/** document.title + meta description for this page; restored when leaving. */
function useSeo(title, description) {
  useEffect(() => {
    const prevTitle = document.title;
    let meta = document.querySelector('meta[name="description"]');
    const created = !meta;
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    const prevDesc = meta.getAttribute('content');
    if (title) document.title = title;
    if (description) meta.setAttribute('content', description);
    return () => {
      document.title = prevTitle;
      if (created) meta.remove(); else if (prevDesc != null) meta.setAttribute('content', prevDesc);
    };
  }, [title, description]);
}

function Photo({ src, alt, className, eager }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={`${className} bg-brand-cream-dark`} aria-hidden="true" />;
  return <img src={src} alt={alt || ''} className={className} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />;
}

/* ───────────── Hero ───────────── */
function RegionHero({ region, preview }) {
  const color = safeColor(region.accentColor);
  return (
    <section className="relative isolate overflow-hidden bg-brand-green-dark text-white">
      <div className="absolute inset-0 -z-10">
        <Photo src={regionImage(region.heroImageUrl)} alt={region.landmark ? `${region.landmark}, ${region.name}` : region.name} className="h-full w-full object-cover" eager />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, rgba(10,30,16,.92) 0%, rgba(10,30,16,.55) 45%, rgba(10,30,16,.25) 100%), linear-gradient(90deg, ${color}66 0%, transparent 60%)` }} />
      </div>
      <div className="container-custom flex min-h-[420px] flex-col justify-end pb-12 pt-28 md:min-h-[520px] md:pb-16">
        {preview && (
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-body font-bold text-amber-950">
            <Eye className="h-4 w-4" /> Preview{region.isPublished ? '' : ' — not published yet'}
          </div>
        )}
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-xs font-body text-white/70">
          <Link to="/" className="hover:text-white">Home</Link><ChevronRight className="h-3 w-3" />
          <Link to="/regions" className="hover:text-white">Regions</Link><ChevronRight className="h-3 w-3" />
          <span className="text-white" aria-current="page">{region.name}</span>
        </nav>
        <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-body font-semibold backdrop-blur-sm">
          🗺️ Regional Flavours{region.featuredMasala ? ` · ${region.featuredMasala}` : ''}
        </span>
        <h1 className="font-body font-black leading-[1.05]" style={{ fontSize: 'clamp(2.4rem, 7vw, 4.75rem)' }}>{region.name}</h1>
        {region.tagline && <p className="mt-2 font-accent text-2xl text-brand-orange md:text-3xl">{region.tagline}</p>}
        {region.cardText && <p className="mt-4 max-w-2xl font-body text-base leading-relaxed text-white/85 md:text-lg">{region.cardText}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#story" className="inline-flex items-center gap-2 rounded-2xl bg-brand-orange px-6 py-3 font-body font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-brand-orange-light">
            Read the story <ArrowDown className="h-4 w-4" />
          </a>
          <a href="#shop" className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/35 px-6 py-3 font-body font-semibold text-white transition hover:border-white/70 hover:bg-white/10">
            <ShoppingBag className="h-4 w-4" /> Shop the masalas
          </a>
        </div>
      </div>
      {region.heroImageCredit && (
        <p className="absolute bottom-2 right-3 max-w-[70%] truncate text-right text-[10px] font-body text-white/55">{region.heroImageCredit}</p>
      )}
    </section>
  );
}

function IndexHero({ count }) {
  return (
    <section className="relative overflow-hidden bg-brand-green-dark py-20 text-white md:py-24">
      <div className="absolute inset-0 opacity-10" aria-hidden="true">
        <div className="absolute right-20 top-10 h-64 w-64 rounded-full bg-brand-orange blur-3xl" />
        <div className="absolute bottom-10 left-10 h-48 w-48 rounded-full bg-white blur-3xl" />
      </div>
      <div className="container-custom relative z-10 text-center">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center justify-center gap-1 text-xs font-body text-white/70">
          <Link to="/" className="hover:text-white">Home</Link><ChevronRight className="h-3 w-3" /><span className="text-white">Regions</span>
        </nav>
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-body font-semibold text-green-200">🗺️ Regional Flavours</span>
        <h1 className="mb-4 font-body text-4xl font-black md:text-6xl">Every Masala Tells a <span className="text-brand-orange">State&apos;s Story</span></h1>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-green-200">
          Explore India&apos;s spice map: where our spices grow, how they are made, and the dishes each region is famous for.
          {count > 0 && ` ${count} regional stories and counting.`}
        </p>
      </div>
    </section>
  );
}

/* ───────────── Side panel next to the map ───────────── */
function RegionPanel({ region }) {
  const color = safeColor(region.accentColor);
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-body font-bold uppercase tracking-wider" style={{ color }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} /> Selected region
      </div>
      <h2 className="mt-1 font-body text-3xl font-black text-gray-900 md:text-4xl">{region.name}</h2>
      {region.tagline && <p className="font-body text-base text-gray-500">{region.tagline}</p>}

      {region.produces?.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 font-body text-sm font-bold uppercase tracking-wider text-gray-800"><Sparkles className="h-4 w-4 text-brand-orange" /> What grows here</h3>
          <ul className="grid grid-cols-2 gap-2">
            {region.produces.map((p) => (
              <li key={p.name} className="flex items-center gap-2.5 rounded-2xl border bg-white p-2.5 sm:items-start sm:gap-3 sm:p-3" style={{ borderColor: tint(color, 0.8) }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: tint(color, 0.88) }} aria-hidden="true">{p.icon || '🌿'}</span>
                <span className="min-w-0">
                  <span className="block font-body text-[13px] font-bold leading-tight text-gray-900 sm:text-sm" title={p.note || undefined}>{p.name}</span>
                  {p.note && <span className="hidden font-body text-xs leading-snug text-gray-500 sm:block">{p.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {region.signatureMasalas?.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 font-body text-sm font-bold uppercase tracking-wider text-gray-800">🌶️ Signature masalas</h3>
          <ul className="space-y-2">
            {region.signatureMasalas.map((m) => (
              <li key={m.name} className="font-body text-sm text-gray-600">
                <span className="font-bold text-gray-900">{m.name}</span>{m.note ? ` — ${m.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {region.dishes?.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 font-body text-sm font-bold uppercase tracking-wider text-gray-800"><UtensilsCrossed className="h-4 w-4 text-brand-green" /> Famous dishes</h3>
          <ul className="flex flex-wrap gap-2">
            {region.dishes.map((d) => (
              <li key={d.name} title={d.note || undefined} className="rounded-full px-3 py-1.5 font-body text-xs font-semibold" style={{ backgroundColor: tint(color, 0.88), color }}>
                {d.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-3">
        <a href="#story" className="btn-primary inline-flex items-center gap-2">Read the story <ArrowDown className="h-4 w-4" /></a>
        <a href="#shop" className="inline-flex items-center gap-2 rounded-xl border-2 border-brand-green/30 px-5 py-2.5 font-body text-sm font-bold text-brand-green hover:bg-brand-green/5">Shop masalas</a>
      </div>
    </div>
  );
}

function IndexPanel({ regions, onPick }) {
  return (
    <div>
      <div className="text-xs font-body font-bold uppercase tracking-wider text-brand-orange">Pick a state</div>
      <h2 className="mt-1 font-body text-3xl font-black text-gray-900">Where does your masala come from?</h2>
      <p className="mt-2 font-body text-gray-600">Tap a highlighted state on the map — or choose one below — to read its story, see what grows there and shop its masalas.</p>
      <ul className="mt-6 flex flex-wrap gap-2">
        {regions.map((r) => (
          <li key={r.slug}>
            <button type="button" onClick={() => onPick(r)}
              className="inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-2 font-body text-sm font-semibold text-gray-800 transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderColor: tint(r.accentColor, 0.6) }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: safeColor(r.accentColor) }} />{r.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────── Story article ───────────── */
function Story({ region }) {
  const color = safeColor(region.accentColor);
  if (!region.sections?.length) return null;
  return (
    <section id="story" className="section-padding scroll-mt-20 bg-white">
      <div className="container-custom">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-body font-semibold" style={{ backgroundColor: tint(color, 0.88), color }}>📖 The story</span>
            <h2 className="mt-3 font-body text-3xl font-black text-gray-900 md:text-4xl">The spices of {region.name}</h2>
          </div>
          {region.sections.map((s, i) => (
            <article key={`${i}-${s.heading}`} className="mb-14 last:mb-0">
              <div className="mb-4 flex items-start gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-body text-sm font-black text-white" style={{ backgroundColor: color }} aria-hidden="true">{i + 1}</span>
                <h3 className="font-body text-2xl font-black leading-tight text-gray-900 md:text-[1.7rem]">{s.heading}</h3>
              </div>
              {s.imageUrl && (
                <figure className="mb-6">
                  <Photo src={regionImage(s.imageUrl)} alt={s.imageAlt || s.heading} className="aspect-[16/10] w-full rounded-3xl object-cover shadow-card" />
                  {(s.imageCaption || s.imageCredit) && (
                    <figcaption className="mt-2 px-1 font-body">
                      {s.imageCaption && <span className="block text-sm text-gray-600">{s.imageCaption}</span>}
                      {s.imageCredit && <span className="block text-[11px] text-gray-400">{s.imageCredit}</span>}
                    </figcaption>
                  )}
                </figure>
              )}
              <div className="space-y-4 font-body text-[1.05rem] leading-[1.8] text-gray-700">
                {paragraphs(s.body).map((p, j) => <p key={j} className="whitespace-pre-line">{p}</p>)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Page ───────────── */
export default function Regions() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const previewId = params.get('preview');
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [detail, setDetail] = useState({ slug: null, data: null, status: 'idle' });
  const cache = useRef(new Map());
  const explorerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchRegions().then((l) => { if (alive) setList(l); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!slug) { setDetail({ slug: null, data: null, status: 'idle' }); return undefined; }
    const key = previewId ? `p:${previewId}` : slug;
    const hit = cache.current.get(key);
    if (hit) { setDetail({ slug, data: hit, status: 'ok' }); return undefined; }
    let alive = true;
    setDetail((d) => ({ ...d, status: 'loading' }));
    fetchRegion(slug, { previewId })
      .then((data) => {
        if (!alive) return;
        if (!data) { setDetail({ slug, data: null, status: 'missing' }); return; }
        cache.current.set(key, data);
        setDetail({ slug, data, status: 'ok' });
      })
      .catch((err) => { if (alive) setDetail({ slug, data: null, status: err?.response?.status === 404 ? 'missing' : 'error' }); });
    return () => { alive = false; };
  }, [slug, previewId]);

  const region = detail.status === 'ok' || detail.status === 'loading' ? detail.data : null;
  const mapRegions = useMemo(() => {
    const l = list || [];
    if (region && !l.some((r) => r.slug === region.slug)) return [...l, region];   // preview of a draft
    return l;
  }, [list, region]);

  const pick = (r) => {
    if (!r || r.slug === slug) return;
    navigate(`/regions/${r.slug}`, { state: { keepScroll: true } });
    // Keep the map in view on small screens, where the panel sits above it
    const el = explorerRef.current;
    if (el && el.getBoundingClientRect().top < -40) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useSeo(
    region ? (region.seoTitle || `${region.name} — Spices & Story | ${SITE}`) : `Regional Flavours: India's Spice Map | ${SITE}`,
    region ? (region.seoDescription || region.cardText || region.tagline) : 'Explore the spices of India state by state — what grows there, how the masalas are made and the dishes each region is famous for.',
  );

  if (slug && (detail.status === 'missing' || detail.status === 'error')) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-brand-cream px-4">
        <div className="text-center">
          <div className="mb-4 text-7xl">🗺️</div>
          <h1 className="mb-2 font-body text-3xl font-black text-brand-green">{detail.status === 'missing' ? 'Region not found' : 'Could not load this region'}</h1>
          <p className="mb-6 font-body text-gray-500">{detail.status === 'missing' ? "We haven't written this state's story yet." : 'Please check your connection and try again.'}</p>
          <Link to="/regions" className="btn-primary">See all regions</Link>
        </div>
      </div>
    );
  }

  const products = region ? normalizeList(region.products) : [];
  const others = region ? (region.others || []) : (list || []);

  return (
    <div className="min-h-screen bg-brand-cream">
      {slug
        ? (region ? <RegionHero key={region.slug} region={region} preview={!!previewId} /> : <div className="min-h-[420px] animate-pulse bg-brand-green-dark md:min-h-[520px]" />)
        : <IndexHero count={list?.length || 0} />}

      {/* ── Map + selected state ── */}
      <section ref={explorerRef} className="spice-pattern-bg scroll-mt-16 py-12 md:py-16" aria-label="India spice map">
        <div className="container-custom">
          <div className="grid items-start gap-8 lg:grid-cols-12">
            <div className="order-2 lg:col-span-5" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div key={region?.slug || 'index'} {...fade}>
                  {slug
                    ? (region ? <RegionPanel region={region} /> : <div className="h-72 animate-pulse rounded-3xl bg-white/70" />)
                    : <IndexPanel regions={list || []} onPick={pick} />}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="order-1 lg:col-span-7">
              <div className="rounded-3xl bg-white p-3 shadow-card sm:p-5">
                <IndiaMap regions={mapRegions} selectedId={region?.mapStateId} onSelect={pick} className="mx-auto max-w-[560px]" />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                  <div className="flex flex-wrap items-center gap-4 font-body text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: safeColor(region?.accentColor, '#2d8a4e') }} /> Selected</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#a9cdb3]" /> Has a story</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#efe4cf]" /> Coming soon</span>
                  </div>
                  <label className="flex items-center gap-2 font-body text-xs text-gray-600">
                    <MapPin className="h-3.5 w-3.5 text-brand-green" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">Jump to</span>
                    <select
                      value={region?.slug || ''}
                      onChange={(e) => pick((list || []).find((r) => r.slug === e.target.value))}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-800 focus:border-brand-green focus:outline-none"
                      aria-label="Choose a region"
                    >
                      <option value="" disabled>Choose a state…</option>
                      {(list || []).map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Story, products ── */}
      <AnimatePresence mode="wait">
        {region && (
          <motion.div key={region.slug} {...fade}>
            <Story region={region} />
            <section id="shop" className="section-padding scroll-mt-20 bg-brand-cream">
              <div className="container-custom">
                <div className="mb-10 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-4 py-1.5 text-sm font-body font-semibold text-brand-green">🛍️ Shop the region</span>
                  <h2 className="mt-3 font-body text-3xl font-black text-gray-900 md:text-4xl">Masalas from <span className="text-brand-green">{region.name}</span></h2>
                  <p className="mt-2 font-body text-gray-500">Spices and blends inspired by {region.name}&apos;s kitchens</p>
                </div>
                {products.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4">
                    {products.map((p) => <ProductCard key={p.id} product={p} />)}
                  </div>
                ) : (
                  <ComingSoon compact name={`${region.name} masalas`} icon={region.icon || '🗺️'} />
                )}
                <div className="mt-8 text-center">
                  <Link to="/products" className="inline-flex items-center gap-2 font-body font-bold text-brand-green hover:gap-3 transition-all">Browse all products <ArrowRight className="h-4 w-4" /></Link>
                </div>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Other regions ── */}
      {others.length > 0 && (
        <section className="section-padding bg-white">
          <div className="container-custom">
            <div className="mb-10 text-center">
              <h2 className="font-body text-3xl font-black text-gray-900 md:text-4xl">{region ? 'Explore more regions' : 'All regional stories'}</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
              {others.map((r) => <RegionCard key={r.slug} region={r} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Credits ── */}
      <footer className="border-t border-brand-cream-dark bg-brand-cream py-6">
        <div className="container-custom space-y-1 text-center font-body text-[11px] leading-relaxed text-gray-500">
          <p>
            Map: state &amp; union-territory boundaries from{' '}
            <a href="https://www.geoboundaries.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">geoBoundaries</a>{' '}
            / <a href="https://github.com/datameet/maps" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">DataMeet India</a>,{' '}
            <a href="https://creativecommons.org/licenses/by/2.5/in/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">CC BY 2.5 IN</a>{' '}
            (simplified and reprojected). The map is for illustration.
          </p>
          <p>
            Photos: Wikimedia Commons contributors under CC BY / CC BY-SA / FAL / public domain — credited under each photo
            (<a href="/images/regions/CREDITS.md" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">full list</a>).
          </p>
        </div>
      </footer>
    </div>
  );
}
