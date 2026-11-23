import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, ShoppingBag, Users, IndianRupee, RefreshCw, FileText, Receipt,
  Truck, RotateCcw, Star, Repeat, Boxes, MessageSquare, BarChart2, PieChart, Wallet,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchAnalyticsPerformance,
  fetchAnalyticsRevenue,
  fetchAnalyticsRevenueSources,
  fetchAnalyticsSalesByCategory,
  fetchAnalyticsTopProducts,
  fetchAnalyticsKpis,
  fetchAnalyticsOrderStatus,
  fetchAnalyticsRecentOrders,
} from '@/store/slices/adminSlice';
import {
  PageHeader, Card, Stat, Badge, statusTone, Segmented, IconButton, EmptyState, cn,
} from '@/admin/ui';
import { useLookups } from '@/admin/lookups';

// Rolling windows — must match AdminAnalyticsController.PeriodRange (week / month / 3month / year)
const PERIODS = [
  { value: 'week',   label: '7 days'   },
  { value: 'month',  label: '30 days'  },
  { value: '3month', label: '90 days'  },
  { value: 'year',   label: '12 months' },
];

const CAT_COLORS = [
  '#1a5c2e', '#f5a623', '#1e5fa8', '#b0382f', '#7a4fa0',
  '#1f7a50', '#c97d06', '#2f8f8a', '#8a6d3b', '#5a6b2f',
];

const SOURCE_TONE = { Invoice: 'success', Order: 'info', Bill: 'accent' };

