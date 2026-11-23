import { memo, useEffect, useMemo, useRef, useState } from 'react';
import INDIA_MAP from '@/data/indiaMap';
import { safeColor, tint } from '@/utils/regions';

const [, , VB_W, VB_H] = INDIA_MAP.viewBox.split(' ').map(Number);
const BASE_FILL = '#efe4cf';      // states without a story (brand cream-dark family)
const BASE_HOVER = '#e6d6b8';
const SMALL = 14;                 // units smaller than this (viewBox px) also get a dot so they can be seen / hit

/**
 * Interactive India map (36 states & UTs, current boundaries).
 *  • States with a published story are tinted in their accent colour; the selected one is solid with a pulse dot.
 *  • Hover / keyboard focus shows a tooltip; Enter / Space / click selects a story state (onSelect).
 *  • States without a story show "story coming soon" (on tap too) and are not selectable.
 * Story states are in the tab order; the page also offers a dropdown as an alternative to the map.
 */
function IndiaMap({ regions, selectedId, onSelect, className = '' }) {
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);   // { id, pinned }
  // A "coming soon" message opened by a tap/click fades away on its own
  useEffect(() => {
    if (!tip?.pinned) return undefined;
    const t = setTimeout(() => setTip((cur) => (cur === tip ? null : cur)), 2600);
    return () => clearTimeout(t);
  }, [tip]);
  const byMap = useMemo(() => {
    const m = new Map();
    (regions || []).forEach((r) => { if (r.mapStateId && !m.has(r.mapStateId)) m.set(r.mapStateId, r); });
    return m;
  }, [regions]);

  const selected = INDIA_MAP.locations.find((l) => l.id === selectedId);
  const selectedRegion = byMap.get(selectedId);
  const tipLoc = tip && INDIA_MAP.locations.find((l) => l.id === tip.id);
  const tipRegion = tip && byMap.get(tip.id);

  const choose = (loc) => {
    const r = byMap.get(loc.id);
    if (r) { setTip(null); onSelect?.(r); } else setTip({ id: loc.id, pinned: true });
  };
  const onKey = (e, loc) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(loc); }
    if (e.key === 'Escape') setTip(null);
  };

  const fillOf = (loc, hovered) => {
    const r = byMap.get(loc.id);
    if (!r) return hovered ? BASE_HOVER : BASE_FILL;
    const c = safeColor(r.accentColor);
    if (loc.id === selectedId) return c;
    return hovered ? tint(c, 0.25) : tint(c, 0.55);
  };

  // Tooltip position (percent of the map box) from the state's label point
  const tipStyle = tipLoc ? {
    left: `${Math.min(88, Math.max(12, (tipLoc.c[0] / VB_W) * 100))}%`,
    top: `${(tipLoc.c[1] / VB_H) * 100}%`,
  } : null;

  return (
    <div ref={wrap} className={`relative select-none ${className}`} onMouseLeave={() => setTip((t) => (t?.pinned ? t : null))}>
      <style>{`
        .wah-map-state{transition:fill .35s ease, stroke-width .2s ease; stroke:#fff; stroke-width:.8; outline:none}
        .wah-map-state.has-story{cursor:pointer}
        .wah-map-state:focus-visible{stroke:#0f3d1e; stroke-width:2.2}
        @keyframes wahMapPulse{0%{r:4;opacity:.9}100%{r:16;opacity:0}}
        .wah-map-pulse{animation:wahMapPulse 1.8s ease-out infinite}
        @media (prefers-reduced-motion: reduce){.wah-map-state{transition:none}.wah-map-pulse{animation:none;opacity:0}}
      `}</style>
      <svg viewBox={INDIA_MAP.viewBox} className="block h-auto w-full" role="group" aria-label="Map of India — states with a spice story are highlighted">
        {INDIA_MAP.locations.map((loc) => {
          const r = byMap.get(loc.id);
          const hovered = tip?.id === loc.id;
          const label = r ? `${r.name}${r.tagline ? ` — ${r.tagline}` : ''}${loc.id === selectedId ? ' (selected)' : ''}` : `${loc.name}: story coming soon`;
          const handlers = {
            onMouseEnter: () => setTip({ id: loc.id, pinned: false }),
            onFocus: () => setTip({ id: loc.id, pinned: false }),
            onBlur: () => setTip((t) => (t?.id === loc.id ? null : t)),
            onClick: () => choose(loc),
            onKeyDown: (e) => onKey(e, loc),
          };
          return (
            <g key={loc.id}>
              {loc.path && (
                <path
                  d={loc.path}
                  className={`wah-map-state${r ? ' has-story' : ''}`}
                  fill={fillOf(loc, hovered)}
                  tabIndex={r ? 0 : undefined}
                  role={r ? 'button' : undefined}
                  aria-label={r ? label : undefined}
                  aria-pressed={r ? loc.id === selectedId : undefined}
                  {...handlers}
                >
                  <title>{label}</title>
                </path>
              )}
              {(loc.s < SMALL || !loc.path) && (
                <circle cx={loc.c[0]} cy={loc.c[1]} r={r ? 4.5 : 3} fill={fillOf(loc, hovered)} stroke={r ? '#fff' : '#cdb994'} strokeWidth="1"
                  className={r ? 'cursor-pointer' : ''} {...handlers} aria-hidden="true" />
              )}
            </g>
          );
        })}
        {/* Selected state drawn again on top so its outline isn't hidden by neighbours */}
        {selected?.path && (
          <path d={selected.path} fill="none" stroke="#0f3d1e" strokeWidth="1.6" pointerEvents="none" aria-hidden="true" />
        )}
        {selected && (
          <g pointerEvents="none" aria-hidden="true">
            <circle className="wah-map-pulse" cx={selected.c[0]} cy={selected.c[1]} r="4" fill={safeColor(selectedRegion?.accentColor)} />
            <circle cx={selected.c[0]} cy={selected.c[1]} r="4" fill="#fff" stroke={safeColor(selectedRegion?.accentColor)} strokeWidth="2.5" />
          </g>
        )}
      </svg>

      {tipLoc && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-xl bg-gray-900/90 px-3 py-2 text-center font-body text-white shadow-xl backdrop-blur-sm"
          style={tipStyle}
        >
          <div className="text-[13px] font-bold leading-tight">{tipRegion ? tipRegion.name : tipLoc.name}</div>
          <div className="mt-0.5 text-[11px] text-white/75">
            {tipRegion ? (tipRegion.mapStateId === selectedId ? 'You are here' : tipRegion.tagline || 'Read the story') : 'Story coming soon ✨'}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(IndiaMap);
