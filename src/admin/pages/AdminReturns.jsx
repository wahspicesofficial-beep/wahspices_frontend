import { useState, useEffect, useCallback } from 'react';
import { Eye, Undo2, Clock, PackageCheck, IndianRupee, RefreshCw, XCircle, Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import { useLookups, lookupOptions } from '@/admin/lookups';
import {
  PageHeader, Stat, Card, Badge, statusTone, SearchInput, Toolbar, Segmented,
  IconButton, EmptyState, DialogPanel, Button, Pagination, Field, Skeleton,
} from '@/admin/ui';

// API dates are UTC without a zone suffix
const asDate = (d) => (d ? new Date(/Z|[+-]\d\d:?\d\d$/.test(d) ? d : `${d}Z`) : null);
const fmtDate = (d, withTime = false) => (d
  ? asDate(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
  : '—');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const apiErr = (err, fallback) => err?.response?.data?.error?.message || fallback;

export default function AdminReturns() {
  const lk = useLookups();
  const label = (s) => lk.label('ReturnStatus', s);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewId, setViewId] = useState(null);

  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [query, status, fromDate, toDate, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (status !== 'All') params.status = status;
      if (query) params.search = query;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const [list, st] = await Promise.all([api.get('/admin/returns', { params }), api.get('/admin/returns/stats')]);
      setRows(list.data.data?.items || []);
      setTotal(list.data.data?.total || 0);
      setStats(st.data.data);
    } catch (err) {
      toast.error(apiErr(err, 'Failed to load returns'));
    }
    setLoading(false);
  }, [page, pageSize, status, query, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const byStatus = stats?.byStatus || {};
  const chips = [
    { value: 'All', label: `All (${stats?.total ?? 0})` },
    ...lk.enumList('ReturnStatus').filter((s) => byStatus[s.value] || s.value === status)
      .map((s) => ({ value: s.value, label: `${s.label} (${byStatus[s.value] || 0})` })),
  ];
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Returns"
        description="Customer return requests: approve → pickup → receive → refund"
        actions={<Button variant="secondary" onClick={load} loading={loading}><RefreshCw className="size-3.5" /> Refresh</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open returns" value={stats?.open ?? 0} icon={Undo2} loading={!stats} hint={`${stats?.total ?? 0} total`} />
        <Stat label="Awaiting approval" value={stats?.awaitingAction ?? 0} icon={Clock} tone="warning" loading={!stats} />
        <Stat label="Awaiting refund" value={stats?.awaitingRefund ?? 0} icon={PackageCheck} tone="info" loading={!stats} hint={`${inr(stats?.pendingRefundAmount)} still to refund`} />
        <Stat label="Refunded" value={inr(stats?.refundedAmount)} icon={IndianRupee} tone="success" loading={!stats} />
      </div>

      <Card>
        <div className="space-y-3 p-3">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search return #, order #, customer, phone…" className="max-w-sm" />
            <input type="date" className="input-field h-9 w-auto" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" />
            <input type="date" className="input-field h-9 w-auto" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" />
          </Toolbar>
          <div className="overflow-x-auto"><Segmented options={chips} value={status} onChange={setStatus} /></div>

          {loading && rows.length === 0 ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="block h-8 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Undo2} title={stats?.total ? 'No returns match these filters' : 'No returns yet'}>
              {stats?.total ? 'Try another status or clear the search.' : 'Return requests from customers will appear here.'}
            </EmptyState>
          ) : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Return</th>
                      <th className="text-left">Order</th>
                      <th className="text-left">Customer</th>
                      <th className="text-left">Reason</th>
                      <th className="text-right">Items</th>
                      <th className="text-right">Refund</th>
                      <th className="text-left">Status</th>
                      <th className="text-left">Requested</th>
                      <th className="text-center">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="cursor-pointer" onClick={() => setViewId(r.id)}>
                        <td className="font-bold text-[color:var(--primary)]">{r.returnNumber}</td>
                        <td>#{r.orderNumber}<div className="text-[12px] text-[color:var(--text-muted)]">{lk.label('PaymentMethod', r.paymentMethod)}</div></td>
                        <td><div className="font-bold">{r.customerName || '—'}</div><div className="text-[12px] text-[color:var(--text-muted)]">{r.customerPhone}</div></td>
                        <td className="max-w-[220px] truncate" title={r.reason}>{r.reason}</td>
                        <td className="text-right">{r.itemCount}{r.photoCount > 0 && <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] text-[color:var(--text-muted)]" title={`${r.photoCount} photo(s)`}><Camera className="size-3" />{r.photoCount}</span>}</td>
                        <td className="text-right font-bold">{inr(r.grandRefundAmount)}</td>
                        <td><Badge tone={statusTone(r.status)}>{label(r.status)}</Badge></td>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(r.createdAt)}</td>
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <IconButton label="View return" tone="primary" onClick={() => setViewId(r.id)}><Eye className="size-3.5" /></IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={pages} total={total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="returns" />
            </>
          )}
        </div>
      </Card>

      {viewId && <ReturnDetail id={viewId} lk={lk} onClose={() => setViewId(null)} onChanged={load} />}
    </div>
  );
}