const fmt  = (n) => n == null ? '—' : Number(n).toLocaleString('en-IN');
const fmtL = (n) => {
  if (n == null) return '—';
  const v = Number(n);
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${fmt(v)}`;
};

function ChangeChip({ change }) {
  if (!change || change === 'N/A') return null;
  const pos = change.startsWith('+');
  const neg = change.startsWith('-');
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-bold', pos ? 'text-[color:var(--success)]' : neg ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-muted)]')}>
      {pos ? <TrendingUp className="size-3" /> : neg ? <TrendingDown className="size-3" /> : null}
      {change}
    </span>
  );
}

function Meter({ pct, color, className }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-hover)]', className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, backgroundColor: color }} />
    </div>
  );
}

function BarChart({ data, valueKey, color, height = 160 }) {
  const values = data.map(d => Number(d[valueKey]) || 0);
  const max    = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const pct = (values[i] / max) * 100;
        return (
          <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-[color:var(--text-primary)] px-1.5 py-0.5 text-[11px] text-white opacity-0 group-hover:opacity-100">
              {valueKey === 'revenue' ? fmtL(values[i]) : fmt(values[i])}
            </div>
            <div
              className="w-full rounded-t-[3px] transition-all duration-500"
              style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: color, opacity: pct > 0 ? 0.75 : 0.15 }}
            />
            <span className="text-[10px] text-[color:var(--text-muted)]">{(d.month || '').slice(0, 3)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** One block of "status · meter · count · revenue" rows for the transaction status card */
function StatusGroup({ title, rows, color }) {
  if (!rows.length) return null;
  const total = rows.reduce((a, x) => a + (x.Count || x.count || 0), 0);
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-bold text-[color:var(--text-muted)]">{title}</div>
      <div className="grid-box">
        <table>
          <thead>
            <tr>
              <th className="text-left">Status</th>
              <th className="text-left">Share</th>
              <th className="text-right">Count</th>
              <th className="text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => {
              const status = s.Status || s.status || '—';
              const count  = s.Count  || s.count  || 0;
              const rev    = s.Revenue || s.revenue || 0;
              const pct    = total > 0 ? Math.round(count / total * 100) : 0;
              return (
                <tr key={status}>
                  <td><Badge tone={statusTone(status)}>{status}</Badge></td>
                  <td className="w-[40%]"><Meter pct={pct} color={color} /></td>
                  <td className="text-right font-bold tabular-nums">{count}</td>
                  <td className="text-right tabular-nums text-[color:var(--text-muted)]">{fmtL(rev)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const dispatch = useAppDispatch();
  const { performance, revenue, revenueSources, salesByCategory, topProducts, kpis, orderStatus, recentOrders } =
    useAppSelector((s) => s.admin.analytics);
  const loading = useAppSelector((s) => s.admin.loading);

  const lk = useLookups();
  const [period, setPeriod] = useState('month');
  const [year, setYear]     = useState(() => new Date().getFullYear());
  const [refreshKey, setRefreshKey] = useState(0);
  const periodLabel = PERIODS.find((p) => p.value === period)?.label;
  const yearOptions = (lk.years || []).filter((y) => y <= lk.currentYear);

  // period-scoped widgets (incl. KPIs) reload whenever the period changes
  useEffect(() => {
    dispatch(fetchAnalyticsPerformance({ period }));
    dispatch(fetchAnalyticsRevenueSources({ period }));
    dispatch(fetchAnalyticsSalesByCategory({ period }));
    dispatch(fetchAnalyticsTopProducts({ period, limit: 8 }));
    dispatch(fetchAnalyticsOrderStatus({ period }));
    dispatch(fetchAnalyticsKpis({ period }));
  }, [dispatch, period, refreshKey]);

  // monthly charts follow the selected year
  useEffect(() => { dispatch(fetchAnalyticsRevenue({ year })); }, [dispatch, year, refreshKey]);
  useEffect(() => { dispatch(fetchAnalyticsRecentOrders({ limit: 8 })); }, [dispatch, refreshKey]);

  const months = revenue?.Months || revenue?.months || [];
  const totalRevYear = months.reduce((s, m) => s + (m.Revenue || m.revenue || 0), 0);
  const totalOrdYear = months.reduce((s, m) => s + (m.Orders  || m.orders  || 0), 0);
  const normalizedMonths = months.map(m => ({
    month:   m.Month   || m.month   || '',
    revenue: m.Revenue || m.revenue || 0,
    orders:  m.Orders  || m.orders  || 0,
  }));

  const perf = performance || {};

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpiCards = [
    {
      label: 'Total Revenue',
      value: fmtL(perf.Revenue?.Value ?? perf.revenue?.value),
      change: perf.Revenue?.Change ?? perf.revenue?.change,
      icon: IndianRupee,
      tone: 'primary',
    },
    {
      label: 'Transactions',
      value: fmt(perf.Orders?.Value ?? perf.orders?.value),
      change: perf.Orders?.Change ?? perf.orders?.change,
      icon: ShoppingBag,
      tone: 'info',
    },
    {
      label: 'New Customers',
      value: fmt(perf.NewCustomers?.Value ?? perf.newCustomers?.value),
      change: perf.NewCustomers?.Change ?? perf.newCustomers?.change,
      sub: `${fmt(perf.NewCustomers?.Total ?? perf.newCustomers?.total)} total`,
      icon: Users,
      tone: 'neutral',
    },
    {
      label: 'Avg Txn Value',
      value: fmtL(perf.AvgOrderValue?.Value ?? perf.avgOrderValue?.value),
      change: perf.AvgOrderValue?.Change ?? perf.avgOrderValue?.change,
      icon: TrendingUp,
      tone: 'accent',
    },
  ];

  // ── revenue source bars ────────────────────────────────────────────────────
  const sources = revenueSources?.Sources || revenueSources?.sources || [];
  const sourceTotal = revenueSources?.Total ?? revenueSources?.total ?? 0;

  // ── order status (now split by Orders / Invoices / Bills) ─────────────────
  const orderStatusOrders   = orderStatus?.Orders   || orderStatus?.orders   || [];
  const orderStatusInvoices = orderStatus?.Invoices  || orderStatus?.invoices  || [];
  const orderStatusBills    = orderStatus?.Bills     || orderStatus?.bills     || [];

  // ── performance KPI tiles ─────────────────────────────────────────────────
  const perfTiles = [
    { label: 'Avg Delivery',   value: kpis ? `${kpis.AvgDeliveryDays ?? kpis.avgDeliveryDays ?? 0} days` : '—', icon: Truck, tone: 'info' },
    { label: 'Return Rate',    value: kpis ? `${kpis.ReturnRate ?? kpis.returnRate ?? 0}%` : '—',                  icon: RotateCcw, tone: 'danger' },
    { label: 'Avg Rating',     value: kpis ? `${kpis.AvgRating ?? kpis.avgRating ?? 0}★` : '—',                   icon: Star, tone: 'accent' },
    { label: 'Repeat Buyers',  value: kpis ? `${kpis.RepeatBuyerPct ?? kpis.repeatBuyerPct ?? 0}%` : '—',         icon: Repeat, tone: 'primary' },
    { label: 'Active Products',value: fmt(kpis?.ActiveProducts ?? kpis?.activeProducts),                            icon: Boxes, tone: 'success' },
    { label: `Reviews · ${periodLabel}`, value: fmt(kpis?.ReviewsThisMonth ?? kpis?.reviewsThisMonth),            icon: MessageSquare, tone: 'neutral' },
  ];

  const refreshAll = () => setRefreshKey((k) => k + 1);
  const unpaidCount   = perf.unpaidInvoices ?? perf.UnpaidInvoices ?? 0;
  const unpaidAmount  = kpis?.unpaidAmount ?? kpis?.UnpaidAmount ?? 0;
  const unpaidKpiCnt  = kpis?.unpaidInvoices ?? kpis?.UnpaidInvoices ?? 0;
  const expensesTotal = kpis?.expensesThisMonth ?? kpis?.ExpensesThisMonth ?? 0;
  const rangeText = perf.from && perf.to
    ? `${new Date(perf.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(perf.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : null;
  const SRC_COLORS = ['#1a5c2e', '#f5a623', '#1e5fa8'];

  return (
    <div className="space-y-4">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Analytics"
        description={`Live data from invoices, orders & sales bills${rangeText ? ` · ${rangeText}` : ''}`}
        actions={(
          <>
            <Segmented options={PERIODS} value={period} onChange={setPeriod} />
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Chart year" className="input-field !h-9 !w-auto">
              {(yearOptions.includes(year) ? yearOptions : [year, ...yearOptions]).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <IconButton label="Refresh" className="!size-9 border border-[color:var(--border)] bg-[color:var(--surface-elevated)]" onClick={refreshAll}>
              <RefreshCw className="size-4" />
            </IconButton>
          </>
        )}
      />

      {/* ── Alert: unpaid invoices ─────────────────────────────────────────── */}
      {unpaidCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-[8px] border border-[rgba(180,83,15,0.25)] bg-[color:var(--warning-bg)] px-3 py-2 text-[13px]">
          <FileText className="size-4 shrink-0 text-[color:var(--warning)]" strokeWidth={1.75} />
          <b className="text-[color:var(--warning)]">{unpaidCount} unpaid invoice{unpaidCount > 1 ? 's' : ''}</b>
          <span className="text-[color:var(--text-secondary)]">pending collection — these ARE counted in revenue above.</span>
        </div>
      )}

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Stat
            key={card.label}
            label={card.label}
            value={card.value ?? '—'}
            icon={card.icon}
            tone={card.tone}
            loading={loading && !performance}
            hint={(card.change && card.change !== 'N/A') || card.sub ? <><ChangeChip change={card.change} /> {card.sub}</> : null}
          />
        ))}
      </div>

      {/* ── Revenue by Source ─────────────────────────────────────────────── */}
      {sources.length > 0 && (
        <Card
          title="Revenue by source"
          actions={<span className="text-[15px] font-bold tabular-nums text-[color:var(--primary)]">{fmtL(sourceTotal)}</span>}
          bodyClassName="p-3"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {sources.map((src, i) => {
              const name  = src.Source || src.source || '';
              const rev   = src.Revenue ?? src.revenue ?? 0;
              const pct   = src.Pct    ?? src.pct    ?? 0;
              const count = src.Count  ?? src.count  ?? 0;
              const color = SRC_COLORS[i % 3];
              return (
                <div key={name} className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3.5 py-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="inline-flex items-center gap-1.5 font-bold text-[color:var(--text-secondary)]">
                      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />{name}
                    </span>
                    <span className="font-bold tabular-nums" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="mt-0.5 text-[18px] font-bold tabular-nums">{fmtL(rev)}</div>
                  <div className="text-[12px] text-[color:var(--text-muted)]">{count} transaction{count !== 1 ? 's' : ''}</div>
                  <Meter className="mt-2" pct={pct} color={color} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Monthly Revenue + Orders charts ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card
          title={`Monthly revenue · ${year}`}
          actions={<span className="text-[15px] font-bold tabular-nums text-[color:var(--primary)]">{fmtL(totalRevYear)}</span>}
          bodyClassName="p-4"
        >
          {normalizedMonths.length > 0 ? (
            <BarChart data={normalizedMonths} valueKey="revenue" color="#1a5c2e" height={160} />
          ) : (
            <EmptyState icon={BarChart2} title="No revenue data" />
          )}
        </Card>

        <Card
          title={`Monthly transactions · ${year}`}
          actions={<span className="text-[15px] font-bold tabular-nums text-[color:var(--accent-strong)]">{fmt(totalOrdYear)}</span>}
          bodyClassName="p-4"
        >
          {normalizedMonths.length > 0 ? (
            <BarChart data={normalizedMonths} valueKey="orders" color="#f5a623" height={160} />
          ) : (
            <EmptyState icon={BarChart2} title="No data" />
          )}
        </Card>
      </div>

      {/* ── Sales by Category + Top Products ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card title="Sales by category" bodyClassName="p-3">
          {salesByCategory.length > 0 ? (
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
                  {salesByCategory.map((cat, i) => {
                    const name  = cat.Name  || cat.name  || 'Other';
                    const pct   = cat.Pct   || cat.pct   || 0;
                    const rev   = cat.Revenue || cat.revenue || 0;
                    const color = CAT_COLORS[i % CAT_COLORS.length];
                    return (
                      <tr key={name}>
                        <td className="max-w-[200px] truncate font-bold">
                          <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: color }} />{name}
                        </td>
                        <td className="w-[36%]"><Meter pct={pct} color={color} /></td>
                        <td className="text-right font-bold tabular-nums">{pct}%</td>
                        <td className="text-right tabular-nums text-[color:var(--text-muted)]">{fmtL(rev)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={PieChart} title="No category sales for this period" />
          )}
        </Card>

        <Card title="Top selling products" bodyClassName="p-3">
          {topProducts.length > 0 ? (
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="w-10 text-right">#</th>
                    <th className="text-left">Product</th>
                    <th className="text-left">Units sold</th>
                    <th className="text-right">Units</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => {
                    const name     = p.Name || p.name || p.ProductName || p.productName || '—';
                    const units    = p.Units || p.units || 0;
                    const rev      = p.Revenue || p.revenue || 0;
                    const maxUnits = topProducts[0]?.Units || topProducts[0]?.units || 1;
                    return (
                      <tr key={i}>
                        <td className="text-right tabular-nums text-[color:var(--text-muted)]">{i + 1}</td>
                        <td className="max-w-[200px] truncate font-bold">{name}</td>
                        <td className="w-[28%]"><Meter pct={Math.round((units / maxUnits) * 100)} color="var(--primary)" /></td>
                        <td className="text-right tabular-nums">{fmt(units)}</td>
                        <td className="text-right font-bold tabular-nums text-[color:var(--primary)]">{fmtL(rev)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Boxes} title="No sales data for this period" />
          )}
        </Card>
      </div>

      {/* ── Transaction Status + Recent Transactions ───────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card title="Transaction status" bodyClassName="p-3">
          {(orderStatusOrders.length + orderStatusInvoices.length + orderStatusBills.length) > 0 ? (
            <div className="space-y-3">
              <StatusGroup title="Invoices" rows={orderStatusInvoices} color="var(--success)" />
              <StatusGroup title="Orders" rows={orderStatusOrders} color="var(--info)" />
              <StatusGroup title="Sales bills" rows={orderStatusBills} color="var(--accent)" />
            </div>
          ) : (
            <EmptyState icon={FileText} title="No transaction data for this period" />
          )}
        </Card>

        <Card title="Recent transactions" bodyClassName="p-3">
          {recentOrders.length > 0 ? (
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Source</th>
                    <th className="text-left">Customer</th>
                    <th className="text-left">Reference</th>
                    <th className="text-left">Status</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o, i) => {
                    const status = o.Status || o.status || '—';
                    const source = o.Source || o.source || '';
                    const ref    = o.Ref    || o.ref    || '—';
                    const cust   = o.Customer || o.customer || '—';
                    const city   = o.City  || o.city;
                    const amount = o.Amount || o.amount || 0;
                    const SrcIcon = source === 'Invoice' ? FileText : source === 'Bill' ? Receipt : ShoppingBag;
                    return (
                      <tr key={i}>
                        <td><Badge tone={SOURCE_TONE[source] ?? 'neutral'}><SrcIcon className="size-3" />{source || '—'}</Badge></td>
                        <td>
                          <span className="font-bold">{cust}</span>
                          {city && <span className="ml-1.5 text-[12px] text-[color:var(--text-muted)]">{city}</span>}
                        </td>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">{ref}</td>
                        <td><Badge tone={statusTone(status)}>{status}</Badge></td>
                        <td className="text-right font-bold tabular-nums text-[color:var(--primary)]">{fmtL(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Receipt} title="No recent transactions" />
          )}
        </Card>
      </div>

      {/* ── Performance KPIs ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-[13px] font-bold text-[color:var(--text-primary)]">Performance KPIs</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {perfTiles.map((tile) => (
            <Stat key={tile.label} label={tile.label} value={tile.value} icon={tile.icon} tone={tile.tone} loading={loading && !kpis} />
          ))}
        </div>
      </div>

      {/* ── Unpaid / Expenses summary ─────────────────────────────────────── */}
      {kpis && (unpaidAmount > 0 || expensesTotal > 0) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {unpaidAmount > 0 && (
            <Stat
              label="Receivable (unpaid invoices)"
              value={fmtL(unpaidAmount)}
              icon={FileText}
              tone="warning"
              hint={`${unpaidKpiCnt} invoice${unpaidKpiCnt !== 1 ? 's' : ''} pending collection`}
            />
          )}
          {expensesTotal > 0 && (
            <Stat
              label={`Expenses · last ${periodLabel}`}
              value={fmtL(expensesTotal)}
              icon={Wallet}
              tone="danger"
              hint="Tracked expense entries"
            />
          )}
        </div>
      )}

    </div>
  );
}
