import { useState, useEffect, useCallback } from 'react';
import { Eye, ShoppingBag, Truck, CheckCircle2, XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { fetchAdminOrders, fetchAdminOrderById, updateOrderStatus } from '@/store/slices/adminSlice';
import toast from 'react-hot-toast';
import AdminModal from '@/admin/components/AdminModal';
import ShippingPanel from '@/admin/components/ShippingPanel';
import { SkTable, SkPageHeader } from '@/components/ui/Skeleton';
import { useLookups, lookupOptions } from '@/admin/lookups';
import {
  PageHeader, Stat, Card, Badge, statusTone, SearchInput, Toolbar, Segmented,
  IconButton, EmptyState, DialogPanel, Button, Pagination, Field, Skeleton,
} from '@/admin/ui';

// Fulfilment flow used by the "next step" quick action (values are OrderStatus enum names).
// Same order as the customer tracking timeline; Processing sits between Confirmed and Packed.
const FLOW = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Dispatched', 'InTransit', 'OutForDelivery', 'Delivered'];
const nextOf = (status) => {
  if (status === 'Pending') return 'Confirmed';
  if (status === 'Confirmed' || status === 'Processing') return 'Packed';
  const i = FLOW.indexOf(status);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
};

const fmtDate = (d, withTime = false) => (d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
  : '—');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const errMsg = (res, fallback) => (typeof res?.payload === 'string' && res.payload) || fallback;

export default function AdminOrders() {
  const dispatch = useAppDispatch();
  const lk = useLookups();
  const statusLabel = (s) => lk.label('OrderStatus', s);

  const [orders, setOrders]       = useState([]);
  const [summary, setSummary]     = useState(null);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [loaded, setLoaded]       = useState(false);

  const [search, setSearch]       = useState('');
  const [query, setQuery]         = useState('');       // debounced search
  const [statusFilter, setStatus] = useState('All');
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(20);
  const [viewId, setViewId]       = useState(null);
  const [busyId, setBusyId]       = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [query, statusFilter, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { page, limit: pageSize };
    if (statusFilter !== 'All') params.status = statusFilter;
    if (query) params.search = query;
    const res = await dispatch(fetchAdminOrders(params));
    if (fetchAdminOrders.fulfilled.match(res)) {
      setOrders(res.payload?.orders || []);
      setSummary(res.payload?.summary || null);
      setTotal(res.payload?.pagination?.total ?? 0);
    } else {
      toast.error(errMsg(res, 'Failed to load orders'));
    }
    setLoading(false);
    setLoaded(true);
  }, [dispatch, page, pageSize, statusFilter, query]);

  useEffect(() => { load(); }, [load]);

  const handleUpdateStatus = async (id, status, extra = {}) => {
    if (status === 'Cancelled' && !window.confirm('Cancel this order? The customer will be notified.')) return false;
    setBusyId(id);
    const res = await dispatch(updateOrderStatus({ id, status, ...extra }));
    setBusyId(null);
    if (updateOrderStatus.fulfilled.match(res)) {
      toast.success(`Status updated to "${statusLabel(status)}"${res.payload?.notificationSent ? ' · customer emailed' : ''}`);
      load();
      return true;
    }
    toast.error(errMsg(res, 'Failed to update status'));
    return false;
  };

  if (!loaded) return <div className="space-y-6"><SkPageHeader /><SkTable rows={8} cols={7} /></div>;

  const byStatus = summary?.byStatus || {};
  const statusChips = [
    { value: 'All', label: `All (${summary?.all ?? 0})` },
    ...lk.enumList('OrderStatus')
      .filter((s) => byStatus[s.value] || s.value === statusFilter)
      .map((s) => ({ value: s.value, label: `${s.label} (${byStatus[s.value] || 0})` })),
  ];
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        description={`${summary?.all ?? 0} orders from the website`}
        actions={<Button variant="secondary" onClick={load} loading={loading}><RefreshCw className="size-3.5" /> Refresh</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total orders" value={summary?.all ?? 0} icon={ShoppingBag} />
        <Stat label="Active" value={summary?.active ?? 0} icon={Truck} tone="info" hint="Pending → out for delivery" />
        <Stat label="Delivered" value={summary?.delivered ?? 0} icon={CheckCircle2} tone="success" />
        <Stat label="Cancelled" value={summary?.cancelled ?? 0} icon={XCircle} tone="danger" />
      </div>

      <Card>
        <div className="space-y-3 p-3">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search order #, customer name or phone…" className="max-w-sm" />
            <div className="overflow-x-auto">
              <Segmented options={statusChips} value={statusFilter} onChange={setStatus} />
            </div>
          </Toolbar>

          {loading && orders.length === 0 ? (
            <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="block h-8 w-full" />)}</div>
          ) : orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title={summary?.all ? 'No orders match these filters' : 'No orders yet'}>
              {summary?.all ? 'Try another status or clear the search.' : 'Orders placed on the website will appear here.'}
            </EmptyState>
          ) : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Order</th>
                      <th className="text-left">Customer</th>
                      <th className="text-left">City</th>
                      <th className="text-right">Items</th>
                      <th className="text-right">Amount</th>
                      <th className="text-left">Payment</th>
                      <th className="text-left">Status</th>
                      <th className="text-left">Date</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const next = nextOf(order.status);
                      return (
                        <tr key={order.id} className="cursor-pointer" onClick={() => setViewId(order.id)}>
                          <td className="font-bold text-[color:var(--primary)]">#{order.orderNumber || order.id}</td>
                          <td>
                            <div className="font-bold">{order.customer?.name || '—'}</div>
                            {order.customer?.phone && <div className="text-[12px] text-[color:var(--text-muted)]">{order.customer.phone}</div>}
                          </td>
                          <td className="text-[color:var(--text-muted)]">{order.city || '—'}</td>
                          <td className="text-right">{order.itemCount ?? '—'}</td>
                          <td className="text-right font-bold">{inr(order.grandTotal)}</td>
                          <td className="whitespace-nowrap text-[12px]">
                            <Badge tone={statusTone(order.paymentStatus)}>{lk.label('PaymentStatus', order.paymentStatus)}</Badge>
                            <div className="mt-0.5 text-[color:var(--text-muted)]">{lk.label('PaymentMethod', order.paymentMethod)}</div>
                          </td>
                          <td><Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge></td>
                          <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(order.createdAt)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <IconButton label="View order" tone="primary" onClick={() => setViewId(order.id)}><Eye className="size-3.5" /></IconButton>
                              {next && (
                                <Button size="sm" variant="secondary" className="!h-7 !px-2 !text-[12px]" disabled={busyId === order.id}
                                  onClick={() => handleUpdateStatus(order.id, next)}>
                                  <ArrowRight className="size-3" /> {statusLabel(next)}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={pages} total={total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="orders" />
            </>
          )}
        </div>
      </Card>

      {viewId && (
        <OrderDetail
          id={viewId}
          onClose={() => setViewId(null)}
          onUpdate={handleUpdateStatus}
          onRefreshList={load}
          statusOptions={lk.enumList('OrderStatus')}
          statusLabel={statusLabel}
          lk={lk}
        />
      )}
    </div>
  );
}

