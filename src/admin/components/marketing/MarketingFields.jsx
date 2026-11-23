// Shared pieces for Admin → Marketing (Campaigns + Broadcasts):
// image upload, product picker, audience picker (all / selected customers with filters + live reach count).
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, Loader2, Trash2, Users, UserCheck, X, Search, CheckSquare, Square, Mail, MessageCircle, BellRing } from 'lucide-react';
import api from '@/services/api';
import { getImageUrl } from '@/utils/product';
import { Badge, Button, Field, Segmented, cn } from '@/admin/ui';
import { useLookups } from '@/admin/lookups';
import { errMsg, fmtNum, useDebounced } from './marketingUtils';

/**
 * Like <Field> but a <div> (with role="group"): for compound controls (buttons, lists, several inputs).
 * A <label> wrapper would forward clicks on empty space to its first button.
 */
export function FieldGroup({ label, hint, required, className, children }) {
  return (
    <div role="group" aria-label={label} className={cn('block', className)}>
      {label && (
        <span className="mb-1 block text-[12px] font-bold text-[color:var(--text-secondary)]">
          {label}{required && <span className="text-[color:var(--danger)]"> *</span>}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-[12px] text-[color:var(--text-muted)]">{hint}</span>}
    </div>
  );
}

/** Campaign / broadcast type dropdown from master data (Settings → Master data → Campaign / broadcast types). */
export function TypeSelect({ value, onChange }) {
  const lk = useLookups();
  const items = lk.list('CampaignType');
  return (
    <Field label="Type" required hint="Edit the list in Settings → Master data.">
      <select className="input-field w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        {items.length === 0 && <option value={value}>{value}</option>}
        {items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

/** Image for the message: upload (JPG/PNG/WEBP/GIF ≤ 5 MB) with preview, or remove. Stores "/uploads/marketing/…". */
export function ImageUpload({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { toast.error('Use a JPG, PNG, WEBP or GIF image.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('The image must be 5 MB or smaller.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/admin/marketing/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      onChange(res.data.data.path);
    } catch (err) {
      toast.error(errMsg(err, 'Upload failed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <FieldGroup label="Image" hint="Optional. JPG, PNG, WEBP or GIF up to 5 MB — wide images (e.g. 1200×600) look best.">
      {value ? (
        <div className="relative overflow-hidden rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)]">
          <img src={getImageUrl(value)} alt="" className="block max-h-44 w-full object-contain" />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={busy}>Replace</Button>
            <Button size="sm" variant="danger" onClick={() => onChange('')}><Trash2 className="size-3.5" />Remove</Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-[6px] border border-dashed border-[color:var(--border-strong,#cfc6b4)] bg-[color:var(--surface-secondary)] text-[12px] text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {busy ? 'Uploading…' : 'Upload image'}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" aria-label="Upload image" onChange={(e) => upload(e.target.files?.[0])} />
    </FieldGroup>
  );
}

/** Up to 4 products shown as cards in the email. */
export function ProductPicker({ value = [], onChange }) {
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (value.length === 0) { setSelected([]); return; }
    if (value.every((id) => selected.some((p) => p.id === id)) && selected.length === value.length) return;
    api.get('/admin/marketing/products', { params: { ids: value.join(',') } }).then((r) => setSelected(r.data.data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.join(',')]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    api.get('/admin/marketing/products', { params: { search: q } }).then((r) => setResults(r.data.data || [])).catch(() => setResults([]));
  }, [q]);

  const add = (p) => {
    if (value.includes(p.id) || value.length >= 4) return;
    setSelected((s) => [...s, p]);
    onChange([...value, p.id]);
    setSearch('');
  };
  const remove = (id) => { setSelected((s) => s.filter((p) => p.id !== id)); onChange(value.filter((x) => x !== id)); };

  return (
    <FieldGroup label="Featured products" hint="Optional — up to 4 product cards (email only).">
      <div className="space-y-2">
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-elevated)] py-0.5 pl-1 pr-2 text-[12px]">
                {p.imageUrl && <img src={getImageUrl(p.imageUrl)} alt="" className="size-5 rounded-full object-cover" />}
                {p.name}
                <button type="button" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`} className="text-[color:var(--text-muted)] hover:text-[color:var(--danger)]"><X className="size-3" /></button>
              </span>
            ))}
          </div>
        )}
        {value.length < 4 && (
          <div className="relative">
            <input type="search" className="input-field w-full" aria-label="Search products" placeholder="Search products to feature…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {results.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-lg">
                {results.filter((p) => !value.includes(p.id)).map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => add(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[color:var(--surface-hover)]">
                      {p.imageUrl ? <img src={getImageUrl(p.imageUrl)} alt="" className="size-7 rounded object-cover" /> : <span className="size-7 rounded bg-[color:var(--surface-secondary)]" />}
                      <span className="flex-1 truncate">{p.name} <span className="text-[color:var(--text-muted)]">{p.weight}</span></span>
                      <span className="tabular-nums text-[color:var(--text-muted)]">₹{p.price}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </FieldGroup>
  );
}

/**
 * Audience: "All customers" or hand-picked customers (search + filters, select page / select all results).
 * Shows the live reach per channel from POST /admin/marketing/audience/count.
 * value = { audienceType: 'All'|'Selected', userIds: number[] }
 * channels = which reach numbers to show: ['email','whatsApp'] or ['inApp']
 */
export function AudiencePicker({ value, onChange, channels = ['email'], initialUsers = [] }) {
  const { audienceType, userIds } = value;
  const [count, setCount] = useState(null);
  const [counting, setCounting] = useState(false);
  const ids = useDebounced(userIds, 400);

  useEffect(() => {
    let alive = true;
    setCounting(true);
    api.post('/admin/marketing/audience/count', { audienceType, userIds: audienceType === 'Selected' ? ids : [] })
      .then((r) => { if (alive) setCount(r.data.data); })
      .catch(() => { if (alive) setCount(null); })
      .finally(() => { if (alive) setCounting(false); });
    return () => { alive = false; };
  }, [audienceType, ids]);

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <Segmented
        value={audienceType}
        onChange={(v) => set({ audienceType: v })}
        options={[{ value: 'All', label: 'All customers' }, { value: 'Selected', label: 'Selected customers' }]}
      />
      <ReachSummary count={count} counting={counting} channels={channels} audienceType={audienceType} />
      {audienceType === 'Selected' && <CustomerSelector userIds={userIds} onChange={(next) => set({ userIds: next })} initialUsers={initialUsers} />}
    </div>
  );
}

function ReachSummary({ count, counting, channels, audienceType }) {
  if (!count) return <div className="text-[12px] text-[color:var(--text-muted)]">{counting ? 'Counting recipients…' : ' '}</div>;
  const chip = (icon, label, n, skipped) => (
    <div className="flex min-w-0 items-start gap-2 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3 py-2" key={label}>
      {icon}
      <div className="min-w-0">
        <div className="text-[13px]"><b className="tabular-nums" data-testid={`reach-${label.toLowerCase()}`}>{fmtNum(n)}</b> {label}</div>
        {skipped && Object.keys(skipped).length > 0 && (
          <div className="text-[11px] text-[color:var(--text-muted)]">
            {Object.entries(skipped).map(([k, v]) => `${fmtNum(v)} skipped: ${k.toLowerCase()}`).join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-live="polite">
      {channels.includes('email') && chip(<Mail className="mt-0.5 size-4 text-[color:var(--primary)]" />, 'Email', count.email.reachable, count.email.skipped)}
      {channels.includes('whatsApp') && chip(<MessageCircle className="mt-0.5 size-4 text-[color:var(--success)]" />, 'WhatsApp', count.whatsApp.reachable, count.whatsApp.skipped)}
      {channels.includes('inApp') && chip(<BellRing className="mt-0.5 size-4 text-[color:var(--primary)]" />, 'In-app', count.inApp, null)}
      {audienceType === 'All' && channels.includes('inApp') && (
        <div className="text-[11px] text-[color:var(--text-muted)] sm:col-span-2">
          Customers who sign up later also get it while it is still running (until “Show until”, or for 7 days when there is no end date).
        </div>
      )}
    </div>
  );
}

function CustomerSelector({ userIds, onChange, initialUsers }) {
  const [filters, setFilters] = useState({ search: '', city: '', orderedWithinDays: '', neverOrdered: false });
  const f = useDebounced(filters, 350);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [known, setKnown] = useState(() => Object.fromEntries((initialUsers || []).map((u) => [u.id, u])));
  const selected = new Set(userIds);

  const params = useCallback(() => ({
    search: f.search || undefined, city: f.city || undefined,
    orderedWithinDays: f.orderedWithinDays ? Number(f.orderedWithinDays) : undefined,
    neverOrdered: f.neverOrdered || undefined,
  }), [f]);

  useEffect(() => { setPage(1); }, [f]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get('/admin/marketing/audience/users', { params: { ...params(), page, limit: 10 } })
      .then((r) => {
        if (!alive) return;
        setData(r.data.data);
        setKnown((k) => ({ ...k, ...Object.fromEntries(r.data.data.items.map((u) => [u.id, u])) }));
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params, page]);

  const toggle = (id) => onChange(selected.has(id) ? userIds.filter((x) => x !== id) : [...userIds, id]);
  const pageIds = data.items.map((u) => u.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const togglePage = () => onChange(allPageSelected ? userIds.filter((id) => !pageIds.includes(id)) : [...new Set([...userIds, ...pageIds])]);
  const selectAllResults = async () => {
    try {
      const r = await api.get('/admin/marketing/audience/users', { params: { ...params(), idsOnly: true } });
      onChange([...new Set([...userIds, ...r.data.data.ids])]);
      if (r.data.data.capped) toast('Selection capped at 20,000 customers — use “All customers” for more.');
    } catch (err) { toast.error(errMsg(err, 'Could not select all results')); }
  };
  const setF = (patch) => setFilters((x) => ({ ...x, ...patch }));

  return (
    <div className="rounded-[8px] border border-[color:var(--border)]">
      <div className="grid gap-2 border-b border-[color:var(--border)] p-2.5 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <input type="search" className="input-field w-full pl-8" placeholder="Name, email or phone" value={filters.search} onChange={(e) => setF({ search: e.target.value })} aria-label="Search customers" />
        </div>
        <input type="text" className="input-field w-full" placeholder="City" value={filters.city} onChange={(e) => setF({ city: e.target.value })} aria-label="City" />
        <select className="input-field w-full" value={filters.neverOrdered ? 'never' : filters.orderedWithinDays} aria-label="Order history"
          onChange={(e) => (e.target.value === 'never' ? setF({ neverOrdered: true, orderedWithinDays: '' }) : setF({ neverOrdered: false, orderedWithinDays: e.target.value }))}>
          <option value="">Any order history</option>
          <option value="30">Ordered in last 30 days</option>
          <option value="90">Ordered in last 90 days</option>
          <option value="180">Ordered in last 180 days</option>
          <option value="365">Ordered in last year</option>
          <option value="never">Never ordered</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 text-[12px]">
        <span className="text-[color:var(--text-muted)]">{loading ? 'Loading…' : `${fmtNum(data.total)} match`}</span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="tertiary" onClick={togglePage} disabled={pageIds.length === 0}>
            {allPageSelected ? <CheckSquare className="size-3.5" /> : <Square className="size-3.5" />}This page
          </Button>
          <Button size="sm" variant="secondary" onClick={selectAllResults} disabled={data.total === 0}>Select all {fmtNum(data.total)}</Button>
        </div>
      </div>

      <ul className="max-h-64 overflow-y-auto border-t border-[color:var(--border)]" data-testid="customer-results">
        {data.items.map((u) => (
          <li key={u.id}>
            <label className="flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-[13px] hover:bg-[color:var(--surface-hover)]">
              <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{u.name || '—'}</span>
                <span className="block truncate text-[12px] text-[color:var(--text-muted)]">{u.email} · {u.phone || 'no phone'}{u.city ? ` · ${u.city}` : ''}</span>
              </span>
              <span className="hidden text-right text-[11px] text-[color:var(--text-muted)] sm:block">{u.orders} order{u.orders === 1 ? '' : 's'}</span>
              {u.marketingOptOut ? <Badge tone="warning">Opted out</Badge> : !u.emailOk ? <Badge tone="neutral">No email</Badge> : null}
            </label>
          </li>
        ))}
        {!loading && data.items.length === 0 && <li className="px-3 py-6 text-center text-[12px] text-[color:var(--text-muted)]">No customers match these filters.</li>}
      </ul>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-1.5 border-t border-[color:var(--border)] px-2.5 py-1.5 text-[12px]">
          <Button size="sm" variant="tertiary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span className="tabular-nums">{page} / {data.totalPages}</span>
          <Button size="sm" variant="tertiary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-2.5 py-2">
        <UserCheck className="size-4 text-[color:var(--primary)]" />
        <b className="text-[13px] tabular-nums" data-testid="selected-count">{fmtNum(userIds.length)}</b><span className="text-[13px]">selected</span>
        {userIds.slice(0, 6).map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-elevated)] px-2 py-0.5 text-[11px]">
            {known[id]?.name || `#${id}`}
            <button type="button" onClick={() => toggle(id)} aria-label="Remove" className="text-[color:var(--text-muted)] hover:text-[color:var(--danger)]"><X className="size-3" /></button>
          </span>
        ))}
        {userIds.length > 6 && <span className="text-[11px] text-[color:var(--text-muted)]">+{fmtNum(userIds.length - 6)} more</span>}
        {userIds.length > 0 && <Button size="sm" variant="tertiary" className="ml-auto" onClick={() => onChange([])}><Users className="size-3.5" />Clear</Button>}
      </div>
    </div>
  );
}

/** Small progress bar used in lists. */
export function Progress({ value, total, tone = 'primary' }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-hover)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full', tone === 'danger' ? 'bg-[color:var(--danger)]' : 'bg-[color:var(--primary)]')} style={{ width: `${pct}%` }} />
    </div>
  );
}
