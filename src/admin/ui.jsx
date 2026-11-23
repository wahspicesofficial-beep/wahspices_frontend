// Admin UI kit — modelled on the Axion Options client components
// (Card, Stat, Badge, Button, Tabs, Segmented, data grid + pagination), in WAH colours.
// Styles come from Tailwind utilities + the scoped tokens in admin.css.
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox, Loader2, Search, X } from 'lucide-react';

export const cn = (...parts) => parts.filter(Boolean).join(' ');

/* ── Page header: title + short description on the left, actions on the right ── */
export function PageHeader({ title, description, actions, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight text-[color:var(--text-primary)]">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-[color:var(--text-muted)]">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Card: bordered surface with an optional 40px title bar ── */
export function Card({ title, actions, className, bodyClassName, children, ...props }) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)]', className)} {...props}>
      {(title || actions) && (
        <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-[color:var(--border)] px-3">
          <h2 className="truncate text-[13px] font-bold text-[color:var(--text-primary)]">{title}</h2>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}

/* ── Stat: label-over-value tile ── */
const TONE_TEXT = {
  neutral: 'text-[color:var(--text-primary)]',
  primary: 'text-[color:var(--primary)]',
  accent: 'text-[color:var(--accent-strong)]',
  success: 'text-[color:var(--success)]',
  danger: 'text-[color:var(--danger)]',
  warning: 'text-[color:var(--warning)]',
  info: 'text-[color:var(--info)]',
};
export function Stat({ label, value, hint, icon: Icon, tone = 'neutral', className, loading }) {
  return (
    <div className={cn('min-w-0 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-[12px] text-[color:var(--text-muted)]">{label}</div>
        {Icon && <Icon className={cn('size-4 shrink-0', TONE_TEXT[tone] || TONE_TEXT.neutral)} strokeWidth={1.75} />}
      </div>
      {loading
        ? <Skeleton className="mt-1.5 h-5 w-24" />
        : <div className={cn('mt-0.5 truncate text-[18px] font-bold leading-tight tabular-nums', TONE_TEXT[tone] || TONE_TEXT.neutral)}>{value}</div>}
      {hint && <div className="mt-0.5 truncate text-[12px] text-[color:var(--text-muted)]">{hint}</div>}
    </div>
  );
}

/* ── Badge ── */
const TONE_BADGE = {
  neutral: 'bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)]',
  primary: 'bg-[color:var(--primary-soft)] text-[color:var(--primary)]',
  accent: 'bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]',
  success: 'bg-[color:var(--success-bg)] text-[color:var(--success)]',
  danger: 'bg-[color:var(--danger-bg)] text-[color:var(--danger)]',
  warning: 'bg-[color:var(--warning-bg)] text-[color:var(--warning)]',
  info: 'bg-[color:var(--info-bg)] text-[color:var(--info)]',
};
export function Badge({ tone = 'neutral', className, children, ...props }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-bold leading-[1.3]', TONE_BADGE[tone] || TONE_BADGE.neutral, className)} {...props}>
      {children}
    </span>
  );
}

/** Map common status words to badge tones. */
export function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (/(unpaid|not ?paid|partially)/.test(s)) return 'warning';
  if (/(deliver|paid|complete|success|active|approved|present|in ?stock|received|published|done|verified)/.test(s)) return 'success';
  if (/(cancel|reject|fail|out ?of ?stock|absent|overdue|inactive|blocked|lost|refund)/.test(s)) return 'danger';
  if (/(pending|processing|draft|partial|low|hold|leave|review|unpaid|due)/.test(s)) return 'warning';
  if (/(ship|transit|confirm|packed|dispatch|sent|open|new)/.test(s)) return 'info';
  return 'neutral';
}

/* ── Button ── */
const BTN_VARIANT = {
  primary: 'bg-[color:var(--primary)] text-white border border-[color:var(--primary)] hover:bg-[color:var(--primary-hover)]',
  accent: 'bg-[color:var(--accent)] text-[#2b1a00] border border-[color:var(--accent)] hover:brightness-95',
  secondary: 'bg-[color:var(--surface-elevated)] text-[color:var(--text-primary)] border border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]',
  tertiary: 'bg-transparent text-[color:var(--text-secondary)] border border-transparent hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]',
  danger: 'bg-[color:var(--danger-bg)] text-[color:var(--danger)] border border-[rgba(176,56,47,0.3)] hover:bg-[rgba(176,56,47,0.16)]',
};
const BTN_SIZE = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-9 px-3.5 text-[13px] gap-2', lg: 'h-10 px-4 text-[14px] gap-2' };
export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-[6px] font-bold transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(26,92,46,0.4)] disabled:cursor-not-allowed disabled:opacity-50',
        BTN_VARIANT[variant] || BTN_VARIANT.primary, BTN_SIZE[size] || BTN_SIZE.md, className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* Small square icon button (row actions, toolbars) */
export function IconButton({ label, tone = 'neutral', className, children, ...props }) {
  const tones = {
    neutral: 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]',
    danger: 'text-[color:var(--text-muted)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)]',
    primary: 'text-[color:var(--text-muted)] hover:bg-[color:var(--primary-soft)] hover:text-[color:var(--primary)]',
  };
  return (
    <button type="button" aria-label={label} title={label} className={cn('inline-flex size-7 items-center justify-center rounded-[4px] transition-colors', tones[tone], className)} {...props}>
      {children}
    </button>
  );
}

