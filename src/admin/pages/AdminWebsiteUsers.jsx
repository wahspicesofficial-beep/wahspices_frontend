import { useState, useEffect, useCallback } from 'react';
import { Eye, Users, UserPlus, ShoppingBag, Ban, RefreshCw, XCircle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import { useLookups } from '@/admin/lookups';
import {
  PageHeader, Stat, Card, Badge, statusTone, SearchInput, Toolbar, Segmented, Tabs,
  IconButton, EmptyState, DialogPanel, Button, Pagination, Skeleton,
} from '@/admin/ui';

const asDate = (d) => (d ? new Date(/Z|[+-]\d\d:?\d\d$/.test(d) ? d : `${d}Z`) : null);
const fmtDate = (d, withTime = false) => (d
  ? asDate(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
  : '—');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const apiErr = (err, fallback) => err?.response?.data?.error?.message || fallback;

// Filter chips map to the backend's ?status= values
const FILTERS = [
  { value: '', label: 'All' }, { value: 'buyers', label: 'Buyers' }, { value: 'new', label: 'New this month' },
  { value: 'active', label: 'Active' }, { value: 'unverified', label: 'Unverified' }, { value: 'blocked', label: 'Blocked' },
];
const SORTS = [
  { value: '', label: 'Newest' }, { value: 'spent', label: 'Top spenders' }, { value: 'orders', label: 'Most orders' }, { value: 'lastorder', label: 'Recent buyers' },
];

export default function AdminWebsiteUsers() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewId, setViewId] = useState(null);

  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [query, filter, sort, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (query) params.search = query;
      if (filter) params.status = filter;
      if (sort) params.sort = sort;
      const res = await api.get('/admin/website-users', { params });
      setRows(res.data.data?.items || []);
      setSummary(res.data.data?.summary || null);
      setTotal(res.data.data?.pagination?.total || 0);
    } catch (err) {
      toast.error(apiErr(err, 'Failed to load website users'));
    }
    setLoading(false);
  }, [page, pageSize, query, filter, sort]);
  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Website Users"
        description="Customers registered on the website — their orders, returns and spend"
        actions={<Button variant="secondary" onClick={load} loading={loading}><RefreshCw className="size-3.5" /> Refresh</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total users" value={summary?.totalUsers ?? 0} icon={Users} loading={!summary} hint={`${summary?.unverified ?? 0} unverified`} />
        <Stat label="New this month" value={summary?.newThisMonth ?? 0} icon={UserPlus} tone="info" loading={!summary} />
        <Stat label="Active buyers" value={summary?.activeBuyers ?? 0} icon={ShoppingBag} tone="success" loading={!summary} hint={`${summary?.buyersLast90Days ?? 0} ordered in last 90 days`} />
        <Stat label="Blocked" value={summary?.blocked ?? 0} icon={Ban} tone="danger" loading={!summary} />
      </div>

      <Card>
        <div className="space-y-3 p-3">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or phone…" className="max-w-sm" />
            <select className="input-field h-9 w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Toolbar>
          <div className="overflow-x-auto"><Segmented options={FILTERS} value={filter} onChange={setFilter} /></div>

          {loading && rows.length === 0 ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="block h-8 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Users} title={summary?.totalUsers ? 'No users match these filters' : 'No registered users yet'} />
          ) : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">User</th>
                      <th className="text-left">Phone</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Spent</th>
                      <th className="text-right">Returns</th>
                      <th className="text-left">Last order</th>
                      <th className="text-left">Joined</th>
                      <th className="text-left">Status</th>
                      <th className="text-center">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <tr key={u.id} className="cursor-pointer" onClick={() => setViewId(u.id)}>
                        <td><div className="font-bold">{u.name}</div><div className="text-[12px] text-[color:var(--text-muted)]">{u.email}</div></td>
                        <td>{u.phone || '—'}</td>
                        <td className="text-right">{u.orderCount}</td>
                        <td className="text-right font-bold">{inr(u.totalSpent)}</td>
                        <td className="text-right">{u.returnCount || '—'}</td>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(u.lastOrderAt)}</td>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(u.createdAt)}</td>
                        <td><Badge tone={u.status === 'Unverified' ? 'warning' : statusTone(u.status)}>{u.status}</Badge></td>
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <IconButton label="View user" tone="primary" onClick={() => setViewId(u.id)}><Eye className="size-3.5" /></IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={pages} total={total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="users" />
            </>
          )}
        </div>
      </Card>

      {viewId && <UserDetail id={viewId} onClose={() => setViewId(null)} onChanged={load} />}
    </div>
  );
}

