import { useState, useEffect, useCallback } from 'react';
import { Eye, CreditCard, Wallet, Clock, Undo2, RefreshCw, Download, XCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import { useLookups, lookupOptions } from '@/admin/lookups';
import {
  PageHeader, Stat, Card, Badge, statusTone, SearchInput, Toolbar,
  IconButton, EmptyState, DialogPanel, Button, Pagination, Skeleton,
} from '@/admin/ui';

const asDate = (d) => (d ? new Date(/Z|[+-]\d\d:?\d\d$/.test(d) ? d : `${d}Z`) : null);
const fmtDate = (d, withTime = false) => (d
  ? asDate(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
  : '—');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const apiErr = (err, fallback) => err?.response?.data?.error?.message || fallback;

export default function AdminPayments() {
  const lk = useLookups();
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewId, setViewId] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [query, status, method, fromDate, toDate, pageSize]);

  const filters = useCallback(() => {
    const p = {};
    if (status) p.status = status;
    if (method) p.method = method;
    if (query) p.search = query;
    if (fromDate) p.fromDate = fromDate;
    if (toDate) p.toDate = toDate;
    return p;
  }, [status, method, query, fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/payments/ledger', { params: { ...filters(), page, limit: pageSize } });
      setRows(res.data.data?.items || []);
      setTotals(res.data.data?.totals || null);
      setTotal(res.data.data?.pagination?.total || 0);
    } catch (err) {
      toast.error(apiErr(err, 'Failed to load payments'));
    }
    setLoading(false);
  }, [filters, page, pageSize]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get('/admin/payments/ledger/export', { params: filters(), responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(apiErr(err, 'Export failed'));
    }
    setExporting(false);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description="Payment of every website order — online and Cash on Delivery — with refunds"
        actions={<>
          <Button variant="secondary" onClick={exportCsv} loading={exporting}><Download className="size-3.5" /> Export CSV</Button>
          <Button variant="secondary" onClick={load} loading={loading}><RefreshCw className="size-3.5" /> Refresh</Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Collected" value={inr(totals?.collected)} icon={Wallet} tone="success" loading={!totals} hint={`Net ${inr(totals?.net)} after refunds`} />
        <Stat label="Pending" value={inr(totals?.pending)} icon={Clock} tone="warning" loading={!totals} hint={`${totals?.pendingCount ?? 0} orders · COD ${inr(totals?.codPending)}`} />
        <Stat label="Refunded" value={inr(totals?.refunded)} icon={Undo2} tone="danger" loading={!totals} />
        <Stat label="Failed" value={inr(totals?.failed)} icon={XCircle} loading={!totals} hint={`${totals?.failedCount ?? 0} orders`} />
      </div>

      {totals?.byMethod?.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[12px]">
          {totals.byMethod.map((m) => (
            <Badge key={m.method} tone="neutral">{lk.label('PaymentMethod', m.method)}: {m.count} · {inr(m.amount)}</Badge>
          ))}
        </div>
      )}

      <Card>
        <div className="space-y-3 p-3">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search order #, customer, gateway id…" className="max-w-sm" />
            <select className="input-field h-9 w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Payment status">
              <option value="">All statuses</option>
              {lookupOptions(lk.enumList('PaymentStatus'), status).map((o) => <option key={o.value} value={o.value}>{o.label}{totals?.byStatus?.[o.value] ? ` (${totals.byStatus[o.value]})` : ''}</option>)}
            </select>
            <select className="input-field h-9 w-auto" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">
              <option value="">All methods</option>
              {lookupOptions(lk.enumList('PaymentMethod'), method).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="date" className="input-field h-9 w-auto" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" />
            <input type="date" className="input-field h-9 w-auto" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" />
          </Toolbar>

          {loading && rows.length === 0 ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="block h-8 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments match these filters">Orders placed on the website appear here with their payment status.</EmptyState>
          ) : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Order</th>
                      <th className="text-left">Customer</th>
                      <th className="text-left">Method</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Refunded</th>
                      <th className="text-left">Payment</th>
                      <th className="text-left">Order status</th>
                      <th className="text-left">Gateway id</th>
                      <th className="text-left">Date</th>
                      <th className="text-center">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.orderId} className="cursor-pointer" onClick={() => setViewId(r.orderId)}>
                        <td className="font-bold text-[color:var(--primary)]">#{r.orderNumber}</td>
                        <td><div className="font-bold">{r.customer?.name}</div><div className="text-[12px] text-[color:var(--text-muted)]">{r.customer?.phone}</div></td>
                        <td>{lk.label('PaymentMethod', r.method)}</td>
                        <td className="text-right font-bold">{inr(r.amount)}</td>
                        <td className="text-right">{Number(r.refundedAmount) > 0 ? inr(r.refundedAmount) : '—'}</td>
                        <td><Badge tone={statusTone(r.paymentStatus)}>{lk.label('PaymentStatus', r.paymentStatus)}</Badge></td>
                        <td><Badge tone={statusTone(r.orderStatus)}>{lk.label('OrderStatus', r.orderStatus)}</Badge></td>
                        <td className="max-w-[160px] truncate text-[12px] text-[color:var(--text-muted)]" title={r.gatewayPaymentId || r.gatewayOrderId || ''}>{r.gatewayPaymentId || r.gatewayOrderId || '—'}</td>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(r.createdAt)}</td>
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <IconButton label="View payment" tone="primary" onClick={() => setViewId(r.orderId)}><Eye className="size-3.5" /></IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={pages} total={total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="orders" />
            </>
          )}
        </div>
      </Card>

      {viewId && <PaymentDetail orderId={viewId} lk={lk} onClose={() => setViewId(null)} />}
    </div>
  );
}

