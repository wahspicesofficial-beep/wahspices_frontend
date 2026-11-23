import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Star, MessageSquare, Clock, CheckCircle2, XCircle, Award, Trash2, Send, RefreshCw, Eye, ThumbsUp } from 'lucide-react';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, Segmented, SearchInput, Toolbar, EmptyState, Skeleton,
  Pagination, DialogPanel, Field,
} from '@/admin/ui';

const errMsg = (err, fallback) => err?.response?.data?.error?.message || fallback;
const STATUS_TONE = { Pending: 'warning', Approved: 'success', Rejected: 'danger' };
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function Stars({ n, size = 'size-3.5' }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={size} fill={i <= n ? '#f5a623' : 'none'} stroke={i <= n ? '#f5a623' : '#cbd5e1'} />
      ))}
    </span>
  );
}

/** Shared actions (used by the row buttons and the dialog). Each returns the updated row or null. */
function useFeedbackActions(onDone) {
  const [busy, setBusy] = useState(null);
  const run = async (tag, fn, okMsg) => {
    setBusy(tag);
    try {
      const res = await fn();
      toast.success(res.data?.message || okMsg);
      onDone(res.data?.data, tag);
      return res.data?.data;
    } catch (err) {
      toast.error(errMsg(err, 'Action failed'));
      return null;
    } finally { setBusy(null); }
  };
  return {
    busy,
    setStatus: (f, status) => run(status, () => api.patch(`/admin/feedback/${f.id}/status`, { status }), `Feedback ${status.toLowerCase()}`),
    feature: (f, featured) => run('feature', () => api.patch(`/admin/feedback/${f.id}/feature`, { featured }), featured ? 'Featured' : 'Unfeatured'),
    reply: (f, message) => run('reply', () => api.post(`/admin/feedback/${f.id}/reply`, { message }), 'Reply sent'),
    remove: (f) => run('delete', () => api.delete(`/admin/feedback/${f.id}`), 'Feedback deleted'),
  };
}

function FeedbackDialog({ fb, statuses, onClose, onChanged, onDeleted }) {
  const [reply, setReply] = useState('');
  const actions = useFeedbackActions((row, tag) => {
    if (tag === 'delete') onDeleted(fb.id);
    else if (row) { onChanged(row); if (tag === 'reply') setReply(''); }
  });
  const { busy } = actions;

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={<span className="flex items-center gap-2">Feedback from {fb.name || 'Anonymous'} <Badge tone={STATUS_TONE[fb.status]}>{fb.status}</Badge>{fb.isFeatured && <Badge tone="accent"><Award className="size-3" />Testimonial</Badge>}</span>}
        onClose={onClose}
        width="max-w-2xl"
        footer={(
          <>
            <Button variant="danger" size="sm" className="mr-auto" loading={busy === 'delete'}
              onClick={() => { if (window.confirm('Delete this feedback? This cannot be undone.')) actions.remove(fb); }}>
              <Trash2 className="size-3.5" />Delete
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
            {fb.email && (
              <Button size="sm" loading={busy === 'reply'} onClick={() => (reply.trim().length < 2 ? toast.error('Write a reply first') : actions.reply(fb, reply.trim()))}>
                <Send className="size-3.5" />Send reply
              </Button>
            )}
          </>
        )}
      >
        <div className="space-y-4 text-[13px]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div><div className="text-[12px] text-[color:var(--text-muted)]">Rating</div><Stars n={fb.rating} size="size-4" /></div>
            <div><div className="text-[12px] text-[color:var(--text-muted)]">Received</div>{fmt(fb.createdAt)}</div>
            <div><div className="text-[12px] text-[color:var(--text-muted)]">Product</div>{fb.product || '—'}</div>
            <div><div className="text-[12px] text-[color:var(--text-muted)]">Would recommend</div>{fb.recommend || '—'}</div>
            <div><div className="text-[12px] text-[color:var(--text-muted)]">Email</div>{fb.email ? <a className="text-[color:var(--primary)] hover:underline" href={`mailto:${fb.email}`}>{fb.email}</a> : '—'}</div>
            <div><div className="text-[12px] text-[color:var(--text-muted)]">Customer account</div>{fb.userId ? `#${fb.userId}` : 'Guest'}</div>
          </div>
          <div className="whitespace-pre-wrap rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-3 leading-relaxed">{fb.message}</div>

          <div className="flex flex-wrap items-center gap-1.5">
            {statuses.map((s) => (
              <Button key={s} size="sm" variant={fb.status === s ? 'primary' : 'secondary'} disabled={fb.status === s} loading={busy === s} onClick={() => actions.setStatus(fb, s)}>
                {s === 'Approved' ? 'Approve' : s === 'Rejected' ? 'Reject' : 'Mark pending'}
              </Button>
            ))}
            <Button size="sm" variant={fb.isFeatured ? 'accent' : 'secondary'} loading={busy === 'feature'} onClick={() => actions.feature(fb, !fb.isFeatured)}>
              <Award className="size-3.5" />{fb.isFeatured ? 'Remove from testimonials' : 'Feature as testimonial'}
            </Button>
          </div>
          <p className="text-[12px] text-[color:var(--text-muted)]">Featured feedback appears in “What Our Customers Say” on the home page (featuring also approves it).</p>

          {fb.adminReply && (
            <div className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--success-bg)] p-3">
              <div className="mb-1 text-[12px] font-bold text-[color:var(--success)]">Replied {fmt(fb.repliedAt)}{fb.repliedBy ? ` by ${fb.repliedBy}` : ''}</div>
              <div className="whitespace-pre-wrap">{fb.adminReply}</div>
            </div>
          )}
          {fb.email ? (
            <Field label={fb.adminReply ? 'Send another reply' : 'Reply by email'} hint={`Emailed to ${fb.email}.`}>
              <textarea className="input-field w-full" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Thank you for your kind words…" />
            </Field>
          ) : (
            <p className="text-[12px] text-[color:var(--text-muted)]">No email address was given, so a reply can’t be sent.</p>
          )}
        </div>
      </DialogPanel>
    </AdminModal>
  );
}