function UserDetail({ id, onClose, onChanged }) {
  const lk = useLookups();
  const [u, setU] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('orders');
  const [busy, setBusy] = useState(false);

  const fetchOne = useCallback(async () => {
    try { const res = await api.get(`/admin/website-users/${id}`); setU(res.data.data); }
    catch (err) { setError(apiErr(err, 'Failed to load user')); }
  }, [id]);
  useEffect(() => { fetchOne(); }, [fetchOne]);

  const blocked = u?.status === 'Blocked';
  const toggleBlock = async () => {
    if (!blocked && !window.confirm(`Block ${u.name}? They won't be able to log in or place orders.`)) return;
    setBusy(true);
    try {
      const res = await api.put(`/admin/website-users/${id}/block`, { blocked: !blocked });
      toast.success(res.data.message || 'Updated');
      await fetchOne();
      onChanged();
    } catch (err) { toast.error(apiErr(err, 'Failed to update user')); }
    setBusy(false);
  };

  const s = u?.stats;
  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={u ? u.name : 'Website user'}
        onClose={onClose}
        width="max-w-3xl"
        footer={u && <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant={blocked ? 'primary' : 'danger'} onClick={toggleBlock} loading={busy}>
            {blocked ? <><ShieldCheck className="size-3.5" /> Unblock</> : <><Ban className="size-3.5" /> Block user</>}
          </Button>
        </>}
      >
        {error ? <EmptyState icon={XCircle} title="Couldn't load this user">{error}</EmptyState>
          : !u ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="block h-6 w-full" />)}</div>
            : (
              <div className="space-y-4 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={u.status === 'Unverified' ? 'warning' : statusTone(u.status)}>{u.status}</Badge>
                  <span className="text-[color:var(--text-muted)]">{u.email}{u.phone && ` · ${u.phone}`} · {u.loginMethod} login · joined {fmtDate(u.createdAt)} · last login {fmtDate(u.lastLoginAt, true)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Orders" value={s.orders} hint={s.cancelledOrders ? `${s.cancelledOrders} cancelled` : undefined} />
                  <Stat label="Total spent" value={inr(s.totalSpent)} tone="success" hint={`Net ${inr(s.netSpent)}`} />
                  <Stat label="Avg order" value={inr(s.averageOrder)} />
                  <Stat label="Refunded" value={inr(s.refunded)} tone={Number(s.refunded) > 0 ? 'danger' : 'neutral'} hint={`${s.returns} return(s)`} />
                </div>
                {Number(s.pendingPayment) > 0 && <p className="text-[color:var(--warning)]">{inr(s.pendingPayment)} awaiting payment</p>}

                <Tabs
                  items={[
                    { value: 'orders', label: 'Orders', count: u.orders.length },
                    { value: 'returns', label: 'Returns', count: u.returns.length },
                    { value: 'addresses', label: 'Addresses', count: u.addresses.length },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
                {tab === 'orders' && (u.orders.length === 0 ? <EmptyState icon={ShoppingBag} title="No orders yet" /> : (
                  <div className="grid-box">
                    <table>
                      <thead><tr><th className="text-left">Order</th><th className="text-left">Items</th><th className="text-right">Amount</th><th className="text-left">Status</th><th className="text-left">Payment</th><th className="text-left">Date</th></tr></thead>
                      <tbody>
                        {u.orders.map((o) => (
                          <tr key={o.id}>
                            <td className="font-bold text-[color:var(--primary)]">#{o.orderNumber}</td>
                            <td className="max-w-[240px] truncate" title={o.items.join(', ')}>{o.items.join(', ')}</td>
                            <td className="text-right font-bold">{inr(o.grandTotal)}</td>
                            <td><Badge tone={statusTone(o.status)}>{lk.label('OrderStatus', o.status)}</Badge></td>
                            <td className="whitespace-nowrap"><Badge tone={statusTone(o.paymentStatus)}>{lk.label('PaymentStatus', o.paymentStatus)}</Badge><div className="text-[12px] text-[color:var(--text-muted)]">{lk.label('PaymentMethod', o.paymentMethod)}</div></td>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(o.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {tab === 'returns' && (u.returns.length === 0 ? <EmptyState title="No returns" /> : (
                  <div className="grid-box">
                    <table>
                      <thead><tr><th className="text-left">Return</th><th className="text-left">Order</th><th className="text-left">Reason</th><th className="text-right">Refund</th><th className="text-left">Status</th><th className="text-left">Date</th></tr></thead>
                      <tbody>
                        {u.returns.map((r) => (
                          <tr key={r.id}>
                            <td className="font-bold">{r.returnNumber}</td>
                            <td>#{r.orderNumber}</td>
                            <td className="max-w-[220px] truncate" title={r.reason}>{r.reason}</td>
                            <td className="text-right">{inr(r.refundAmount)}</td>
                            <td><Badge tone={statusTone(r.status)}>{lk.label('ReturnStatus', r.status)}</Badge></td>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(r.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {tab === 'addresses' && (u.addresses.length === 0 ? <EmptyState title="No saved addresses" /> : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {u.addresses.map((a) => (
                      <div key={a.id} className="rounded-[6px] border border-[color:var(--border)] p-3">
                        <p className="font-bold">{a.name} · {a.phone} {a.isDefault && <Badge tone="primary">Default</Badge>}</p>
                        <p className="text-[color:var(--text-muted)]">{a.addressLine}{a.landmark && `, ${a.landmark}`}</p>
                        <p className="text-[color:var(--text-muted)]">{a.city}, {a.state} {a.pincode} · {a.type}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
      </DialogPanel>
    </AdminModal>
  );
}
