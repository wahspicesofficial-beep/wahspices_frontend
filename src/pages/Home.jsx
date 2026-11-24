import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Star, Award, Leaf, Shield, Truck, ChevronRight } from 'lucide-react';
import FarmToKitchen from '@/components/sections/FarmToKitchen';
import CategoryShowcase from '@/components/sections/CategoryShowcase';
import RegionalFlavours from '@/components/sections/RegionalFlavours';
import { useHeroSlides, HeroBackdrop, HeroCaption, HeroArrows } from '@/components/sections/HeroSlides';
import { fetchRecipesAndKnowledge } from '@/utils/blog';
import { useSiteContent } from '@/content/useSiteContent';

/* Hero background spice photo from Unsplash */
const HERO_BG =
  'https://images.unsplash.com/photo-1633881614907-8587c9b93c2f?w=1920&q=85&auto=format&fit=crop';

/* ──────────────────────────────────────────────
   Trust / guarantee strip
────────────────────────────────────────────── */
const trustPoints = [
  { icon: Leaf,   title: '100% Natural',    desc: 'Zero artificial colors or preservatives', color: 'text-green-500 bg-green-50' },
  { icon: Shield, title: 'FSSAI Certified', desc: 'Safe, hygienic & quality assured',        color: 'text-blue-500 bg-blue-50'  },
  { icon: Award,  title: 'Premium Quality', desc: 'From finest spice regions of India',       color: 'text-yellow-600 bg-yellow-50' },
  { icon: Truck,  title: 'Fast Delivery',   desc: 'Delivered fresh to your doorstep',         color: 'text-purple-500 bg-purple-50' },
];

