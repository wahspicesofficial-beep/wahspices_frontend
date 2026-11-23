import { useEffect, useState } from 'react';
import { SkPageHeader, SkKpiCards, SkChart } from '@/components/ui/Skeleton';
import {
  TrendingUp, TrendingDown, ArrowRight, AlertTriangle,
  Package, Clock, ShoppingCart, Users, BarChart2,
  Star, RotateCcw, Truck, RefreshCw, IndianRupee,
  FileText, Boxes, Warehouse, ShoppingBag, PieChart, UserCog, Receipt,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchAnalyticsPerformance,
  fetchAnalyticsRevenue,
  fetchAnalyticsRevenueSources,
  fetchAnalyticsTopProducts,
  fetchAnalyticsSalesByCategory,
  fetchAnalyticsKpis,
  fetchAnalyticsOrderStatus,
  fetchAnalyticsRecentOrders,
} from '@/store/slices/adminSlice';
import {
  PageHeader, Card, Stat, Badge, statusTone, Segmented, IconButton, EmptyState, cn,
} from '@/admin/ui';
import CompanyRenewalStrip from '@/admin/components/company/CompanyRenewalStrip';

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toLocaleString('en-IN')}`;
};
const fmtNum = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : '0');
const isUp   = (ch) => ch && ch !== 'N/A' && !ch.startsWith('-');

// Rolling windows — must match AdminAnalyticsController.PeriodRange
const PERIODS = [
  { key: 'week',   label: '7 days'   },
  { key: 'month',  label: '30 days'  },
  { key: '3month', label: '90 days'  },
  { key: 'year',   label: '12 months' },
];

// WAH palette for chart marks
const SOURCE_COLORS = ['#1a5c2e', '#f5a623', '#1e5fa8'];
const CAT_COLORS    = ['#1a5c2e', '#f5a623', '#1e5fa8', '#7a4fa0', '#1f7a50', '#c97d06', '#b0382f'];
const STATUS_BAR    = {
  Paid: 'var(--success)', Delivered: 'var(--success)', Unpaid: 'var(--danger)', PartiallyPaid: 'var(--accent)',
  Pending: 'var(--accent)', Overdue: 'var(--warning)', Cancelled: 'var(--border-strong)', Processing: 'var(--info)',
};
const SOURCE_TONE = { Invoice: 'success', Order: 'info', Bill: 'accent' };

/** Change chip shown as a Stat hint */
function Change({ value }) {
  if (!value || value === 'N/A') return null;
  const up = isUp(value);
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-bold', up ? 'text-[color:var(--success)]' : 'text-[color:var(--danger)]')}>
      <Icon className="size-3" /> {value}
    </span>
  );
}

/** Thin horizontal meter used by the breakdown cards */
function Meter({ pct, color, className }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-hover)]', className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, backgroundColor: color }} />
    </div>
  );
}

function CardLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[12px] font-bold text-[color:var(--primary)] hover:underline">
      {children} <ArrowRight className="size-3" />
    </Link>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const dispatch  = useAppDispatch();
  const analytics = useAppSelector((s) => s.admin.analytics);
  const loading   = useAppSelector((s) => s.admin.loading);
  const me        = useAppSelector((s) => s.admin.admin);
  const [period, setPeriod] = useState('month');
  const [refreshKey, setRefreshKey] = useState(0);

  // every period-scoped widget re-queries the API when the period changes
  useEffect(() => {
    dispatch(fetchAnalyticsPerformance({ period }));
    dispatch(fetchAnalyticsRevenueSources({ period }));
    dispatch(fetchAnalyticsTopProducts({ period }));
    dispatch(fetchAnalyticsSalesByCategory({ period }));
    dispatch(fetchAnalyticsOrderStatus({ period }));
    dispatch(fetchAnalyticsKpis({ period }));
  }, [dispatch, period, refreshKey]);

  // not period-scoped: latest transactions + this year's monthly chart
  useEffect(() => {
    dispatch(fetchAnalyticsRecentOrders({ limit: 10 }));
    dispatch(fetchAnalyticsRevenue());
  }, [dispatch, refreshKey]);

  // ── data ───────────────────────────────────────────────────────────────────
  const perf          = analytics.performance;
  const revMonths     = analytics.revenue?.months ?? [];
  const revSources    = analytics.revenueSources;
  const topProducts   = analytics.topProducts ?? [];
  const categories    = analytics.salesByCategory ?? [];
  const kpis          = analytics.kpis;
  const orderStatus   = analytics.orderStatus;
  const recentTx      = analytics.recentOrders ?? [];

  const totalRevenue  = perf?.revenue?.value ?? 0;
  const revChange     = perf?.revenue?.change ?? 'N/A';
  const totalOrders   = perf?.orders?.value ?? 0;
  const ordChange     = perf?.orders?.change ?? 'N/A';
  const totalCust     = perf?.newCustomers?.total ?? 0;
  const newCustChange = perf?.newCustomers?.change ?? 'N/A';
  const aov           = perf?.avgOrderValue?.value ?? 0;
  const aovChange     = perf?.avgOrderValue?.change ?? 'N/A';
  const lowStock      = perf?.lowStock ?? 0;
  const pendingOrders = perf?.pendingOrders ?? 0;
  const unpaidCount   = perf?.unpaidInvoices ?? 0;

  const maxRevBar   = revMonths.length ? Math.max(...revMonths.map((m) => m.revenue ?? 0), 1) : 1;
  const maxProduct  = topProducts.length ? Math.max(...topProducts.map((p) => p.revenue ?? 0), 1) : 1;

  const invoiceRows = orderStatus?.invoices ?? [];
  const orderRows   = orderStatus?.orders   ?? [];
  const maxInvCount = invoiceRows.reduce((s, r) => s + r.count, 0) || 1;
  const maxOrdCount = orderRows.length ? Math.max(...orderRows.map((r) => r.count), 1) : 1;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const annualRevenue = revMonths.reduce((s, m) => s + (m.revenue ?? 0), 0);
  const periodLabel   = PERIODS.find((o) => o.key === period)?.label;

  if (loading && !analytics.performance) return (
    <div className="space-y-6"><SkPageHeader /><SkKpiCards count={6} cols={6} /><SkChart /></div>
  );

  const alerts = [
    unpaidCount > 0 && {
      key: 'unpaid', tone: 'warning', icon: AlertTriangle, to: '/admin/billing', cta: 'Review',
      text: <><b>{unpaidCount} unpaid invoice{unpaidCount > 1 ? 's' : ''}</b>{kpis?.unpaidAmount > 0 && ` · ₹${(kpis.unpaidAmount).toLocaleString('en-IN')} outstanding`}</>,
    },
    lowStock > 0 && {
      key: 'stock', tone: 'danger', icon: Package, to: '/admin/inventory', cta: 'Restock',
      text: <><b>{lowStock} item{lowStock > 1 ? 's' : ''}</b> below reorder point</>,
    },
    pendingOrders > 0 && {
      key: 'pending', tone: 'info', icon: Clock, to: '/admin/orders', cta: 'Process',
      text: <><b>{pendingOrders} order{pendingOrders > 1 ? 's' : ''}</b> awaiting processing</>,
    },
  ].filter(Boolean);

  const ALERT_STYLE = {
    warning: 'border-[rgba(180,83,15,0.25)] bg-[color:var(--warning-bg)] text-[color:var(--warning)]',
    danger:  'border-[rgba(176,56,47,0.25)] bg-[color:var(--danger-bg)] text-[color:var(--danger)]',
    info:    'border-[rgba(30,95,168,0.22)] bg-[color:var(--info-bg)] text-[color:var(--info)]',
  };

  return (
    <div className="space-y-4">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={`${greeting()}${me?.name ? `, ${me.name.split(' ')[0]}` : ''}`}
        description={new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        actions={(
          <>
            <Segmented options={PERIODS.map((o) => ({ value: o.key, label: o.label }))} value={period} onChange={setPeriod} />
            <IconButton label="Refresh" className="!size-9 border border-[color:var(--border)] bg-[color:var(--surface-elevated)]" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="size-4" />
            </IconButton>
          </>
        )}
      />

      {/* ── Company renewals (licences / warranties; Company module only) ───── */}
      <CompanyRenewalStrip />

      {/* ── Alert strip ──────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {alerts.map((a) => (
            <div key={a.key} className={cn('flex items-center gap-2.5 rounded-[8px] border px-3 py-2 text-[13px]', ALERT_STYLE[a.tone])}>
              <a.icon className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate text-[color:var(--text-primary)]">{a.text}</span>
              <Link to={a.to} className="shrink-0 text-[12px] font-bold hover:underline">{a.cta} →</Link>
            </div>
          ))}
        </div>
      )}

      {/* ── KPI row ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total revenue" value={fmt(totalRevenue)} icon={IndianRupee} tone="primary"
          hint={<><Change value={revChange} /> vs previous {periodLabel}</>} />
        <Stat label="Transactions" value={fmtNum(totalOrders)} icon={ShoppingCart} tone="info"
          hint={<Change value={ordChange} />} />
        <Stat label="Total customers" value={fmtNum(totalCust)} icon={Users}
          hint={<><Change value={newCustChange} /> {perf?.newCustomers?.value ?? 0} new this period</>} />
        <Stat label="Avg order value" value={fmt(aov)} icon={BarChart2} tone="accent"
          hint={<Change value={aovChange} />} />
        <Link to="/admin/inventory" className="block">
          <Stat label="Low stock items" value={lowStock} icon={Package} tone={lowStock > 0 ? 'danger' : 'neutral'}
            hint="Below reorder point · View →" className="h-full hover:border-[color:var(--border-strong)]" />
        </Link>
        <Link to="/admin/orders" className="block">
          <Stat label="Pending orders" value={pendingOrders} icon={Clock} tone={pendingOrders > 0 ? 'warning' : 'neutral'}
            hint="Awaiting action · View →" className="h-full hover:border-[color:var(--border-strong)]" />
        </Link>
      </div>

      {/* ── Revenue chart + sources ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={`Monthly revenue · ${analytics.revenue?.year ?? new Date().getFullYear()}`}
          actions={<span className="text-[12px] text-[color:var(--text-muted)]">Annual total <b className="tabular-nums text-[color:var(--text-primary)]">{fmt(annualRevenue)}</b></span>}
          bodyClassName="p-4"
        >
          {revMonths.length > 0 ? (
            <>
              <div className="flex h-44 items-end gap-1 px-1">
                {revMonths.map((m, i) => {
                  const hPct      = Math.max(((m.revenue ?? 0) / maxRevBar) * 100, 2);
                  const isCurrent = i === new Date().getMonth();
                  return (
                    <div key={m.month || i} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[6px] bg-[color:var(--text-primary)] px-2 py-1 text-[11px] leading-snug text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {m.month}<br />
                        <b>{fmt(m.revenue ?? 0)}</b> · {m.orders ?? 0} txn
                      </div>
                      <div
                        className={cn('w-full rounded-t-[3px] transition-colors', isCurrent ? 'bg-[color:var(--accent)]' : 'bg-[rgba(26,92,46,0.28)] group-hover:bg-[rgba(26,92,46,0.6)]')}
                        style={{ height: `${hPct}%` }}
                      />
                      <span className={cn('text-[10px]', isCurrent ? 'font-bold text-[color:var(--accent-strong)]' : 'text-[color:var(--text-muted)]')}>
                        {(m.month ?? '').slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-[12px] text-[color:var(--text-muted)]">
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-[rgba(26,92,46,0.28)]" /> Past months</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-[color:var(--accent)]" /> Current month</span>
              </div>
            </>
          ) : (
            <EmptyState icon={BarChart2} title={loading ? 'Loading…' : 'No revenue data yet'} />
          )}
        </Card>

        <Card title="Revenue sources" actions={<Badge>{periodLabel}</Badge>} bodyClassName="p-4">
          <div className="mb-4">
            <div className="text-[20px] font-bold tabular-nums text-[color:var(--text-primary)]">{fmt(revSources?.total ?? 0)}</div>
            <div className="text-[12px] text-[color:var(--text-muted)]">Total revenue this period</div>
          </div>
          {revSources?.sources && revSources.total > 0 ? (
            <>
              <div className="mb-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {revSources.sources.map((s, i) => (
                  <div key={s.source} className="rounded-full transition-[width] duration-500" style={{ width: `${s.pct ?? 0}%`, backgroundColor: SOURCE_COLORS[i] }} />
                ))}
              </div>
              <div className="space-y-2.5">
                {revSources.sources.map((s, i) => (
                  <div key={s.source} className="flex items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: SOURCE_COLORS[i] }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-bold text-[color:var(--text-secondary)]">{s.source}</span>
                        <span className="font-bold tabular-nums">{fmt(s.revenue)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[12px] text-[color:var(--text-muted)]">
                        <span>{s.count} transactions</span>
                        <span className="tabular-nums">{s.pct}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={PieChart} title="No data for this period" />
          )}
        </Card>
      </div>

      {/* ── Invoice / Order status + Business KPIs + Quick access ─────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card title="Invoice status" actions={<CardLink to="/admin/billing">View all</CardLink>} bodyClassName="p-4">
          {invoiceRows.length > 0 ? (
            <div className="space-y-2.5">
              {invoiceRows.map((row) => (
                <div key={row.status}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    <span className="flex items-center gap-2">
                      <span className="text-[12px] text-[color:var(--text-muted)] tabular-nums">{row.count}</span>
                      <span className="font-bold tabular-nums">{fmt(row.revenue)}</span>
                    </span>
                  </div>
                  <Meter pct={(row.count / maxInvCount) * 100} color={STATUS_BAR[row.status] ?? 'var(--border-strong)'} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FileText} title="No invoices this period" />
          )}

          {orderRows.length > 0 && (
            <div className="mt-4 border-t border-[color:var(--border)] pt-3">
              <div className="mb-2 text-[12px] font-bold text-[color:var(--text-muted)]">Orders</div>
              <div className="space-y-1.5">
                {orderRows.map((row) => (
                  <div key={row.status} className="flex items-center gap-2 text-[12px]">
                    <span className="w-24 truncate text-[color:var(--text-secondary)]">{row.status}</span>
                    <Meter className="flex-1" pct={(row.count / maxOrdCount) * 100} color={STATUS_BAR[row.status] ?? 'var(--border-strong)'} />
                    <span className="w-6 text-right font-bold tabular-nums">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Business KPIs" bodyClassName="p-4">
          <div className="space-y-3">
            {[
              { icon: Star,      tone: 'text-[color:var(--accent-strong)]', label: 'Avg product rating', value: kpis?.avgRating       ? `${kpis.avgRating}/5`        : '—', sub: 'across all products'            },
              { icon: RotateCcw, tone: 'text-[color:var(--danger)]',        label: 'Return rate',        value: kpis?.returnRate != null ? `${kpis.returnRate}%`       : '—', sub: 'of all transactions'            },
              { icon: Users,     tone: 'text-[color:var(--primary)]',       label: 'Repeat buyers',      value: kpis?.repeatBuyerPct != null ? `${kpis.repeatBuyerPct}%` : '—', sub: `${kpis?.repeatBuyers ?? 0} / ${kpis?.totalBuyers ?? 0} buyers` },
              { icon: Truck,     tone: 'text-[color:var(--info)]',          label: 'Avg delivery',       value: kpis?.avgDeliveryDays != null ? `${kpis.avgDeliveryDays}d` : '—', sub: 'order to delivery'             },
            ].map((k) => (
              <div key={k.label} className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-[6px] bg-[color:var(--surface-secondary)]">
                  <k.icon className={cn('size-4', k.tone)} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[color:var(--text-secondary)]">{k.label}</span>
                    <span className="font-bold tabular-nums">{k.value}</span>
                  </div>
                  <div className="text-[12px] text-[color:var(--text-muted)]">{k.sub}</div>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-3 gap-2 border-t border-[color:var(--border)] pt-3 text-center">
              {[
                { label: 'Active products', value: kpis?.activeProducts ?? 0 },
                { label: `New customers · ${periodLabel}`, value: kpis?.newCustomers ?? 0 },
                { label: `Reviews · ${periodLabel}`,       value: kpis?.reviewsThisMonth ?? 0 },
              ].map((s) => (
                <div key={s.label} className="rounded-[6px] bg-[color:var(--surface-secondary)] px-2 py-2">
                  <div className="text-[15px] font-bold tabular-nums">{s.value}</div>
                  <div className="text-[11px] leading-tight text-[color:var(--text-muted)]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Quick access" bodyClassName="p-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { to: '/admin/billing',   icon: FileText,    label: 'Invoice'   },
              { to: '/admin/orders',    icon: ShoppingBag, label: 'Orders'    },
              { to: '/admin/products',  icon: Boxes,       label: 'Products'  },
              { to: '/admin/inventory', icon: Warehouse,   label: 'Inventory' },
              { to: '/admin/purchase',  icon: ShoppingCart, label: 'Purchase' },
              { to: '/admin/customers', icon: Users,       label: 'Customers' },
              { to: '/admin/reports',   icon: BarChart2,   label: 'Reports'   },
              { to: '/admin/staff',     icon: UserCog,     label: 'Staff'     },
            ].map((q) => (
              <Link key={q.to} to={q.to}
                className="flex items-center gap-2 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-3 py-2.5 text-[13px] font-bold text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--primary-soft)] hover:text-[color:var(--primary)]">
                <q.icon className="size-4 shrink-0" strokeWidth={1.75} />
                {q.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Top products + Sales by category ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card title="Top products" actions={<CardLink to="/admin/products">View all</CardLink>} bodyClassName="p-3">
          {topProducts.length > 0 ? (
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="w-10 text-right">#</th>
                    <th className="text-left">Product</th>
                    <th className="text-left">Share</th>
                    <th className="text-right">Units</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.slice(0, 7).map((p, i) => (
                    <tr key={p.name || i}>
                      <td className="text-right tabular-nums text-[color:var(--text-muted)]">{i + 1}</td>
                      <td className="max-w-[220px] truncate font-bold">{p.name}</td>
                      <td className="w-[28%]"><Meter pct={((p.revenue ?? 0) / maxProduct) * 100} color="var(--primary)" /></td>
                      <td className="text-right tabular-nums">{p.units}</td>
                      <td className="text-right font-bold tabular-nums">{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Boxes} title="No product sales data for this period" />
          )}
        </Card>

        <Card title="Sales by category" actions={<Badge>{periodLabel}</Badge>} bodyClassName="p-3">
          {categories.length > 0 ? (
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Category</th>
                    <th className="text-left">Share</th>
                    <th className="text-right">%</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.slice(0, 7).map((c, i) => (
                    <tr key={c.slug || c.name || i}>
                      <td className="font-bold">
                        <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                        {c.name}
                      </td>
                      <td className="w-[34%]"><Meter pct={c.pct} color={CAT_COLORS[i % CAT_COLORS.length]} /></td>
                      <td className="text-right tabular-nums text-[color:var(--text-muted)]">{c.pct}%</td>
                      <td className="text-right font-bold tabular-nums">{fmt(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={PieChart} title="No category sales data for this period" />
          )}
        </Card>
      </div>

      {/* ── Recent transactions ───────────────────────────────────────────────── */}
      <Card
        title="Recent transactions · invoices, orders & sales bills"
        actions={<CardLink to="/admin/billing">Invoices</CardLink>}
        bodyClassName="p-3"
      >
        {recentTx.length === 0 && !loading ? (
          <EmptyState icon={Receipt} title="No transactions yet" />
        ) : (
          <div className="grid-box">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Reference</th>
                  <th className="text-left">Customer</th>
                  <th className="text-right">Amount</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Source</th>
                  <th className="text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.slice(0, 10).map((tx, i) => (
                  <tr key={tx.ref || i}>
                    <td className="whitespace-nowrap font-bold text-[color:var(--primary)]">{tx.ref}</td>
                    <td>
                      <span className="font-bold">{tx.customer}</span>
                      {tx.city && <span className="ml-1.5 text-[12px] text-[color:var(--text-muted)]">{tx.city}</span>}
                    </td>
                    <td className="whitespace-nowrap text-right font-bold tabular-nums">₹{(tx.amount ?? 0).toLocaleString('en-IN')}</td>
                    <td><Badge tone={statusTone(tx.status)}>{tx.status}</Badge></td>
                    <td><Badge tone={SOURCE_TONE[tx.source] ?? 'neutral'}>{tx.source}</Badge></td>
                    <td className="whitespace-nowrap text-[color:var(--text-muted)]">
                      {tx.date ? new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}
