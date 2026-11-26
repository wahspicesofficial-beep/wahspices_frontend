import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Bell, MessageCircle } from 'lucide-react';
import { useSiteContent } from '@/content/useSiteContent';

/**
 * Shown wherever a product list is empty because nothing has been added yet (whole store, a category,
 * a sub-category or a region) — "coming soon" instead of a bare "No products found".
 *   name      — what is coming ("Blended Masala"); omit for the whole store
 *   icon      — category emoji, shown on the jar
 *   compact   — smaller version for use inside a section (Home tabs, Regions)
 *   onBrowseAll — when set, the main button calls this instead of linking to /products
 */
export default function ComingSoon({ name, icon, compact = false, onBrowseAll, showBrowseAll = true }) {
  const { settings } = useSiteContent();
  const phone = (settings?.phone || '').replace(/[^\d]/g, '');
  const whatsapp = phone ? `https://wa.me/${phone.length === 10 ? `91${phone}` : phone}?text=${encodeURIComponent(
    name ? `Hi! Please let me know when your ${name} products are available.` : 'Hi! Please let me know when your products are available.'
  )}` : null;

  const title = name ? `${name} — Coming Soon` : 'Our Products Are Coming Soon';
  const text = name
    ? `We're carefully preparing our ${name} range — pure, fresh and full of flavour. It will be here very soon!`
    : "We're grinding, roasting and packing our authentic Indian masalas with love. Our shop opens very soon — stay tuned!";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-3xl border border-brand-green/10 bg-white text-center shadow-card ${compact ? 'px-5 py-10 md:py-12' : 'px-6 py-14 md:py-20'}`}
      role="status"
    >
      {/* soft spice glow */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-brand-orange/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-brand-green/10 blur-3xl" />

      <div className="relative mx-auto max-w-xl">
        <motion.div
          aria-hidden="true"
          animate={{ y: [0, -8, 0], rotate: [0, -3, 3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className={`mx-auto mb-5 flex items-center justify-center rounded-full bg-gradient-to-br from-brand-orange/20 to-brand-green/10 ${compact ? 'h-20 w-20 text-4xl' : 'h-24 w-24 text-5xl md:h-28 md:w-28 md:text-6xl'}`}
        >
          {icon || '🫙'}
        </motion.div>

        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-orange/10 px-4 py-1.5 font-body text-xs font-bold uppercase tracking-widest text-brand-orange">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-orange opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-orange" />
          </span>
          Coming Soon
        </span>

        <h3 className={`font-body font-black text-gray-900 ${compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-4xl'}`}>{title}</h3>
        <p className={`mx-auto mt-3 max-w-md font-body text-gray-500 ${compact ? 'text-sm' : 'text-sm md:text-base'}`}>{text}</p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {name && showBrowseAll && (onBrowseAll ? (
            <button type="button" onClick={onBrowseAll} className="btn-primary gap-2">
              Browse other spices <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <Link to="/products" className="btn-primary gap-2">
              Browse other spices <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-outline gap-2">
              <Bell className="h-4 w-4" /> Notify me on WhatsApp
            </a>
          ) : (
            <Link to="/contact" className="btn-outline gap-2">
              <MessageCircle className="h-4 w-4" /> Contact us
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