export default function Home() {
  // Published recipes & articles from the API: featured first, then newest (section hidden when there are none)
  const [featuredBlogs, setFeaturedBlogs] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchRecipesAndKnowledge({ limit: 6 })
      .then((d) => { if (alive) setFeaturedBlogs(d.items.slice(0, 3)); })
      .catch(() => { /* section stays hidden */ });
    return () => { alive = false; };
  }, []);

  // Testimonials: only real customer feedback the admin has approved + featured (admin → Feedback).
  // No placeholder reviews — the section is hidden until there is at least one.
  const { featuredTestimonials, block } = useSiteContent();
  const hero = useHeroSlides(block('home-hero'), HERO_BG,
    'Sourced from the best spice-growing regions of India. No artificial colors, no preservatives — just pure, bold, authentic flavors for every Indian kitchen.');
  const testimonials = featuredTestimonials
    .map((t) => ({ ...t, rating: Math.max(1, Math.min(5, Number(t.rating) || 5)), initial: t.initial || String(t.name || '?').charAt(0).toUpperCase() }));

  return (
    <div className="min-h-screen">

      {/* ══════════════════════════════════════════
          HERO — full-bleed spice photo bg, centered
      ══════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden" {...hero.swipe} {...hero.hover}>

        {/* ── Full-bleed background spice photo ── */}
        <div className="absolute inset-0">
          <HeroBackdrop hero={hero} />
          {/* Dark green brand overlay — blends the photo with brand color */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(10,40,20,0.55) 0%, rgba(10,40,20,0.35) 70%), linear-gradient(to bottom, rgba(15,61,30,0.45) 0%, rgba(15,61,30,0.50) 50%, rgba(15,61,30,0.82) 100%)',
            }}
          />
          {/* Warm bottom vignette */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-brand-green-dark to-transparent" />
        </div>

        <HeroArrows hero={hero} />

        {/* ── Centered hero content ── */}
        <div className="container-custom relative z-10 py-24 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-white"
          >
            {/* India badge */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2 mb-8"
            >
              <span className="text-base">🇮🇳</span>
              <span className="text-sm font-body font-semibold text-green-200 tracking-wide">
                100% Made in India &nbsp;·&nbsp; 25+ Authentic Varieties
              </span>
            </motion.div>

            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.75 }}
              className="font-body font-black leading-tight mb-4"
              style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)' }}
            >
              <span className="text-brand-orange">Wah</span>{' '}
              <span className="text-white">Spices</span>
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="font-accent text-2xl md:text-3xl text-brand-orange mb-5"
            >
              "Pehle bite mein — WAH!"
            </motion.p>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mb-10"
            >
              <HeroCaption hero={hero} />
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-10 md:gap-16 mb-10"
            >
              {[
                { num: '25+',  label: 'Masala Varieties' },
                { num: '100%', label: 'Natural' },
                { num: '50K+', label: 'Happy Families' },
              ].map((s, i) => (
                <div key={s.label} className="relative text-center">
                  {i > 0 && (
                    <span className="absolute -left-5 top-1/2 -translate-y-1/2 text-white/20 text-lg hidden sm:block">
                      |
                    </span>
                  )}
                  <div className="text-3xl md:text-4xl font-body font-black text-brand-orange">
                    {s.num}
                  </div>
                  <div className="text-xs text-green-300 font-body mt-1 tracking-wider uppercase">
                    {s.label}
                  </div>
                </div>
              ))}
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <Link
                to="/products"
                className="flex items-center gap-2.5 bg-brand-orange hover:bg-brand-orange-light text-white px-9 py-4 rounded-2xl font-body font-bold text-base transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-2xl"
              >
                Shop Now <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/about"
                className="flex items-center gap-2 border-2 border-white/35 hover:border-white/70 text-white px-9 py-4 rounded-2xl font-body font-semibold text-base transition-all duration-300 hover:bg-white/10"
              >
                Our Story
              </Link>
            </motion.div>

            {/* Trust mini-badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.95 }}
              className="flex flex-wrap justify-center gap-3 mt-10"
            >
              {['🌿 No Artificial Colours', '🚫 No Preservatives', '✅ FSSAI Certified', '🇮🇳 Made in India'].map(
                (b) => (
                  <span
                    key={b}
                    className="text-xs font-body font-medium text-green-200 bg-white/8 border border-white/15 px-3 py-1.5 rounded-full backdrop-blur-sm"
                  >
                    {b}
                  </span>
                )
              )}
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40"
        >
          <div className="w-0.5 h-8 bg-white/20 rounded-full" />
          <span className="text-[10px] font-body tracking-widest uppercase">Scroll</span>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════
          TRUST STRIP
      ══════════════════════════════════════════ */}
      <section className="bg-white border-b border-gray-100">
        <div className="container-custom py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustPoints.map((pt, i) => (
              <motion.div
                key={pt.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors"
              >
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${pt.color}`}>
                  <pt.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-body font-bold text-gray-800 text-sm">{pt.title}</div>
                  <div className="text-xs text-gray-500 font-body leading-tight">{pt.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURED PRODUCTS
      ══════════════════════════════════════════ */}
      <section className="section-padding spice-pattern-bg bg-brand-cream">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-1.5 bg-brand-green/10 text-brand-green text-sm font-body font-semibold px-4 py-1.5 rounded-full mb-3">
              🌿 Our Products
            </span>
            <h2 className="text-3xl md:text-5xl font-body font-black text-gray-900 mt-2 mb-2">
              25+ Authentic <span className="text-brand-green">Masala</span> Varieties
            </h2>
            <p className="text-gray-500 font-body text-base md:text-lg">
              Sourced from the best spice-growing regions across India
            </p>
          </motion.div>

          <CategoryShowcase />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          REGIONAL FLAVOURS — state stories from the API (admin → Website → Regions), auto-rotating
      ══════════════════════════════════════════ */}
      <RegionalFlavours />

      {/* ══════════════════════════════════════════
          FARM TO KITCHEN ANIMATION
      ══════════════════════════════════════════ */}
      <FarmToKitchen />

      {/* ══════════════════════════════════════════
          ABOUT BAND
      ══════════════════════════════════════════ */}
      <section className="section-padding bg-brand-cream spice-pattern-bg">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-1.5 bg-brand-green/10 text-brand-green text-sm font-body font-semibold px-4 py-1.5 rounded-full mb-4">
                🌿 About Wah Spices
              </span>
              <h2 className="text-3xl md:text-4xl font-body font-black text-gray-900 mt-2 mb-4 leading-tight">
                The Promise of <br />
                <span className="text-brand-red">Authentic</span> Taste
              </h2>
              <p className="text-gray-600 font-body leading-relaxed mb-5 text-base">
                Wah Spices brings you the finest quality spices sourced from the best spice
                growing regions of India. Each masala is prepared with authentic recipes and modern
                hygiene standards — to make every meal extraordinary.
              </p>
              <div className="space-y-2.5 mb-8">
                {[
                  'Sourced from the Best Spice Growing Regions',
                  'No Artificial Colours or Preservatives',
                  'Hygienically Processed in FSSAI Facility',
                  'Rich Aroma & Bold Authentic Flavours',
                  'Trusted by Chefs & Loved by Millions',
                ].map((pt) => (
                  <div key={pt} className="flex items-center gap-2.5 text-gray-700 font-body text-sm">
                    <span className="w-5 h-5 bg-brand-green/10 rounded-full flex items-center justify-center text-brand-green text-xs flex-shrink-0 font-bold">
                      ✓
                    </span>
                    {pt}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/about" className="btn-primary">Our Story</Link>
                <Link to="/history" className="btn-outline">Our History</Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { label: '25+',  sublabel: 'Masala Varieties',   icon: '🌶️', color: '#c8371e' },
                { label: '50K+', sublabel: 'Happy Families',     icon: '👨‍👩‍👧‍👦', color: '#1a5c2e' },
                { label: '100%', sublabel: 'Natural Ingredients', icon: '🌿', color: '#2d8a4e' },
                { label: 'FSSAI',sublabel: 'Certified & Safe',   icon: '🏅', color: '#f5a623' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white rounded-2xl p-6 text-center shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all"
                >
                  <div className="text-4xl mb-2">{stat.icon}</div>
                  <div className="text-2xl font-body font-black" style={{ color: stat.color }}>
                    {stat.label}
                  </div>
                  <div className="text-xs text-gray-500 font-body mt-1">{stat.sublabel}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          BLOG / RECIPES
      ══════════════════════════════════════════ */}
      {featuredBlogs.length > 0 && <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-end justify-between mb-12"
          >
            <div>
              <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 text-sm font-body font-semibold px-4 py-1.5 rounded-full mb-3">
                🍳 Recipes & Knowledge
              </span>
              <h2 className="text-3xl md:text-4xl font-body font-black text-gray-900 mt-2">
                Cook Like a <span className="text-brand-green">Chef</span>
              </h2>
              <p className="text-gray-500 font-body mt-1">Authentic Indian recipes using our premium masalas</p>
            </div>
            <Link
              to="/blog"
              className="hidden md:flex items-center gap-1.5 text-brand-green font-body font-semibold text-sm hover:gap-2.5 transition-all"
            >
              All Recipes <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredBlogs.map((blog, i) => (
              <motion.div
                key={blog.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link to={blog.href} className="block group">
                  <div className="bg-white rounded-2xl shadow-card hover:shadow-card-hover overflow-hidden hover:-translate-y-2 transition-all duration-300">
                    <div
                      className="h-44 relative flex items-end p-4"
                      style={{ backgroundColor: blog.bgColor }}
                    >
                      {blog.image ? (
                        <>
                          <img src={blog.image} alt={blog.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-15">
                          <span className="text-8xl select-none">
                            {blog.category === 'Recipe' ? '🍳' : blog.category === 'Health' ? '💚' : '📚'}
                          </span>
                        </div>
                      )}
                      <span className="relative z-10 text-xs bg-white/20 backdrop-blur-sm text-white font-body font-semibold px-2.5 py-1 rounded-full">
                        {blog.category}
                      </span>
                      <span className="absolute top-3 right-3 text-[10px] text-white/70 font-body">{blog.readTime}</span>
                    </div>
                    <div className="p-5">
                      <h3 className="font-body font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-brand-green transition-colors text-base leading-snug">
                        {blog.title}
                      </h3>
                      <p className="text-sm text-gray-500 font-body line-clamp-2 mb-4 leading-relaxed">
                        {blog.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-400 font-body">
                        <span>{blog.author}</span>
                        <span className="text-brand-green font-semibold flex items-center gap-0.5">
                          Read more <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8 md:hidden">
            <Link to="/blog" className="btn-outline">View All Recipes</Link>
          </div>
        </div>
      </section>}

      {/* ══════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════ */}
      {testimonials.length > 0 && (
      <section className="section-padding bg-brand-green-dark">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-1 bg-white/10 text-green-300 text-sm font-body font-semibold px-4 py-1.5 rounded-full mb-3">
              ⭐ Customer Love
            </span>
            <h2 className="text-3xl md:text-5xl font-body font-black text-white mt-2">
              What Our Customers Say
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.id ?? `${t.name}-${i}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/15 transition-all"
              >
                <div className="flex gap-1 mb-3">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-brand-orange" fill="currentColor" />
                  ))}
                </div>
                <p className="text-green-100 font-body text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-brand-orange/30 flex items-center justify-center text-white font-body font-bold text-sm flex-shrink-0">
                      {t.initial}
                    </div>
                    <div>
                      <div className="font-body font-bold text-white text-sm">{t.name}</div>
                      <div className="text-green-400 text-xs font-body">{t.city}</div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-brand-orange/20 text-brand-orange font-body font-semibold px-2 py-1 rounded-full">
                    {t.product}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ══════════════════════════════════════════
          NEWSLETTER
      ══════════════════════════════════════════ */}
      <section className="section-padding bg-brand-orange">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl md:text-4xl font-body font-black text-white mb-2">
              Get Exclusive Recipes & Offers!
            </h2>
            <p className="text-white/80 font-body mb-8 text-base">
              Subscribe to our newsletter and get 10% off your first order
            </p>
            <form
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="Enter your email address"
                className="flex-1 px-5 py-3.5 rounded-xl font-body text-gray-800 focus:outline-none focus:ring-2 focus:ring-white text-sm"
              />
              <button className="bg-brand-green-dark hover:bg-brand-green text-white px-6 py-3.5 rounded-xl font-body font-bold text-sm transition-colors">
                Subscribe
              </button>
            </form>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