/* ── Tabs: underline style ── */
export function Tabs({ items, value, onChange, className, trailing }) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-[color:var(--border)]', className)}>
      <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {items.map((item) => {
          const v = item.value ?? item.id;
          const active = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[13px] font-bold transition-colors',
                active ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]',
              )}
            >
              {item.icon && <item.icon className="size-3.5" strokeWidth={1.75} />}
              {item.label}
              {item.count != null && (
                <span className="rounded-[4px] bg-[color:var(--surface-hover)] px-1.5 text-[11px] leading-[16px] text-[color:var(--text-muted)]">{item.count}</span>
              )}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[color:var(--primary)]" />}
            </button>
          );
        })}
      </div>
      {trailing && <div className="ml-auto flex items-center gap-1 pr-1">{trailing}</div>}
    </div>
  );
}

/* ── Segmented: pill single-choice toggle ── */
export function Segmented({ options, value, onChange, size = 'md', className }) {
  return (
    <div className={cn('inline-flex items-center rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-0.5', className)}>
      {options.map((o) => {
        const v = o.value ?? o;
        const label = o.label ?? o;
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'rounded-[4px] px-2.5 font-bold transition-colors',
              size === 'sm' ? 'h-6 text-[12px]' : 'h-7 text-[13px]',
              active ? 'bg-[color:var(--surface-elevated)] text-[color:var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Search box used in table toolbars ── */
export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cn('relative min-w-[200px] flex-1', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] pl-8 pr-8 text-[13px]"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Toolbar: the row above a grid (search, filters, actions) ── */
export function Toolbar({ children, className }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

/* ── Empty state ── */
export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', children, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center" role="status">
      <div className="flex size-10 items-center justify-center rounded-[8px] bg-[color:var(--surface-secondary)] text-[color:var(--text-muted)]">
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <p className="text-[14px] font-bold text-[color:var(--text-primary)]">{title}</p>
      {children && <div className="max-w-md text-[13px] text-[color:var(--text-muted)]">{children}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ className }) {
  return <span className={cn('skeleton', className)} aria-hidden />;
}

/* ── Pagination ── */
export const PAGE_SIZES = [10, 20, 50, 100];

/**
 * Client-side paging for any list.
 *   const pg = usePagination(filtered, 20);
 *   pg.items.map(...)  +  <Pagination {...pg} />
 * Jumps back to page 1 whenever the list's identity (filters/search) changes length.
 */
export function usePagination(list, initialPageSize = 20) {
  const all = Array.isArray(list) ? list : [];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => { setPage(1); }, [total, pageSize]);
  const current = Math.min(page, pages);
  const items = useMemo(() => all.slice((current - 1) * pageSize, current * pageSize), [all, current, pageSize]);

  return { items, page: current, pages, total, pageSize, setPage, setPageSize };
}

/** "Showing 1–20 of 87 · Rows [20] · « ‹ 1 2 3 › »" */
export function Pagination({ page, pages, total, pageSize, setPage, setPageSize, className, noun = 'rows' }) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // Compact page list: 1 … 4 5 6 … 12
  const nums = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  const navBtn = 'inline-flex size-8 items-center justify-center rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 px-1 pt-2.5', className)}>
      <div className="flex items-center gap-3 text-[13px] text-[color:var(--text-muted)]">
        <span className="tabular-nums">Showing <b className="text-[color:var(--text-primary)]">{from}–{to}</b> of <b className="text-[color:var(--text-primary)]">{total}</b> {noun}</span>
        {setPageSize && (
          <label className="hidden items-center gap-1.5 sm:flex">
            Rows
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-8 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-2 text-[13px]">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={navBtn} onClick={() => setPage(1)} disabled={page === 1} aria-label="First page"><ChevronsLeft className="size-3.5" /></button>
          <button type="button" className={navBtn} onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft className="size-3.5" /></button>
          {nums.map((n, i) => n === '…'
            ? <span key={`e${i}`} className="px-1 text-[13px] text-[color:var(--text-muted)]">…</span>
            : (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === page ? 'page' : undefined}
                className={cn('inline-flex h-8 min-w-8 items-center justify-center rounded-[6px] px-2 text-[13px] font-bold tabular-nums transition-colors',
                  n === page ? 'bg-[color:var(--primary)] text-white' : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]')}
              >
                {n}
              </button>
            ))}
          <button type="button" className={navBtn} onClick={() => setPage(page + 1)} disabled={page === pages} aria-label="Next page"><ChevronRight className="size-3.5" /></button>
          <button type="button" className={navBtn} onClick={() => setPage(pages)} disabled={page === pages} aria-label="Last page"><ChevronsRight className="size-3.5" /></button>
        </div>
      )}
    </div>
  );
}

/* ── Modal shell content: header / body / footer pieces for dialogs ── */
export function DialogPanel({ title, onClose, children, footer, width = 'max-w-lg', className }) {
  return (
    <div onClick={(e) => e.stopPropagation()} className={cn('relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl', width, className)}>
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
        <span className="text-[15px] font-bold text-[color:var(--text-primary)]">{title}</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-[4px] p-1 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]">
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      {footer && <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-4 py-3">{footer}</div>}
    </div>
  );
}

/* Form field wrapper: label + control + error/hint */
export function Field({ label, hint, error, required, className, children }) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="mb-1 block text-[12px] font-bold text-[color:var(--text-secondary)]">
          {label}{required && <span className="text-[color:var(--danger)]"> *</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-[12px] text-[color:var(--danger)]">{error}</span>
        : hint ? <span className="mt-1 block text-[12px] text-[color:var(--text-muted)]">{hint}</span> : null}
    </label>
  );
}
