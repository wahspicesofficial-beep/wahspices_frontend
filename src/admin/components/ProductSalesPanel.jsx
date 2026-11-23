// Per-product website sales: who ordered it, pack sizes, quantities, order + payment status, revenue.
// GET /api/admin/product-sales/{productId}
import { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import { useLookups, lookupOptions } from '@/admin/lookups';
import { Stat, Badge, statusTone, SearchInput, Toolbar, EmptyState, DialogPanel, Button, Pagination, Skeleton } from '@/admin/ui';

const asDate = (d) => (d ? new Date(/Z|[+-]\d\d:?\d\d$/.test(d) ? d : `${d}Z`) : null);
const fmtDate = (d) => (d ? asDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function ProductSalesPanel({ product, onClose }) {
  const lk = useLookups();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [query, status, paymentStatus, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (query) params.search = query;
      if (status) params.status = status;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      const res = await api.get(`/admin/product-sales/${product.id}`, { params });
      setData(res.data.data);
      setError(null);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to load sales';
      setError(msg);
      toast.error(msg);
    }
    setLoading(false);
  }, [product.id, page, pageSize, query, status, paymentStatus]);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const total = data?.pagination?.total || 0;
  return (
    <AdminModal onClose={onClose}>
      <DialogPanel title={`Sales · ${product.name}`} onClose={onClose} width="max-w-4xl" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
        {error && !data ? <EmptyState icon={XCircle} title="Couldn't load sales">{error}</EmptyState> : !data ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="block h-6 w-full" />)}</div>
        ) : (
          <div className="space-y-4 text-[13px]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Revenue" value={inr(s.revenue)} tone="success" hint={`Paid ${inr(s.paidRevenue)} · pending ${inr(s.pendingRevenue)}`} />
              <Stat label="Units sold" value={s.units} hint={`${s.cancelledUnits} cancelled · ${s.returnedUnits} returned`} />
              <Stat label="Orders" value={s.orders} />
              <Stat label="Customers" value={s.customers} />
            </div>
            {s.byVariant?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {s.byVariant.map((v) => <Badge key={v.weight || '-'} tone="neutral">{v.weight || 'Default'}: {v.units} units · {inr(v.revenue)}</Badge>)}
              </div>
            )}
            <Toolbar>
              <SearchInput value={search} onChange={setSearch} placeholder="Search order #, customer, phone…" className="max-w-xs" />
              <select className="input-field h-9 w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Order status">
                <option value="">All order statuses</option>
                {lookupOptions(lk.enumList('OrderStatus'), status).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="input-field h-9 w-auto" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} aria-label="Payment status">
                <option value="">All payment statuses</option>
                {lookupOptions(lk.enumList('PaymentStatus'), paymentStatus).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Toolbar>
            {data.items.length === 0 ? (
              <EmptyState icon={ShoppingBag} title={loading ? 'Loading…' : 'No website orders for this product yet'} />
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Order</th><th className="text-left">Customer</th><th className="text-left">Pack</th>
                        <th className="text-right">Qty</th><th className="text-right">Amount</th><th className="text-left">Order status</th>
                        <th className="text-left">Payment</th><th className="text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((i) => (
                        <tr key={i.id}>
                          <td className="font-bold text-[color:var(--primary)]">#{i.orderNumber}</td>
                          <td><div className="font-bold">{i.customer?.name}</div><div className="text-[12px] text-[color:var(--text-muted)]">{i.customer?.phone}{i.city && ` · ${i.city}`}</div></td>
                          <td>{i.weight || '—'}</td>
                          <td className="text-right">{i.quantity}{i.returnedQty > 0 && <div className="text-[11px] text-[color:var(--danger)]">{i.returnedQty} returned</div>}</td>
                          <td className="text-right font-bold">{inr(i.lineTotal)}<div className="text-[11px] font-normal text-[color:var(--text-muted)]">{inr(i.price)} each</div></td>
                          <td><Badge tone={statusTone(i.orderStatus)}>{lk.label('OrderStatus', i.orderStatus)}</Badge></td>
                          <td className="whitespace-nowrap"><Badge tone={statusTone(i.paymentStatus)}>{lk.label('PaymentStatus', i.paymentStatus)}</Badge><div className="text-[12px] text-[color:var(--text-muted)]">{lk.label('PaymentMethod', i.paymentMethod)}</div></td>
                          <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(i.orderDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pages={Math.max(1, Math.ceil(total / pageSize))} total={total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="order lines" />
              </>
            )}
          </div>
        )}
      </DialogPanel>
    </AdminModal>
  );
}