function PaymentDetail({ orderId, lk, onClose }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.get(`/admin/payments/ledger/${orderId}`).then((res) => setD(res.data.data)).catch((err) => setError(apiErr(err, 'Failed to load payment')));
  }, [orderId]);

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={d ? `Payment · order #${d.orderNumber}` : 'Payment'}
        onClose={onClose}
        width="max-w-2xl"
        footer={<>
          <Link to="/admin/orders" className="mr-auto inline-flex items-center gap-1 text-[13px] font-bold text-[color:var(--primary)]"><ExternalLink className="size-3.5" /> Open Orders</Link>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>}
      >
        {error ? <EmptyState icon={XCircle} title="Couldn't load this payment">{error}</EmptyState>
          : !d ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="block h-6 w-full" />)}</div>
            : (
              <div className="space-y-4 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(d.paymentStatus)}>{lk.label('PaymentStatus', d.paymentStatus)}</Badge>
                  <Badge tone={statusTone(d.orderStatus)}>Order: {lk.label('OrderStatus', d.orderStatus)}</Badge>
                  <span className="text-[color:var(--text-muted)]">{lk.label('PaymentMethod', d.method)} · placed {fmtDate(d.createdAt, true)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Order total" value={inr(d.amount)} />
                  <Stat label="Delivery" value={inr(d.deliveryCharge)} />
                  <Stat label="Refunded" value={inr(d.refundedAmount)} tone={Number(d.refundedAmount) > 0 ? 'danger' : 'neutral'} />
                  <Stat label="Customer" value={d.customer?.name} hint={d.customer?.phone} />
                </div>

                <div>
                  <p className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">Gateway payments</p>
                  {d.payments.length === 0 ? (
                    <p className="text-[color:var(--text-muted)]">{d.method === 'CashOnDelivery' ? 'Cash on Delivery — collected by the courier on delivery (marked Paid when the order is delivered).' : 'No online payment attempt yet.'}</p>
                  ) : d.payments.map((p) => (
                    <div key={p.id} className="mb-2 rounded-[6px] border border-[color:var(--border)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span><Badge tone={statusTone(p.status)}>{lk.label('PaymentStatus', p.status)}</Badge> <b className="ml-1">{inr(p.amount)}</b></span>
                        <span className="text-[12px] text-[color:var(--text-muted)]">{fmtDate(p.createdAt, true)}</span>
                      </div>
                      <p className="mt-1 text-[12px] text-[color:var(--text-muted)]">Gateway order {p.gatewayOrderId || '—'} · payment {p.gatewayPaymentId || '—'}</p>
                      {p.errorDescription && <p className="text-[12px] text-[color:var(--danger)]">{p.errorCode}: {p.errorDescription}</p>}
                      {p.refunds.map((r) => (
                        <p key={r.id} className="mt-1 text-[12px]">↩ Refund {inr(r.amount)} · {lk.label('RefundStatus', r.status)} · {lk.label('RefundMethod', r.method)}{r.gatewayRefundId && ` · ${r.gatewayRefundId}`}{r.reason && ` · ${r.reason}`} · {fmtDate(r.createdAt)}</p>
                      ))}
                    </div>
                  ))}
                </div>

                {d.returns.length > 0 && (
                  <div>
                    <p className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">Returns</p>
                    {d.returns.map((r) => (
                      <p key={r.id} className="py-0.5">
                        <Link to="/admin/returns" className="font-bold text-[color:var(--primary)]">{r.returnNumber}</Link>{' '}
                        <Badge tone={statusTone(r.status)}>{lk.label('ReturnStatus', r.status)}</Badge> · {inr(r.refundAmount)} via {lk.label('RefundMethod', r.refundMethod)}
                        {r.refundReferenceId && ` · ref ${r.refundReferenceId}`}{r.creditNoteNumber && ` · CN ${r.creditNoteNumber}`}
                      </p>
                    ))}
                  </div>
                )}

                <div>
                  <p className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">Order history</p>
                  <ul className="divide-y divide-[color:var(--border)]">
                    {d.history.map((h, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                        <span><Badge tone={statusTone(h.status)}>{lk.label('OrderStatus', h.status)}</Badge>{h.note && <span className="ml-2 text-[color:var(--text-muted)]">{h.note}</span>}</span>
                        <span className="whitespace-nowrap text-[12px] text-[color:var(--text-muted)]">{fmtDate(h.createdAt, true)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
      </DialogPanel>
    </AdminModal>
  );
}
