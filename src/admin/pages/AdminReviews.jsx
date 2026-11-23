import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Star, Check, X, MessageSquare, Trash2, Clock, BadgeCheck, MessageSquareText, RefreshCw, Home } from 'lucide-react';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, SearchInput, Toolbar, EmptyState, Skeleton,
  Pagination, DialogPanel, Field, statusTone,
} from '@/admin/ui';

const errMsg = (err, fallback) => err?.response?.data?.error?.message || fallback;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const STATUS_TABS = ['Pending', 'Approved', 'Rejected', 'all'];

function StarRow({ value }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className="size-3.5" fill={n <= value ? '#f5a623' : 'none'} stroke={n <= value ? '#f5a623' : '#cbd5e1'} />
      ))}
    </span>
  );
}

export default function AdminReviews() {
  const [status, setStatus] = useState('Pending');
  const [rating, setRating] = useState('');
  const [productId, setProductId] = useState('');
  const [verified, setVerified] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // { kind: 'reject'|'reply'|'delete', ids, review }
  const [text, setText] = useState('');

  // Debounce the search box
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [status, rating, productId, verified, q, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status, page, limit: pageSize };
      if (rating) params.rating = rating;
      if (productId) params.productId = productId;
      if (verified) params.verified = verified;
      if (q) params.search = q;
      const res = await api.get('/admin/reviews', { params });
      const d = res.data.data;
      setRows(d.items || []);
      setTotal(d.pagination?.total ?? 0);
      setSummary(d.summary || null);
      setSelected(new Set());
    } catch (err) {
      toast.error(errMsg(err, 'Failed to load reviews'));
    } finally {
      setLoading(false);
    }
  }, [status, rating, productId, verified, q, page, pageSize]);

  const loadProducts = useCallback(() => {
    api.get('/admin/reviews/products').then((r) => setProducts(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const refresh = () => { load(); loadProducts(); };
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const run = async (fn, okFallback) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(res.data?.message || okFallback);
      setDialog(null);
      setText('');
      refresh();
      return true;
    } catch (err) {
      toast.error(errMsg(err, 'Action failed'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleFeature = (r) => run(() => api.put(`/admin/reviews/${r.id}/feature`, { featured: !r.isFeatured }),
    r.isFeatured ? 'Removed from the home page' : 'Shown on the home page');

  const approve = (ids) => run(
    () => (ids.length === 1 ? api.put(`/admin/reviews/${ids[0]}/approve`) : api.post('/admin/reviews/bulk', { ids, action: 'approve' })),
    'Approved',
  );
  const confirmDialog = () => {
    const { kind, ids, review } = dialog;
    if (kind === 'reject') {
      if (!text.trim()) { toast.error('Please give a reason for rejecting.'); return; }
      return run(() => (ids.length === 1
        ? api.put(`/admin/reviews/${ids[0]}/reject`, { reason: text.trim() })
        : api.post('/admin/reviews/bulk', { ids, action: 'reject', reason: text.trim() })), 'Rejected');
    }
    if (kind === 'reply') return run(() => api.put(`/admin/reviews/${review.id}/reply`, { reply: text.trim() }), 'Reply saved');
    if (kind === 'delete') {
      return run(() => (ids.length === 1 ? api.delete(`/admin/reviews/${ids[0]}`) : api.post('/admin/reviews/bulk', { ids, action: 'delete' })), 'Deleted');
    }
    return null;
  };

  const toggleAuto = async () => {
    const next = !summary?.autoApproveVerified;
    try {
      const res = await api.put('/admin/reviews/settings', { autoApproveVerified: next });
      setSummary((s) => ({ ...(s || {}), autoApproveVerified: res.data.data?.autoApproveVerified ?? next }));
      toast.success(res.data.message || 'Saved');
    } catch (err) {
      toast.error(errMsg(err, 'Could not save the setting'));
    }
  };

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selIds = [...selected];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reviews"
        description="Approve customer reviews before they appear on product pages. Ratings use approved reviews only. Use the home icon to pin a review to “What Our Customers Say” on the home page (the latest approved 4–5★ reviews fill any empty spots automatically)."
        actions={<Button variant="secondary" onClick={refresh}><RefreshCw className="size-4" /> Refresh</Button>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Pending approval" value={summary?.pending ?? 0} icon={Clock} tone="warning" loading={!summary && loading} />
        <Stat label="Average rating" value={summary?.approved ? `${Number(summary.averageRating).toFixed(1)} ★` : '—'} hint={`${summary?.approved ?? 0} approved`} icon={Star} tone="accent" loading={!summary && loading} />
        <Stat label="Approved" value={summary?.approved ?? 0} icon={Check} tone="success" loading={!summary && loading} />
        <Stat label="Rejected" value={summary?.rejected ?? 0} icon={X} tone="danger" loading={!summary && loading} />
        <Stat label="Verified purchases" value={summary?.verified ?? 0} hint={`${summary?.newThisWeek ?? 0} new this week`} icon={BadgeCheck} tone="info" loading={!summary && loading} />
      </div>

      <Card bodyClassName="p-3 space-y-3">
        <Tabs
          items={STATUS_TABS.map((s) => ({
            value: s,
            label: s === 'all' ? 'All' : s,
            count: summary ? (s === 'all' ? summary.total : summary[s.toLowerCase()]) : undefined,
          }))}
          value={status}
          onChange={setStatus}
          trailing={(
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[color:var(--text-secondary)]" title="Publish reviews from customers who bought the product without waiting for approval">
              <input type="checkbox" checked={!!summary?.autoApproveVerified} onChange={toggleAuto} />
              Auto-approve verified purchases
            </label>
          )}
        />

        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search title, comment, customer or product…" />
          <select value={rating} onChange={(e) => setRating(e.target.value)} className="input-field h-9 w-auto py-0">
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
          </select>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="input-field h-9 w-auto max-w-[220px] py-0">
            <option value="">All products</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.count})</option>)}
          </select>
          <select value={verified} onChange={(e) => setVerified(e.target.value)} className="input-field h-9 w-auto py-0">
            <option value="">Any buyer</option>
            <option value="true">Verified purchase</option>
            <option value="false">Not verified</option>
          </select>
        </Toolbar>

        {selIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-[6px] bg-[color:var(--surface-secondary)] px-3 py-2 text-[13px]">
            <b>{selIds.length} selected</b>
            <Button size="sm" onClick={() => approve(selIds)} loading={busy}><Check className="size-3.5" /> Approve</Button>
            <Button size="sm" variant="secondary" onClick={() => { setText(''); setDialog({ kind: 'reject', ids: selIds }); }}><X className="size-3.5" /> Reject</Button>
            <Button size="sm" variant="danger" onClick={() => setDialog({ kind: 'delete', ids: selIds })}><Trash2 className="size-3.5" /> Delete</Button>
            <Button size="sm" variant="tertiary" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="block h-16 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={MessageSquareText} title={status === 'Pending' ? 'No reviews waiting for approval' : 'No reviews found'}>
            {q || rating || productId || verified ? 'Try clearing the filters.' : 'Customer reviews submitted on product pages appear here.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-left text-[12px] text-[color:var(--text-muted)]">
                  <th className="w-8 py-2"><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" /></th>
                  <th className="py-2">Review</th>
                  <th className="py-2">Product</th>
                  <th className="py-2">Customer</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[color:var(--border)] align-top last:border-0">
                    <td className="py-2.5"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select review ${r.id}`} /></td>
                    <td className="max-w-[380px] py-2.5 pr-3">
                      <div className="flex items-center gap-2"><StarRow value={r.rating} /><span className="text-[12px] text-[color:var(--text-muted)]">{fmtDate(r.createdAt)}</span></div>
                      {r.title && <div className="mt-1 font-bold text-[color:var(--text-primary)]">{r.title}</div>}
                      <p className="mt-0.5 whitespace-pre-line text-[color:var(--text-secondary)]">{r.comment}</p>
                      {r.adminReply && (
                        <div className="mt-1.5 border-l-2 border-[color:var(--primary)] pl-2 text-[12px] text-[color:var(--text-secondary)]">
                          <b className="text-[color:var(--primary)]">Your reply:</b> {r.adminReply}
                        </div>
                      )}
                      {r.status === 'Rejected' && r.rejectionReason && (
                        <div className="mt-1 text-[12px] text-[color:var(--danger)]">Rejected: {r.rejectionReason}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Link to={`/product/${r.productSlug}`} target="_blank" className="font-bold text-[color:var(--primary)] hover:underline">{r.productName}</Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-bold text-[color:var(--text-primary)]">{r.userName}</div>
                      <div className="text-[12px] text-[color:var(--text-muted)]">{r.userEmail}</div>
                      {r.isVerifiedPurchase && <Badge tone="success" className="mt-1"><BadgeCheck className="size-3" /> Verified</Badge>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                      {r.isFeatured && <div className="mt-1"><Badge tone="accent">On home page</Badge></div>}
                      {r.moderatedBy && <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">by {r.moderatedBy} · {fmtDate(r.moderatedAt)}</div>}
                    </td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-0.5">
 {r.status === 'Approved' && (r.comment || r.title) && (
                          <IconButton label={r.isFeatured ? 'Remove from home page' : 'Show on home page'} tone={r.isFeatured ? 'primary' : undefined} onClick={() => toggleFeature(r)}>
                            <Home className="size-4" fill={r.isFeatured ? 'currentColor' : 'none'} />
                          </IconButton>
                        )}
                        {r.status !== 'Approved' && <IconButton label="Approve" tone="primary" onClick={() => approve([r.id])}><Check className="size-4" /></IconButton>}
                        {r.status !== 'Rejected' && <IconButton label="Reject" tone="danger" onClick={() => { setText(''); setDialog({ kind: 'reject', ids: [r.id] }); }}><X className="size-4" /></IconButton>}
                        <IconButton label={r.adminReply ? 'Edit reply' : 'Reply'} onClick={() => { setText(r.adminReply || ''); setDialog({ kind: 'reply', ids: [r.id], review: r }); }}><MessageSquare className="size-4" /></IconButton>
                        <IconButton label="Delete" tone="danger" onClick={() => setDialog({ kind: 'delete', ids: [r.id] })}><Trash2 className="size-4" /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={Math.min(page, pages)} pages={pages} total={total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="reviews" />
      </Card>

      {summary?.approved > 0 && (
        <Card title="Approved rating distribution" bodyClassName="p-3 space-y-1.5">
          {(summary.distribution || []).map((d) => {
            const max = Math.max(1, ...(summary.distribution || []).map((x) => x.count));
            return (
              <div key={d.star} className="flex items-center gap-2 text-[12px] text-[color:var(--text-muted)]">
                <span className="w-10">{d.star} ★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
                  <div className="h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${(d.count / max) * 100}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums">{d.count}</span>
              </div>
            );
          })}
        </Card>
      )}

      {dialog && (
        <AdminModal onClose={() => !busy && setDialog(null)}>
          <DialogPanel
            title={dialog.kind === 'reject' ? `Reject ${dialog.ids.length > 1 ? `${dialog.ids.length} reviews` : 'review'}`
              : dialog.kind === 'reply' ? 'Reply to review' : `Delete ${dialog.ids.length > 1 ? `${dialog.ids.length} reviews` : 'review'}?`}
            onClose={() => setDialog(null)}
            footer={(
              <>
                <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>Cancel</Button>
                <Button variant={dialog.kind === 'delete' || dialog.kind === 'reject' ? 'danger' : 'primary'} onClick={confirmDialog} loading={busy}>
                  {dialog.kind === 'reject' ? 'Reject' : dialog.kind === 'reply' ? (text.trim() ? 'Save reply' : 'Remove reply') : 'Delete'}
                </Button>
              </>
            )}
          >
            {dialog.kind === 'delete' && (
              <p className="text-[13px] text-[color:var(--text-secondary)]">This permanently removes the review{dialog.ids.length > 1 ? 's' : ''} and updates the product rating. The customer will be able to write a new review.</p>
            )}
            {dialog.kind === 'reject' && (
              <Field label="Reason" required hint="Shown to the customer on the product page (only to them).">
                <textarea rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className="input-field resize-none" placeholder="e.g. Contains contact details / not about the product" autoFocus />
              </Field>
            )}
            {dialog.kind === 'reply' && (
              <>
                <div className="mb-3 rounded-[6px] bg-[color:var(--surface-secondary)] p-2.5 text-[13px]">
                  <StarRow value={dialog.review.rating} />
                  {dialog.review.title && <div className="mt-1 font-bold">{dialog.review.title}</div>}
                  <p className="text-[color:var(--text-secondary)]">{dialog.review.comment}</p>
                </div>
                <Field label="Public reply" hint="Shown under the review on the product page once it is approved. Leave empty to remove.">
                  <textarea rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} className="input-field resize-none" autoFocus />
                </Field>
              </>
            )}
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}