export default function AdminFeedback() {
  const [status, setStatus] = useState('all');
  const [rating, setRating] = useState('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1, stats: null, statuses: ['Pending', 'Approved', 'Rejected'] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const reqId = useRef(0);
  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await api.get('/admin/feedback', {
        params: { status, rating: rating === 'all' ? undefined : rating, featured: featuredOnly ? true : undefined, search: q || undefined, page, limit: pageSize },
      });
      if (id === reqId.current) setData(res.data.data);
    } catch (err) {
      if (id === reqId.current) toast.error(errMsg(err, 'Failed to load feedback'));
    } finally { if (id === reqId.current) setLoading(false); }
  }, [status, rating, featuredOnly, q, page, pageSize]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q]);
  const withReset = (fn) => (v) => { fn(v); setPage(1); };

  const rowActions = useFeedbackActions(() => load());
  const st = data.stats || {};
  const statuses = data.statuses || [];
  const statLoading = loading && !data.stats;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feedback"
        description="Feedback from the website’s Share Your Feedback page. Approve, reply, and feature the best as home-page testimonials."
        actions={<Button variant="secondary" onClick={load} loading={loading}><RefreshCw className="size-4" />Refresh</Button>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Average rating" value={st.total ? `${Number(st.avgRating).toFixed(1)} ★` : '—'} icon={Star} tone="accent" loading={statLoading} hint={st.total ? `from ${st.total} reviews` : undefined} />
        <Stat label="Total feedback" value={st.total ?? 0} icon={MessageSquare} loading={statLoading} />
        <Stat label="Pending" value={st.pending ?? 0} icon={Clock} tone="warning" loading={statLoading} />
        <Stat label="Approved" value={st.approved ?? 0} icon={CheckCircle2} tone="success" loading={statLoading} />
        <Stat label="Featured" value={st.featured ?? 0} icon={Award} tone="primary" loading={statLoading} hint="on the home page" />
        <Stat label="Would recommend" value={st.total ? `${st.recommendPct}%` : '—'} icon={ThumbsUp} tone="info" loading={statLoading} />
      </div>

      {st.total > 0 && (
        <Card title="Rating breakdown" bodyClassName="p-3">
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((r) => {
              const n = st.ratings?.[r] ?? 0;
              const pct = st.total ? Math.round((n / st.total) * 100) : 0;
              return (
                <button key={r} type="button" onClick={() => { setRating(String(r)); setPage(1); }} className="flex w-full items-center gap-2 text-[12px]">
                  <span className="w-8 text-right tabular-nums">{r} ★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
                    <span className="block h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-14 text-left tabular-nums text-[color:var(--text-muted)]">{n} · {pct}%</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card bodyClassName="p-3">
        <Tabs
          className="mb-3"
          value={status}
          onChange={withReset(setStatus)}
          items={[{ value: 'all', label: 'All', count: st.total ?? 0 }, ...statuses.map((s) => ({ value: s, label: s, count: st[s.toLowerCase()] ?? 0 }))]}
        />
        <Toolbar className="mb-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, product or message…" />
          <Segmented size="sm" value={rating} onChange={withReset(setRating)} options={[{ value: 'all', label: 'All ★' }, ...[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r}★` }))]} />
          <label className="inline-flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={featuredOnly} onChange={(e) => { setFeaturedOnly(e.target.checked); setPage(1); }} />
            Featured only
          </label>
        </Toolbar>

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr><th>Received</th><th>Customer</th><th>Rating</th><th>Product</th><th>Feedback</th><th>Status</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {loading && !data.items.length && [1, 2, 3].map((i) => (
                <tr key={i}>{[1, 2, 3, 4, 5, 6, 7].map((j) => <td key={j}><Skeleton className="block h-4 w-full" /></td>)}</tr>
              ))}
              {data.items.map((f) => (
                <tr key={f.id} className="cursor-pointer" onClick={() => setSelected(f)}>
                  <td className="whitespace-nowrap">{fmt(f.createdAt)}</td>
                  <td><div className="font-bold">{f.name || 'Anonymous'}</div><div className="text-[12px] text-[color:var(--text-muted)]">{f.email || (f.userId ? `Customer #${f.userId}` : 'Guest')}</div></td>
                  <td className="whitespace-nowrap"><Stars n={f.rating} /></td>
                  <td>{f.product || '—'}</td>
                  <td className="max-w-[320px]"><div className="truncate">{f.message}</div>{f.adminReply && <div className="text-[11px] text-[color:var(--success)]">Replied {fmt(f.repliedAt)}</div>}</td>
                  <td className="whitespace-nowrap">
                    <Badge tone={STATUS_TONE[f.status]}>{f.status}</Badge>
                    {f.isFeatured && <Badge tone="accent" className="ml-1"><Award className="size-3" />Featured</Badge>}
                  </td>
                  <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <IconButton label="Open" tone="primary" onClick={() => setSelected(f)}><Eye className="size-3.5" /></IconButton>
                    {f.status !== 'Approved' && <IconButton label="Approve" tone="primary" onClick={() => rowActions.setStatus(f, 'Approved')}><CheckCircle2 className="size-3.5" /></IconButton>}
                    {f.status !== 'Rejected' && <IconButton label="Reject" tone="danger" onClick={() => rowActions.setStatus(f, 'Rejected')}><XCircle className="size-3.5" /></IconButton>}
                    <IconButton label={f.isFeatured ? 'Remove from testimonials' : 'Feature as testimonial'} tone="primary" onClick={() => rowActions.feature(f, !f.isFeatured)}>
                      <Award className="size-3.5" fill={f.isFeatured ? 'currentColor' : 'none'} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !data.items.length && (
          <EmptyState icon={MessageSquare} title={q || status !== 'all' || rating !== 'all' || featuredOnly ? 'No feedback matches' : 'No feedback yet'}>
            {q || status !== 'all' || rating !== 'all' || featuredOnly ? 'Try a different filter or search.' : 'Feedback sent from the website will appear here.'}
          </EmptyState>
        )}
        <Pagination page={page} pages={Math.max(1, data.totalPages || 1)} total={data.total || 0} pageSize={pageSize} setPage={setPage} setPageSize={withReset(setPageSize)} noun="feedback" />
      </Card>

      {selected && (
        <FeedbackDialog
          fb={selected}
          statuses={statuses}
          onClose={() => setSelected(null)}
          onChanged={(row) => { setSelected(row); load(); }}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