// ── Order detail (real items, address, history) + status update ──────────────

function OrderDetail({ id, onClose, onUpdate, onRefreshList, statusOptions, statusLabel, lk }) {
  const dispatch = useAppDispatch();
  const [order, setOrder]   = useState(null);
  const [error, setError]   = useState(null);
  const [form, setForm]     = useState({ status: '', courier: '', awbNumber: '', note: '' });
  const [saving, setSaving] = useState(false);

  const fetchOrder = useCallback(async () => {
    const res = await dispatch(fetchAdminOrderById(id));
    if (fetchAdminOrderById.fulfilled.match(res)) {
      setOrder(res.payload);
      setForm({ status: res.payload.status, courier: res.payload.courier || '', awbNumber: res.payload.awbNumber || '', note: '' });
    } else setError(errMsg(res, 'Failed to load order'));
  }, [dispatch, id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const save = async () => {
    if (!order || form.status === order.status) { toast.error('Choose a different status'); return; }
    setSaving(true);
    const ok = await onUpdate(order.id, form.status, {
      courier: form.courier.trim() || undefined,
      awbNumber: form.awbNumber.trim() || undefined,
      note: form.note.trim() || undefined,
    });
    setSaving(false);
    if (ok) fetchOrder();
  };

  const a = order?.address;
  const next = order ? nextOf(order.status) : null;

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={order ? `Order #${order.orderNumber}` : 'Order'}
        onClose={onClose}
        width="max-w-4xl"
        footer={order && <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={save} loading={saving} disabled={saving || form.status === order.status}>Update status</Button>
        </>}
      >
        {error ? (
          <EmptyState icon={XCircle} title="Couldn't load this order">{error}</EmptyState>
        ) : !order ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="block h-6 w-full" />)}</div>
        ) : (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
              <Badge tone={statusTone(order.paymentStatus)}>Payment: {lk.label('PaymentStatus', order.paymentStatus)}</Badge>
              <span className="text-[color:var(--text-muted)]">{lk.label('PaymentMethod', order.paymentMethod)} · placed {fmtDate(order.createdAt, true)}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[6px] border border-[color:var(--border)] p-3">
                <p className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">Customer</p>
                <p className="font-bold">{order.customer?.name}</p>
                <p className="text-[color:var(--text-muted)]">{order.customer?.email}</p>
                <p className="text-[color:var(--text-muted)]">{order.customer?.phone}</p>
              </div>
              <div className="rounded-[6px] border border-[color:var(--border)] p-3">
                <p className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">Ship to</p>
                {a ? (
                  <>
                    <p className="font-bold">{a.name} · {a.phone}</p>
                    <p className="text-[color:var(--text-muted)]">{a.addressLine}</p>
                    <p className="text-[color:var(--text-muted)]">{a.city}, {a.state} {a.pincode}</p>
                  </>
                ) : <p className="text-[color:var(--text-muted)]">No address</p>}
              </div>
            </div>

            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Item</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div className="font-bold">{it.productName}</div>
                        {it.weight && <div className="text-[12px] text-[color:var(--text-muted)]">{it.weight}</div>}
                      </td>
                      <td className="text-right">
                        {inr(it.price)}
                        {it.mrp > it.price && <div className="text-[11px] text-[color:var(--text-muted)] line-through">{inr(it.mrp)}</div>}
                      </td>
                      <td className="text-right">{it.quantity}</td>
                      <td className="text-right font-bold">{inr(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3} className="text-right text-[color:var(--text-muted)]">Subtotal</td><td className="text-right">{inr(order.subtotal)}</td></tr>
                  {Number(order.couponDiscount) > 0 && (
                    <tr><td colSpan={3} className="text-right text-[color:var(--text-muted)]">Coupon {order.couponCode}</td><td className="text-right">−{inr(order.couponDiscount)}</td></tr>
                  )}
                  <tr><td colSpan={3} className="text-right text-[color:var(--text-muted)]">Delivery</td><td className="text-right">{inr(order.deliveryCharge)}</td></tr>
                  <tr className="font-bold"><td colSpan={3} className="text-right">Grand total</td><td className="text-right">{inr(order.grandTotal)}</td></tr>
                </tfoot>
              </table>
            </div>

            {order.notes && <p className="rounded-[6px] bg-[color:var(--surface-secondary)] px-3 py-2"><b>Customer note:</b> {order.notes}</p>}

            <ShippingPanel orderId={order.id} onChanged={() => { fetchOrder(); onRefreshList?.(); }} />

            <div className="rounded-[6px] border border-[color:var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[12px] font-bold text-[color:var(--text-secondary)]">Update status</p>
                {next && (
                  <Button size="sm" variant="tertiary" onClick={() => setForm((f) => ({ ...f, status: next }))}>
                    <ArrowRight className="size-3" /> Next: {statusLabel(next)}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="New status" required>
                  <select className="input-field w-full" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {lookupOptions(statusOptions, form.status).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Note to customer (optional)">
                  <input className="input-field w-full" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Included in the status email" />
                </Field>
                <Field label="Courier">
                  <input className="input-field w-full" value={form.courier} onChange={(e) => setForm((f) => ({ ...f, courier: e.target.value }))} placeholder="e.g. Delhivery" />
                </Field>
                <Field label="AWB / tracking number">
                  <input className="input-field w-full" value={form.awbNumber} onChange={(e) => setForm((f) => ({ ...f, awbNumber: e.target.value }))} />
                </Field>
              </div>
            </div>

            {order.history?.length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">History</p>
                <ul className="divide-y divide-[color:var(--border)]">
                  {order.history.map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                      <span><Badge tone={statusTone(h.status)}>{statusLabel(h.status)}</Badge>{h.note && <span className="ml-2 text-[color:var(--text-muted)]">{h.note}</span>}</span>
                      <span className="whitespace-nowrap text-[12px] text-[color:var(--text-muted)]">{fmtDate(h.createdAt, true)}{h.updatedBy ? ` · ${h.updatedBy}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogPanel>
    </AdminModal>
  );
}
