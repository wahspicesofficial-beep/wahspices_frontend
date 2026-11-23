import { useState } from 'react';
import { Link } from 'react-router-dom';
import { regionThumb, safeColor } from '@/utils/regions';

/** Landmark photo — falls back to the region's colour block if the image can't load. */
function RegionPhoto({ src, alt, credit, color }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return <div className="h-full w-full" style={{ background: `linear-gradient(155deg, ${color}aa 0%, ${color} 100%)` }} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      title={credit || undefined}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The "Every Masala Tells a State's Story" card (same look as the original home cards):
 * landmark photo with a colour tint, landmark badge, masala tag and a coloured info bar.
 */
export default function RegionCard({ region, tabIndex, className = '' }) {
  const color = safeColor(region.accentColor);
  return (
    <Link
      to={`/regions/${region.slug}`}
      tabIndex={tabIndex}
      className={`group block rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-orange/60 ${className}`}
      aria-label={`${region.name}${region.tagline ? ` — ${region.tagline}` : ''}: read the story`}
    >
      <div className="relative h-36 sm:h-40 overflow-hidden">
        <RegionPhoto
          src={regionThumb(region.cardImageUrl || region.heroImageUrl)}
          alt={region.landmark ? `${region.landmark}, ${region.name}` : region.name}
          credit={region.heroImageCredit}
          color={color}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-0 opacity-30 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: color, mixBlendMode: 'color' }} />
        {region.landmark && (
          <div className="absolute top-2 left-2 max-w-[60%] truncate bg-black/40 backdrop-blur-sm text-white text-[10px] font-body font-semibold px-2 py-0.5 rounded-full">
            📍 {region.landmark}
          </div>
        )}
        {region.featuredMasala && (
          <div className="absolute top-2 right-2 max-w-[45%] truncate text-white text-[10px] font-body font-bold px-2 py-0.5 rounded-full shadow" style={{ backgroundColor: color }}>
            {region.featuredMasala}
          </div>
        )}
      </div>
      <div className="px-3 py-3" style={{ backgroundColor: color }}>
        <div className="text-white font-body font-bold text-sm leading-tight truncate">{region.name}</div>
        <div className="text-white/75 text-[11px] font-body mt-0.5 truncate">{region.tagline}</div>
      </div>
    </Link>
  );
}
