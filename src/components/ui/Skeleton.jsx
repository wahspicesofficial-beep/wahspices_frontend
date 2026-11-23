// Reusable skeleton primitives for loading states across admin + client pages

// ── Base shimmer block ─────────────────────────────────────────────────────────
export function Sk({ className = '' }) {
  return <div className={`sk ${className}`} />;
}

// ── Text line ─────────────────────────────────────────────────────────────────
export function SkText({ w = 'w-full', h = 'h-3.5', className = '' }) {
  return <div className={`sk ${w} ${h} ${className}`} />;
}

// ── Admin KPI card row ────────────────────────────────────────────────────────
export function SkKpiCards({ count = 4, cols = 4 }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 shadow-card space-y-3">
          <div className="flex items-start justify-between">
            <div className="sk w-10 h-10 rounded-xl" />
            <div className="sk w-14 h-5 rounded-full" />
          </div>
          <div className="sk w-24 h-7 rounded-lg" />
          <div className="sk w-32 h-3.5 rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Admin table skeleton ──────────────────────────────────────────────────────
export function SkTable({ rows = 6, cols = 5 }) {
  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      {/* header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="sk w-32 h-5 rounded" />
        <div className="sk w-24 h-8 rounded-xl" />
      </div>
      {/* filter bar */}
      <div className="px-6 py-3 border-b border-gray-50 flex gap-3">
        <div className="sk flex-1 h-9 rounded-xl" />
        <div className="sk w-28 h-9 rounded-xl" />
        <div className="sk w-28 h-9 rounded-xl" />
      </div>
      {/* table head */}
      <div className="px-6 py-3 bg-gray-50 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="sk flex-1 h-3 rounded" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-6 py-4 border-b border-gray-50 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={`sk flex-1 rounded ${c === 0 ? 'h-4 w-20' : 'h-3'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Admin card list (for staff, CRM, etc.) ────────────────────────────────────
export function SkCardList({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 shadow-card flex items-center gap-4">
          <div className="sk w-12 h-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="sk w-36 h-4 rounded" />
            <div className="sk w-48 h-3 rounded" />
          </div>
          <div className="sk w-20 h-7 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// ── Admin charts section (bar chart + card side) ──────────────────────────────
export function SkChart() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="sk w-40 h-5 rounded" />
            <div className="sk w-24 h-3.5 rounded" />
          </div>
          <div className="sk w-20 h-7 rounded" />
        </div>
        {/* fake bars */}
        <div className="flex items-end gap-1.5 h-40">
          {[60, 40, 75, 55, 80, 45, 90, 65, 50, 70, 85, 40].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="sk w-full rounded-t-lg" style={{ height: `${h}%` }} />
              <div className="sk w-4 h-2 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-card space-y-4">
        <div className="sk w-36 h-5 rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="sk w-7 h-7 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="sk w-full h-3.5 rounded" />
              <div className="sk w-3/4 h-2.5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page header (title + subtitle) ───────────────────────────────────────────
export function SkPageHeader() {
  return (
    <div className="space-y-2">
      <div className="sk w-48 h-7 rounded-lg" />
      <div className="sk w-72 h-4 rounded" />
    </div>
  );
}

// ── Admin tabs + content ──────────────────────────────────────────────────────
export function SkTabs({ tabCount = 3, contentRows = 6 }) {
  return (
    <div className="space-y-5">
      {/* tab bar */}
      <div className="flex gap-2">
        {Array.from({ length: tabCount }).map((_, i) => (
          <div key={i} className={`sk h-9 rounded-xl ${i === 0 ? 'w-28' : 'w-24'}`} />
        ))}
      </div>
      <SkTable rows={contentRows} />
    </div>
  );
}

// ── Client product card skeleton ──────────────────────────────────────────────
export function SkProductCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-card">
      <div className="sk w-full aspect-square" />
      <div className="p-4 space-y-2.5">
        <div className="sk w-3/4 h-4 rounded" />
        <div className="sk w-1/2 h-3.5 rounded" />
        <div className="flex items-center justify-between mt-3">
          <div className="sk w-20 h-5 rounded" />
          <div className="sk w-9 h-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ── Client product grid ───────────────────────────────────────────────────────
export function SkProductGrid({ count = 8, cols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' }) {
  return (
    <div className={`grid ${cols} gap-4 lg:gap-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkProductCard key={i} />
      ))}
    </div>
  );
}

// ── Product detail skeleton ───────────────────────────────────────────────────
export function SkProductDetail() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* breadcrumb */}
      <div className="flex gap-2 mb-6">
        <div className="sk w-12 h-3 rounded" />
        <div className="sk w-3 h-3 rounded" />
        <div className="sk w-20 h-3 rounded" />
        <div className="sk w-3 h-3 rounded" />
        <div className="sk w-28 h-3 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* image */}
        <div className="space-y-3">
          <div className="sk w-full aspect-square rounded-3xl" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="sk aspect-square rounded-xl" />
            ))}
          </div>
        </div>
        {/* info */}
        <div className="space-y-4">
          <div className="sk w-3/4 h-8 rounded-lg" />
          <div className="sk w-32 h-5 rounded" />
          <div className="sk w-48 h-7 rounded-lg" />
          <div className="space-y-2">
            <div className="sk w-full h-3.5 rounded" />
            <div className="sk w-full h-3.5 rounded" />
            <div className="sk w-5/6 h-3.5 rounded" />
          </div>
          <div className="sk w-40 h-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ── Cart skeleton ─────────────────────────────────────────────────────────────
export function SkCart({ items = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 flex gap-4 shadow-card">
          <div className="sk w-20 h-20 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="sk w-2/3 h-4 rounded" />
            <div className="sk w-24 h-3.5 rounded" />
            <div className="flex items-center justify-between mt-2">
              <div className="sk w-24 h-8 rounded-xl" />
              <div className="sk w-16 h-5 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Order history list ────────────────────────────────────────────────────────
export function SkOrderHistory({ count = 4 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div className="sk w-28 h-4 rounded" />
            <div className="sk w-20 h-6 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <div className="sk w-16 h-3 rounded" />
              <div className="sk w-24 h-4 rounded" />
            </div>
            <div className="space-y-1.5">
              <div className="sk w-16 h-3 rounded" />
              <div className="sk w-20 h-4 rounded" />
            </div>
            <div className="space-y-1.5">
              <div className="sk w-16 h-3 rounded" />
              <div className="sk w-18 h-4 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Blog card grid ────────────────────────────────────────────────────────────
export function SkBlogGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-card">
          <div className="sk w-full h-48" />
          <div className="p-5 space-y-3">
            <div className="sk w-20 h-5 rounded-full" />
            <div className="sk w-full h-5 rounded" />
            <div className="sk w-4/5 h-5 rounded" />
            <div className="space-y-2">
              <div className="sk w-full h-3.5 rounded" />
              <div className="sk w-5/6 h-3.5 rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div className="sk w-24 h-3.5 rounded" />
              <div className="sk w-16 h-3.5 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Profile / form skeleton ───────────────────────────────────────────────────
export function SkForm({ fields = 6 }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-card space-y-5">
      <div className="sk w-40 h-5 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="sk w-24 h-3.5 rounded" />
            <div className="sk w-full h-10 rounded-xl" />
          </div>
        ))}
      </div>
      <div className="sk w-32 h-10 rounded-xl" />
    </div>
  );
}

// ── Track order timeline skeleton ─────────────────────────────────────────────
export function SkTimeline({ steps = 4 }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: steps }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="sk w-10 h-10 rounded-full flex-shrink-0" />
            {i < steps - 1 && <div className="sk w-0.5 h-12 rounded" />}
          </div>
          <div className="pb-8 space-y-1.5 pt-2">
            <div className="sk w-32 h-4 rounded" />
            <div className="sk w-48 h-3.5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Admin analytics skeleton ──────────────────────────────────────────────────
export function SkAnalytics() {
  return (
    <div className="space-y-6">
      <SkKpiCards count={4} cols={4} />
      <SkChart />
      <SkTable rows={5} cols={5} />
    </div>
  );
}

// ── Generic full-page admin skeleton ─────────────────────────────────────────
export function SkAdminPage({ showTabs = false, showChart = false, tableRows = 6, tableCols = 5 }) {
  return (
    <div className="space-y-6">
      <SkPageHeader />
      {showTabs && (
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`sk h-9 rounded-xl ${i === 0 ? 'w-28' : 'w-24'}`} />
          ))}
        </div>
      )}
      {showChart && <SkChart />}
      <SkTable rows={tableRows} cols={tableCols} />
    </div>
  );
}