const ACTIONS = {
  approve: { title: 'Approve return', button: 'Approve', variant: 'primary' },
  reject: { title: 'Reject return', button: 'Reject', variant: 'danger' },
  pickup: { title: 'Mark picked up', button: 'Mark picked up', variant: 'secondary' },
  received: { title: 'Mark received at warehouse', button: 'Mark received', variant: 'secondary' },
  refund: { title: 'Process refund', button: 'Process refund', variant: 'primary' },
};

function ReturnDetail({ id, lk, onClose, onChanged }) {
  const [ret, setRet] = useState(null);
  const [error, setError] = useState(null);
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchOne = useCallback(async () => {
    try {
      const res = await api.get(`/admin/returns/${id}`);
      setRet(res.data.data);
    } catch (err) { setError(apiErr(err, 'Failed to load return')); }
  }, [id]);
  useEffect(() => { fetchOne(); }, [fetchOne]);

  const start = (a) => {
    setAction(a);
    setForm(a === 'refund' ? { refundMethod: ret?.refundMethod || 'OriginalPaymentMethod', refundReferenceId: '', notes: '' }
      : a === 'pickup' ? { courierName: ret?.courierName || '', awbNumber: ret?.awbNumber || '' }
        : a === 'approve' ? { adminNotes: '', pickupScheduledAt: '' } : {});
  };

  const run = async () => {
    const paths = { approve: 'approve', reject: 'reject', pickup: 'pickup', received: 'received', refund: 'process-refund' };
    let body = {};
    if (action === 'approve') body = { adminNotes: form.adminNotes || null, pickupScheduledAt: form.pickupScheduledAt || null, includeTcs: false, tcsRate: 1 };
    if (action === 'reject') {
      if (!form.reason?.trim()) { toast.error('Enter a rejection reason'); return; }
      body = { reason: form.reason.trim() };
    }
    if (action === 'pickup') {
      if (!form.courierName?.trim()) { toast.error('Enter the courier name'); return; }
      body = { courierName: form.courierName.trim(), awbNumber: form.awbNumber?.trim() || '' };
    }
    if (action === 'received') body = { adminNotes: form.adminNotes || null };
    if (action === 'refund') body = { refundMethod: form.refundMethod, refundReferenceId: form.refundReferenceId?.trim() || null, notes: form.notes?.trim() || null };
    setSaving(true);
    try {
      const res = await api.post(`/admin/returns/${id}/${paths[action]}`, body);
      toast.success(res.data.message || 'Updated');
      setAction(null);
      await fetchOne();
      onChanged();
    } catch (err) {
      toast.error(apiErr(err, 'Action failed'));
    }
    setSaving(false);
  };

  const tax = ret?.taxBreakdown;
  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={ret ? `Return ${ret.returnNumber}` : 'Return'}
        onClose={onClose}
        width="max-w-3xl"
        footer={ret && (action ? (
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>Back</Button>
            <Button variant={ACTIONS[action].variant} onClick={run} loading={saving}>{ACTIONS[action].button}</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {(ret.nextActions || []).map((a) => (
              <Button key={a} variant={ACTIONS[a]?.variant || 'secondary'} onClick={() => start(a)}>{ACTIONS[a]?.button || a}</Button>
            ))}
          </>
        ))}
      >
        {error ? <EmptyState icon={XCircle} title="Couldn't load this return">{error}</EmptyState>
          : !ret ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="block h-6 w-full" />)}</div>
            : action ? (
              <div className="space-y-3 text-[13px]">
                <p className="font-bold">{ACTIONS[action].title} — refund {inr(tax?.grandRefundAmount)}</p>
                {action === 'approve' && (
                  <>
                    <Field label="Pickup date (optional)"><input type="date" className="input-field w-full" value={form.pickupScheduledAt} onChange={(e) => setForm({ ...form, pickupScheduledAt: e.target.value })} /></Field>
                    <Field label="Notes (optional)"><textarea className="input-field w-full" rows={3} value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} /></Field>
                  </>
                )}
                {action === 'reject' && (
                  <Field label="Reason (shown to the customer)" required><textarea className="input-field w-full" rows={3} value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
                )}
                {action === 'pickup' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Courier" required><input className="input-field w-full" value={form.courierName} onChange={(e) => setForm({ ...form, courierName: e.target.value })} /></Field>
                    <Field label="AWB / tracking number"><input className="input-field w-full" value={form.awbNumber} onChange={(e) => setForm({ ...form, awbNumber: e.target.value })} /></Field>
                  </div>
                )}
                {action === 'received' && (
                  <>
                    <p className="text-[color:var(--text-muted)]">The returned units go back into inventory (if the product has an inventory item).</p>
                    <Field label="Inspection notes (optional)"><textarea className="input-field w-full" rows={3} value={form.adminNotes || ''} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} /></Field>
                  </>
                )}
                {action === 'refund' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Refund method" required>
                      <select className="input-field w-full" value={form.refundMethod} onChange={(e) => setForm({ ...form, refundMethod: e.target.value })}>
                        {lookupOptions(lk.enumList('RefundMethod'), form.refundMethod).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Reference (UTR / txn id)"><input className="input-field w-full" value={form.refundReferenceId} onChange={(e) => setForm({ ...form, refundReferenceId: e.target.value })} /></Field>
                    <Field label="Notes" className="sm:col-span-2"><textarea className="input-field w-full" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
                    <p className="text-[12px] text-[color:var(--text-muted)] sm:col-span-2">Records the refund you have paid (bank / UPI / gateway dashboard) and issues the credit note. Online payments are also listed under Payments.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(ret.status)}>{lk.label('ReturnStatus', ret.status)}</Badge>
                  <Badge tone={statusTone(ret.paymentStatus)}>Payment: {lk.label('PaymentStatus', ret.paymentStatus)}</Badge>
                  <span className="text-[color:var(--text-muted)]">Order #{ret.orderNumber} · {lk.label('PaymentMethod', ret.paymentMethod)} · {inr(ret.orderTotal)} · requested {fmtDate(ret.createdAt, true)}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-[6px] border border-[color:var(--border)] p-3">
                    <p className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">Customer</p>
                    <p className="font-bold">{ret.customerName}</p>
                    <p className="text-[color:var(--text-muted)]">{ret.customerEmail}</p>
                    <p className="text-[color:var(--text-muted)]">{ret.customerPhone}</p>
                  </div>
                  <div className="rounded-[6px] border border-[color:var(--border)] p-3">
                    <p className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">Pickup</p>
                    <p className="text-[color:var(--text-muted)]">{ret.pickupAddress || '—'}</p>
                    {ret.pickupScheduledAt && <p>Scheduled {fmtDate(ret.pickupScheduledAt)}</p>}
                    {ret.courierName && <p>{ret.courierName}{ret.awbNumber && ` · AWB ${ret.awbNumber}`}{ret.pickedUpAt && ` · picked up ${fmtDate(ret.pickedUpAt)}`}</p>}
                    {ret.receivedAt && <p>Received {fmtDate(ret.receivedAt, true)}</p>}
                  </div>
                </div>
                <div className="rounded-[6px] bg-[color:var(--surface-secondary)] px-3 py-2">
                  <b>Reason:</b> {ret.reason}
                  {ret.rejectionReason && <div className="mt-1 text-[color:var(--danger)]"><b>Rejected:</b> {ret.rejectionReason}</div>}
                  {ret.adminNotes && <div className="mt-1 whitespace-pre-line text-[color:var(--text-muted)]"><b>Notes:</b> {ret.adminNotes}</div>}
                </div>
                <div className="grid-box">
                  <table>
                    <thead><tr><th className="text-left">Item</th><th className="text-left">Condition</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">GST</th><th className="text-right">Refund</th></tr></thead>
                    <tbody>
                      {ret.items.map((i) => (
                        <tr key={i.id}>
                          <td><div className="font-bold">{i.productName}</div><div className="text-[12px] text-[color:var(--text-muted)]">{i.weight}{i.hsnCode && ` · HSN ${i.hsnCode}`}{i.returnReason && ` · ${i.returnReason}`}</div></td>
                          <td>{lk.label('ReturnItemCondition', i.condition)}</td>
                          <td className="text-right">{i.quantity}</td>
                          <td className="text-right">{inr(i.unitPrice)}</td>
                          <td className="text-right">{inr(i.totalTax)} <span className="text-[11px] text-[color:var(--text-muted)]">({i.gstRate}%)</span></td>
                          <td className="text-right font-bold">{inr(i.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><td colSpan={5} className="text-right text-[color:var(--text-muted)]">Taxable value</td><td className="text-right">{inr(tax?.totalTaxableValue)}</td></tr>
                      <tr><td colSpan={5} className="text-right text-[color:var(--text-muted)]">GST reversed ({tax?.gstTypeLabel})</td><td className="text-right">{inr(tax?.totalGstReversed)}</td></tr>
                      {Number(tax?.deliveryChargeRefund) > 0 && <tr><td colSpan={5} className="text-right text-[color:var(--text-muted)]">Delivery charge (full return)</td><td className="text-right">{inr(tax.deliveryChargeRefund)}</td></tr>}
                      {Number(tax?.couponDiscountDeducted) > 0 && <tr><td colSpan={5} className="text-right text-[color:var(--text-muted)]">Coupon discount deducted</td><td className="text-right">−{inr(tax.couponDiscountDeducted)}</td></tr>}
                      <tr className="font-bold"><td colSpan={5} className="text-right">Refund to customer</td><td className="text-right">{inr(tax?.grandRefundAmount)}</td></tr>
                      {tax?.deliveryNote && <tr><td colSpan={6} className="text-right text-[12px] text-[color:var(--text-muted)]">{tax.deliveryNote}</td></tr>}
                    </tfoot>
                  </table>
                </div>
                {(ret.status === 'Refunded' || tax?.creditNoteNumber) && (
                  <p className="rounded-[6px] border border-[color:var(--border)] px-3 py-2">
                    Refunded via <b>{lk.label('RefundMethod', ret.refundMethod)}</b>{ret.refundReferenceId && <> · ref {ret.refundReferenceId}</>} on {fmtDate(ret.refundCompletedAt, true)}
                    {tax?.creditNoteNumber && <> · credit note <b>{tax.creditNoteNumber}</b></>}
                  </p>
                )}
                <PhotoGallery photos={ret.photos || []} />
              </div>
            )}
      </DialogPanel>
    </AdminModal>
  );
}

// Customer photos are private: streamed from /admin/returns/{id}/photos/{n} with the admin token (Returns module)
// into in-memory blob URLs — there is no public URL to share or leak.
function PhotoGallery({ photos }) {
  const [urls, setUrls] = useState([]);
  const [failed, setFailed] = useState(0);
  const [open, setOpen] = useState(null);
  const key = photos.map((p) => p.url).join('|');

  useEffect(() => {
    let alive = true;
    const made = [];
    setUrls([]); setFailed(0);
    (async () => {
      for (const p of photos) {
        try {
          const res = await api.get(p.url, { responseType: 'blob' });
          const u = URL.createObjectURL(res.data);
          made.push(u);
          if (alive) setUrls((x) => [...x, u]);
        } catch { if (alive) setFailed((n) => n + 1); }
      }
    })();
    return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(null); }
      if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % urls.length);
      if (e.key === 'ArrowLeft') setOpen((i) => (i - 1 + urls.length) % urls.length);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, urls.length]);

  if (!photos.length) return <p className="text-[12px] text-[color:var(--text-muted)]">No photos attached by the customer.</p>;
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-bold text-[color:var(--text-secondary)]">Customer photos ({photos.length})</p>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <button key={u} type="button" onClick={() => setOpen(i)} className="size-20 overflow-hidden rounded-[6px] border border-[color:var(--border)] hover:opacity-90" aria-label={`Open photo ${i + 1}`}>
            <img src={u} alt={`Customer photo ${i + 1}`} className="size-full object-cover" />
          </button>
        ))}
        {urls.length + failed < photos.length && Array.from({ length: photos.length - urls.length - failed }).map((_, i) => <Skeleton key={i} className="block size-20" />)}
      </div>
      {failed > 0 && <p className="mt-1 text-[12px] text-[color:var(--danger)]">{failed} photo(s) could not be loaded.</p>}
      {open !== null && urls[open] && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)} role="dialog" aria-label="Photo viewer">
          <img src={urls[open]} alt={`Customer photo ${open + 1}`} className="max-h-[88vh] max-w-full rounded-[6px]" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/90 p-2" onClick={() => setOpen(null)} aria-label="Close"><X className="size-4" /></button>
          {urls.length > 1 && (
            <>
              <button type="button" className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + urls.length) % urls.length); }} aria-label="Previous"><ChevronLeft className="size-5" /></button>
              <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % urls.length); }} aria-label="Next"><ChevronRight className="size-5" /></button>
            </>
          )}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[12px] text-white">{open + 1} / {urls.length}</span>
        </div>
      )}
    </div>
  );
}
