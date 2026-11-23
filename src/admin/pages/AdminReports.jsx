import { useState, useRef, useEffect } from 'react';
import {
  Download, Printer, RefreshCw, TrendingUp, TrendingDown, FileSpreadsheet,
  BarChart3, Wallet, Receipt, Package, Percent, CalendarRange,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchSalesReport,
  fetchPLReport,
  fetchGstReport,
  fetchStockReport,
  fetchMarginReport,
  fetchYoYReport,
  downloadReport,
  fetchSettings,
} from '@/store/slices/adminSlice';
import { useLookups, MONTH_NAMES } from '@/admin/lookups';
import toast from 'react-hot-toast';
import { PageHeader, Card, Tabs, Segmented, Button, Badge, statusTone, EmptyState as UiEmptyState, cn } from '@/admin/ui';

// ── constants ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'sales',  label: 'Sales',     icon: BarChart3     },
  { key: 'pl',     label: 'P & L',     icon: Wallet        },
  { key: 'gst',    label: 'GST',       icon: Receipt       },
  { key: 'stock',  label: 'Stock',     icon: Package       },
  { key: 'margin', label: 'Margin',    icon: Percent       },
  { key: 'yoy',    label: 'YoY',       icon: CalendarRange },
];

// local-date YYYY-MM-DD (toISOString would shift to UTC and can land on the previous day in IST)
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today       = ymd(new Date());
const monthStart  = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const yearNow     = new Date().getFullYear();

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n) => n == null ? '—' : Number(n).toLocaleString('en-IN');
const fmtC = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`;
const pct  = (n) => n == null ? '—' : `${n}%`;
const isCountMetric = (m) => /customer|transaction/i.test(m || '');

// Report tables are print targets (their innerHTML is copied into a print window),
// so they opt out of the admin data-grid CSS with `no-grid` and keep their own compact styling.
function Th({ children, right }) {
  return (
    <th className={`whitespace-nowrap bg-[#1a5c2e] px-3 py-[7px] text-[12px] font-bold text-white ${right ? 'right text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}
function Td({ children, right, bold, green, red, muted, colSpan }) {
  return (
    <td colSpan={colSpan} className={cn(
      'whitespace-nowrap border-b border-[color:var(--border)] px-3 py-[7px] text-[13px]',
      right && 'right text-right tabular-nums',
      bold && 'font-bold',
      green && 'green font-bold !text-[color:var(--success)]',
      red && 'red font-bold !text-[color:var(--danger)]',
      muted ? 'text-[color:var(--text-muted)]' : 'text-[color:var(--text-primary)]',
    )}>
      {children}
    </td>
  );
}

/** Bordered box holding one printable report table */
function ReportTable({ title, children }) {
  return (
    <div className="no-grid overflow-hidden rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)]">
      {title && <div className="section-title border-b border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3 py-2 text-[13px] font-bold text-[color:var(--text-primary)]">{title}</div>}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

/** KPI tile that keeps the kpi-* classes used by the print stylesheet */
function KpiTile({ label, value }) {
  return (
    <div className="kpi-card min-w-0 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3">
      <div className="kpi-label truncate text-[12px] text-[color:var(--text-muted)]">{label}</div>
      <div className="kpi-value mt-0.5 truncate text-[18px] font-bold tabular-nums text-[color:var(--text-primary)]">{value}</div>
    </div>
  );
}

function EmptyState({ text = 'Generate the report to see data here' }) {
  return (
    <Card>
      <UiEmptyState icon={FileSpreadsheet} title="No report yet">{text}</UiEmptyState>
    </Card>
  );
}

function StatusBadge({ status }) {
  const map = { Invoice: 'success', Order: 'info', Bill: 'accent' };
  return <Badge tone={map[status] || statusTone(status)}>{status}</Badge>;
}

// ── module-scope building blocks (stable identity → no remount on parent render) ──
// ── shared filter bar ─────────────────────────────────────────────────────
function FilterBar({ children, onGenerate, loading }) {
  return (
  <Card bodyClassName="flex flex-wrap items-end gap-3 p-3">
    {children}
    <Button onClick={onGenerate} disabled={loading} className="ml-auto">
      <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
      Generate
    </Button>
  </Card>
  );
}

function FilterField({ label, children }) {
  return (
  <label className="flex flex-col gap-1">
    <span className="text-[12px] font-bold text-[color:var(--text-secondary)]">{label}</span>
    {children}
  </label>
  );
}

const inputCls = "input-field !h-9 !w-auto min-w-[150px]";

// ── action bar (download + print) ─────────────────────────────────────────
function ActionBar({ onDownload, onPrint, downloading }) {
  return (
  <div className="flex items-center gap-2 justify-end">
    <Button variant="secondary" onClick={onDownload} loading={downloading}>
      {!downloading && <Download className="size-4" />}
      {downloading ? 'Downloading…' : 'Download Excel'}
    </Button>
    <Button variant="secondary" onClick={onPrint}>
      <Printer className="size-4" />
      Print
    </Button>
  </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TAB CONTENT
// ─────────────────────────────────────────────────────────────────────────

function SalesContent({ d, filters: salesFilters, setFilters: setSalesFilters, bar, years, subTab, title }) {
  return (
    <>
      <FilterBar onGenerate={bar.onGenerate} loading={bar.loading}>
        <FilterField label="From">
          <input type="date" value={salesFilters.from} onChange={e => setSalesFilters(f => ({ ...f, from: e.target.value }))} className={inputCls} />
        </FilterField>
        <FilterField label="To">
          <input type="date" value={salesFilters.to} onChange={e => setSalesFilters(f => ({ ...f, to: e.target.value }))} className={inputCls} />
        </FilterField>
        <FilterField label="Group By">
          <select value={salesFilters.groupBy} onChange={e => setSalesFilters(f => ({ ...f, groupBy: e.target.value }))} className={inputCls}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </FilterField>
      </FilterBar>

      {d ? (
        <div className="no-grid space-y-4" ref={bar.printRef}>
          {/* print header */}
          <div className="hidden print:block">
            <h1>{title} — Sales Report</h1>
            <div className="sub">{d.dateRange?.from?.slice(0, 10)} to {d.dateRange?.to?.slice(0, 10)}</div>
          </div>

          {/* KPI cards */}
          <div className="kpis grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Total Revenue',  value: fmtC(d.summary?.totalRevenue)       },
              { label: 'Transactions',   value: fmt(d.summary?.totalTransactions)    },
              { label: 'Avg Transaction',value: fmtC(d.summary?.avgTransactionValue) },
              { label: 'Invoice Revenue',value: fmtC(d.summary?.invoiceRevenue)      },
              { label: 'Order Revenue',  value: fmtC(d.summary?.orderRevenue)        },
              { label: 'Bill Revenue',   value: fmtC(d.summary?.billRevenue)         },
            ].map(c => (
              <KpiTile key={c.label} label={c.label} value={c.value} />
            ))}
          </div>

          <ActionBar {...bar} />

          {/* Grouped */}
          {d.grouped?.length > 0 && (
            <ReportTable title={<>Grouped by {salesFilters.groupBy}</>}>
                <table className="w-full">
                  <thead><tr>
                    <Th>Period</Th><Th right>Revenue</Th><Th right>Transactions</Th><Th right>Invoice</Th><Th right>Orders</Th><Th right>Bills</Th>
                  </tr></thead>
                  <tbody>
                    {d.grouped.map((row, i) => (
                      <tr key={i}>
                        <Td bold>{row.period}</Td>
                        <Td right green>{fmtC(row.revenue)}</Td>
                        <Td right>{fmt(row.transactions)}</Td>
                        <Td right muted>{fmtC(row.invoiceRev)}</Td>
                        <Td right muted>{fmtC(row.orderRev)}</Td>
                        <Td right muted>{fmtC(row.billRev)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </ReportTable>
          )}

          {/* All Transactions */}
          <ReportTable title="All Transactions">
            {d.transactions?.length > 0 ? (
                <table className="w-full">
                  <thead><tr>
                    <Th>Date</Th><Th>Reference</Th><Th>Customer</Th><Th>Source</Th><Th right>Amount</Th>
                  </tr></thead>
                  <tbody>
                    {d.transactions.map((row, i) => (
                      <tr key={i}>
                        <Td muted>{row.date}</Td>
                        <Td bold>{row.ref}</Td>
                        <Td>{row.customer}</Td>
                        <Td><StatusBadge status={row.source} /></Td>
                        <Td right green>{fmtC(row.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            ) : (
              <UiEmptyState icon={FileSpreadsheet} title="No transactions in this period" />
            )}
          </ReportTable>
        </div>
      ) : <EmptyState />}
    </>
  );
};

function PLContent({ d, filters: plFilters, setFilters: setPlFilters, bar, years, subTab, title }) {
  return (
    <>
      <FilterBar onGenerate={bar.onGenerate} loading={bar.loading}>
        <FilterField label="Year">
          <select value={plFilters.year} onChange={e => setPlFilters(f => ({ ...f, year: Number(e.target.value) }))} className={inputCls}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </FilterField>
        <FilterField label="Month (optional)">
          <select value={plFilters.month} onChange={e => setPlFilters(f => ({ ...f, month: e.target.value }))} className={inputCls}>
            <option value="">Full Year</option>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </FilterField>
      </FilterBar>

      {d ? (
        <div className="no-grid space-y-4" ref={bar.printRef}>
          <div className="hidden print:block">
            <h1>{title} — P&amp;L Report</h1>
            <div className="sub">{d.period}</div>
          </div>

          <ActionBar {...bar} />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Income Statement */}
            <ReportTable title={<>Income Statement — {d.period}</>}>
                <table className="w-full">
                  <thead><tr><Th>Item</Th><Th right>Amount</Th></tr></thead>
                  <tbody>
                    <tr><Td bold>Total Revenue</Td><Td right green>{fmtC(d.revenue)}</Td></tr>
                    <tr><Td muted>↳ Invoice Revenue</Td><Td right muted>{fmtC(d.invoiceRevenue)}</Td></tr>
                    <tr><Td muted>↳ Order Revenue</Td><Td right muted>{fmtC(d.orderRevenue)}</Td></tr>
                    <tr><Td muted>↳ Bill Revenue</Td><Td right muted>{fmtC(d.billRevenue)}</Td></tr>
                    <tr className="bg-[color:var(--surface-secondary)]"><Td bold>Cost of Goods (COGS)</Td><Td right red>{d.cogs > 0 ? `(${fmtC(d.cogs)})` : '—'}</Td></tr>
                    <tr className="bg-[color:var(--primary-soft)]"><Td bold>Gross Profit ({pct(d.grossMarginPct)} margin)</Td><Td right green bold>{fmtC(d.grossProfit)}</Td></tr>
                    {d.expenses?.map((exp, i) => (
                      <tr key={i}>
                        <Td muted>↳ {exp.category}</Td><Td right muted>({fmtC(exp.total)})</Td>
                      </tr>
                    ))}
                    <tr className="bg-[color:var(--surface-secondary)]"><Td bold>Total Expenses</Td><Td right red>{d.totalExpenses > 0 ? `(${fmtC(d.totalExpenses)})` : '—'}</Td></tr>
                    <tr className="border-t-2 border-[rgba(26,92,46,0.3)] bg-[rgba(26,92,46,0.1)]">
                      <Td bold>Net Profit ({pct(d.netMarginPct)} margin)</Td>
                      <Td right bold>
                        <span className={(d.netProfit ?? 0) >= 0 ? 'text-[color:var(--success)] font-bold text-[15px]' : 'text-[color:var(--danger)] font-bold text-[15px]'}>
                          {(d.netProfit ?? 0) >= 0 ? fmtC(d.netProfit) : `(${fmtC(Math.abs(d.netProfit))})`}
                        </span>
                      </Td>
                    </tr>
                  </tbody>
                </table>
            </ReportTable>

            {/* Monthly Breakdown */}
            <ReportTable title={<>Monthly Breakdown — {d.period?.split(' ').pop()}</>}>
                <table className="w-full">
                  <thead><tr><Th>Month</Th><Th right>Revenue</Th><Th right>Expenses</Th><Th right>Net Profit</Th></tr></thead>
                  <tbody>
                    {d.monthlyBreakdown?.map((row, i) => (
                      <tr key={i}>
                        <Td>{row.month}</Td>
                        <Td right green>{row.revenue > 0 ? fmtC(row.revenue) : '—'}</Td>
                        <Td right red>{row.expenses > 0 ? fmtC(row.expenses) : '—'}</Td>
                        <Td right bold>
                          <span className={(row.netProfit ?? 0) >= 0 ? 'text-[color:var(--success)]' : 'text-[color:var(--danger)]'}>
                            {row.revenue > 0 || row.expenses > 0 ? fmtC(row.netProfit) : '—'}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </ReportTable>
          </div>
        </div>
      ) : <EmptyState />}
    </>
  );
};

function GSTContent({ d, filters: gstFilters, setFilters: setGstFilters, bar, years, subTab, title }) {
  const [gstSubTab, setGstSubTab] = useState('invoices');
  return (
    <>
      <FilterBar onGenerate={bar.onGenerate} loading={bar.loading}>
        <FilterField label="From">
          <input type="date" value={gstFilters.from} onChange={e => setGstFilters(f => ({ ...f, from: e.target.value }))} className={inputCls} />
        </FilterField>
        <FilterField label="To">
          <input type="date" value={gstFilters.to} onChange={e => setGstFilters(f => ({ ...f, to: e.target.value }))} className={inputCls} />
        </FilterField>
      </FilterBar>

      {d ? (
        <div className="no-grid space-y-4" ref={bar.printRef}>
          <div className="hidden print:block">
            <h1>{title} — GST Report</h1>
            <div className="sub">{gstFilters.from} to {gstFilters.to}</div>
          </div>

          {/* Summary KPIs */}
          <div className="kpis grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            {[
              { label: 'Total Revenue', value: fmtC(d.summary?.totalRevenue)  },
              { label: 'Taxable Amount',value: fmtC(d.summary?.taxableAmount) },
              { label: 'CGST',          value: fmtC(d.summary?.totalCgst)     },
              { label: 'SGST',          value: fmtC(d.summary?.totalSgst)     },
              { label: 'IGST',          value: fmtC(d.summary?.totalIgst)     },
              { label: 'Total GST',     value: fmtC(d.summary?.totalTax)      },
            ].map(c => (
              <KpiTile key={c.label} label={c.label} value={c.value} />
            ))}
          </div>

          <ActionBar {...bar} />

          {/* Sub-tabs */}
          <Segmented
            options={[{ value: 'invoices', label: 'Invoice List' }, { value: 'hsn', label: 'HSN-wise Summary' }]}
            value={gstSubTab}
            onChange={setGstSubTab}
          />

          {gstSubTab === 'invoices' ? (
            <ReportTable>
                <table className="w-full">
                  <thead><tr>
                    <Th>Date</Th><Th>Invoice No</Th><Th>Customer</Th><Th>Type</Th>
                    <Th right>Taxable</Th><Th right>CGST</Th><Th right>SGST</Th><Th right>IGST</Th><Th right>Tax Total</Th><Th right>Grand Total</Th>
                  </tr></thead>
                  <tbody>
                    {d.invoices?.map((row, i) => (
                      <tr key={i}>
                        <Td muted>{new Date(row.date).toLocaleDateString('en-IN')}</Td>
                        <Td bold>{row.ref}</Td>
                        <Td>{row.customer}</Td>
                        <Td><Badge tone={row.type === 'B2B' ? 'info' : 'success'}>{row.type}</Badge></Td>
                        <Td right>{fmtC(row.taxable)}</Td>
                        <Td right muted>{fmtC(row.cgst)}</Td>
                        <Td right muted>{fmtC(row.sgst)}</Td>
                        <Td right muted>{fmtC(row.igst)}</Td>
                        <Td right>{fmtC(row.totalTax)}</Td>
                        <Td right green bold>{fmtC(row.grandTotal)}</Td>
                      </tr>
                    ))}
                    {!d.invoices?.length && <tr><Td colSpan={10}><div className="py-6 text-center text-[13px] text-[color:var(--text-muted)]">No invoices in this period</div></Td></tr>}
                  </tbody>
                </table>
            </ReportTable>
          ) : (
            <ReportTable>
                <table className="w-full">
                  <thead><tr>
                    <Th>HSN Code</Th><Th right>Taxable Amount</Th><Th right>GST Rate</Th><Th right>CGST</Th><Th right>SGST</Th><Th right>IGST</Th><Th right>Total Tax</Th><Th right>Line Total</Th>
                  </tr></thead>
                  <tbody>
                    {d.hsnWise?.map((row, i) => (
                      <tr key={i}>
                        <Td bold>{row.hsnCode}</Td>
                        <Td right>{fmtC(row.taxableAmount)}</Td>
                        <Td right>{pct(row.gstRate)}</Td>
                        <Td right muted>{fmtC(row.cgst)}</Td>
                        <Td right muted>{fmtC(row.sgst)}</Td>
                        <Td right muted>{fmtC(row.igst)}</Td>
                        <Td right>{fmtC(row.totalTax)}</Td>
                        <Td right green bold>{fmtC(row.lineTotal)}</Td>
                      </tr>
                    ))}
                    {!d.hsnWise?.length && <tr><Td colSpan={8}><div className="py-6 text-center text-[13px] text-[color:var(--text-muted)]">No HSN data</div></Td></tr>}
                  </tbody>
                </table>
            </ReportTable>
          )}
        </div>
      ) : <EmptyState />}
    </>
  );
};

function StockContent({ d, filters: stockFilters, setFilters: setStockFilters, bar, years, subTab, title }) {
  return (
    <>
      <FilterBar onGenerate={bar.onGenerate} loading={bar.loading}>
        <FilterField label="Report Type">
          <select value={stockFilters.type} onChange={e => setStockFilters(f => ({ ...f, type: e.target.value }))} className={inputCls}>
            <option value="current">Current Stock</option>
            <option value="movement">Stock Movement</option>
            <option value="valuation">Stock Valuation</option>
          </select>
        </FilterField>
      </FilterBar>

      {d ? (
        <div className="no-grid space-y-4" ref={bar.printRef}>
          <div className="hidden print:block">
            <h1>{title} — Stock Report ({d.type})</h1>
          </div>

          {/* Summary */}
          {d.summary && (
            <div className="kpis grid gap-3 grid-cols-2 md:grid-cols-4">
              {Object.entries(d.summary).map(([key, val]) => (
                <KpiTile
                  key={key}
                  label={key.replace(/([A-Z])/g, ' $1').trim()}
                  value={typeof val === 'number' && (key.toLowerCase().includes('value') || key.toLowerCase().includes('cost'))
                    ? fmtC(val) : fmt(val)}
                />
              ))}
            </div>
          )}

          <ActionBar {...bar} />

          <ReportTable>
              {subTab === 'movement' ? (
                <table className="w-full">
                  <thead><tr>
                    <Th>Date</Th><Th>Product</Th><Th>SKU</Th><Th>Type</Th><Th right>Qty</Th><Th right>Balance</Th><Th>Reason</Th><Th>Ref</Th><Th>By</Th>
                  </tr></thead>
                  <tbody>
                    {d.data?.map((row, i) => (
                      <tr key={i}>
                        <Td muted>{new Date(row.date).toLocaleDateString('en-IN')}</Td>
                        <Td bold>{row.product}</Td><Td muted>{row.sku}</Td>
                        <Td><Badge tone={row.type?.includes('In') || row.type?.includes('Receipt') ? 'success' : 'danger'}>{row.type}</Badge></Td>
                        <Td right bold>{fmt(row.quantity)}</Td><Td right>{fmt(row.balance)}</Td>
                        <Td muted>{row.reason || '—'}</Td><Td muted>{row.reference || '—'}</Td><Td muted>{row.performedBy}</Td>
                      </tr>
                    ))}
                    {!d.data?.length && <tr><td colSpan={9} className="py-6 text-center text-[13px] text-[color:var(--text-muted)]">No movement data</td></tr>}
                  </tbody>
                </table>
              ) : subTab === 'valuation' ? (
                <table className="w-full">
                  <thead><tr>
                    <Th>Product</Th><Th>SKU</Th><Th right>Stock</Th><Th>Unit</Th>
                    <Th right>Cost Price</Th><Th right>MRP</Th><Th right>Selling Price</Th>
                    <Th right>Total Cost Value</Th><Th right>Total MRP Value</Th><Th>Location</Th>
                  </tr></thead>
                  <tbody>
                    {d.data?.map((row, i) => (
                      <tr key={i}>
                        <Td bold>{row.product}</Td><Td muted>{row.sku}</Td>
                        <Td right>{fmt(row.stock)}</Td><Td muted>{row.unit}</Td>
                        <Td right muted>{fmtC(row.costPrice)}</Td>
                        <Td right muted>{fmtC(row.mrpPrice)}</Td>
                        <Td right muted>{fmtC(row.sellingPrice)}</Td>
                        <Td right green bold>{fmtC(row.totalCost)}</Td>
                        <Td right>{fmtC(row.totalMrp)}</Td>
                        <Td muted>{row.location}</Td>
                      </tr>
                    ))}
                    {!d.data?.length && <tr><td colSpan={10} className="py-6 text-center text-[13px] text-[color:var(--text-muted)]">No stock data</td></tr>}
                  </tbody>
                </table>
              ) : (
                <table className="w-full">
                  <thead><tr>
                    <Th>Product</Th><Th>SKU</Th><Th right>Stock</Th><Th>Unit</Th>
                    <Th right>Reorder Point</Th><Th>Status</Th><Th>Location</Th><Th>Batch</Th><Th>Expiry</Th><Th right>Cost Price</Th>
                  </tr></thead>
                  <tbody>
                    {d.data?.map((row, i) => (
                      <tr key={i}>
                        <Td bold>{row.product}</Td><Td muted>{row.sku}</Td>
                        <Td right bold>{fmt(row.stock)}</Td><Td muted>{row.unit}</Td>
                        <Td right muted>{fmt(row.reorderPoint)}</Td>
                        <Td><StatusBadge status={row.status} /></Td>
                        <Td muted>{row.location}</Td>
                        <Td muted>{row.batch || '—'}</Td>
                        <Td muted>{row.expiry ? new Date(row.expiry).toLocaleDateString('en-IN') : '—'}</Td>
                        <Td right muted>{fmtC(row.costPrice)}</Td>
                      </tr>
                    ))}
                    {!d.data?.length && <tr><td colSpan={10} className="py-6 text-center text-[13px] text-[color:var(--text-muted)]">No stock data</td></tr>}
                  </tbody>
                </table>
              )}
          </ReportTable>
        </div>
      ) : <EmptyState />}
    </>
  );
};

function MarginContent({ d, filters: marginFilters, setFilters: setMarginFilters, bar, years, subTab, title }) {
  return (
    <>
      <FilterBar onGenerate={bar.onGenerate} loading={bar.loading}>
        <FilterField label="From">
          <input type="date" value={marginFilters.from} onChange={e => setMarginFilters(f => ({ ...f, from: e.target.value }))} className={inputCls} />
        </FilterField>
        <FilterField label="To">
          <input type="date" value={marginFilters.to} onChange={e => setMarginFilters(f => ({ ...f, to: e.target.value }))} className={inputCls} />
        </FilterField>
      </FilterBar>

      {d ? (
        <div className="no-grid space-y-4" ref={bar.printRef}>
          <div className="hidden print:block">
            <h1>{title} — Margin Report</h1>
            <div className="sub">{marginFilters.from} to {marginFilters.to}</div>
          </div>

          <div className="kpis grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Total Products', value: fmt(d.summary?.totalProducts) },
              { label: 'Total Revenue',  value: fmtC(d.summary?.totalRevenue) },
              { label: 'Total Profit',   value: fmtC(d.summary?.totalProfit)  },
              { label: 'Avg Margin',     value: pct(d.summary?.avgMarginPct)  },
            ].map(c => (
              <KpiTile key={c.label} label={c.label} value={c.value} />
            ))}
          </div>

          <ActionBar {...bar} />

          <ReportTable>
              <table className="w-full">
                <thead><tr>
                  <Th>Product</Th><Th right>Selling Price</Th><Th right>Cost Price</Th>
                  <Th right>Margin (₹)</Th><Th right>Margin %</Th>
                  <Th right>Units Sold</Th><Th right>Revenue</Th><Th right>Profit</Th>
                </tr></thead>
                <tbody>
                  {d.products?.map((row, i) => (
                    <tr key={i}>
                      <Td bold>{row.name}</Td>
                      <Td right>{fmtC(row.sellingPrice)}</Td>
                      <Td right muted>{fmtC(row.costPrice)}</Td>
                      <Td right>{fmtC(row.marginAmt)}</Td>
                      <Td right>
                        <span className={`font-semibold ${row.marginPct >= 30 ? 'text-[color:var(--success)]' : row.marginPct >= 15 ? 'text-[color:var(--warning)]' : 'text-[color:var(--danger)]'}`}>
                          {pct(row.marginPct)}
                        </span>
                      </Td>
                      <Td right>{fmt(row.unitsSold)}</Td>
                      <Td right green>{fmtC(row.revenue)}</Td>
                      <Td right bold>{fmtC(row.profit)}</Td>
                    </tr>
                  ))}
                  {!d.products?.length && <tr><td colSpan={8} className="py-6 text-center text-[13px] text-[color:var(--text-muted)]">No product data</td></tr>}
                </tbody>
              </table>
          </ReportTable>
        </div>
      ) : <EmptyState />}
    </>
  );
};

function YoYContent({ d, filters: yoyFilters, setFilters: setYoyFilters, bar, years, subTab, title }) {
  return (
    <>
      <FilterBar onGenerate={bar.onGenerate} loading={bar.loading}>
        <FilterField label="Current Year">
          <select value={yoyFilters.baseYear} onChange={e => setYoyFilters(f => ({ ...f, baseYear: Number(e.target.value) }))} className={inputCls}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </FilterField>
        <FilterField label="Years to Compare">
          <select value={yoyFilters.compareYears} onChange={e => setYoyFilters(f => ({ ...f, compareYears: Number(e.target.value) }))} className={inputCls}>
            <option value={2}>2 Years</option>
            <option value={3}>3 Years</option>
            <option value={4}>4 Years</option>
          </select>
        </FilterField>
      </FilterBar>

      {d ? (
        <div className="no-grid space-y-4" ref={bar.printRef}>
          <div className="hidden print:block">
            <h1>{title} — Year-over-Year Report</h1>
          </div>

          <ActionBar {...bar} />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Yearly summary table */}
            <ReportTable title={<>Yearly Summary</>}>
                <table className="w-full">
                  <thead><tr>
                    <Th>Year</Th><Th right>Revenue</Th><Th right>Transactions</Th>
                    <Th right>Expenses</Th><Th right>Net Profit</Th><Th right>Margin</Th>
                  </tr></thead>
                  <tbody>
                    {d.years?.map((row, i) => (
                      <tr key={i} className={`${i === d.years.length - 1 ? 'bg-[color:var(--primary-soft)] font-bold' : ''}`}>
                        <Td bold>{row.year}</Td>
                        <Td right green>{row.revenue > 0 ? fmtC(row.revenue) : '—'}</Td>
                        <Td right>{row.transactions > 0 ? fmt(row.transactions) : '—'}</Td>
                        <Td right red>{row.expenses > 0 ? fmtC(row.expenses) : '—'}</Td>
                        <Td right><span className={(row.netProfit ?? 0) >= 0 ? 'text-[color:var(--success)] font-semibold' : 'text-[color:var(--danger)] font-semibold'}>{fmtC(row.netProfit)}</span></Td>
                        <Td right muted>{pct(row.netMarginPct)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </ReportTable>

            {/* Growth metrics */}
            <ReportTable title={<>Growth vs Previous Year</>}>
                <table className="w-full">
                  <thead><tr>
                    <Th>Metric</Th><Th right>Prev Year</Th><Th right>Current Year</Th><Th right>Growth %</Th>
                  </tr></thead>
                  <tbody>
                    {d.growth?.map((row, i) => (
                      <tr key={i}>
                        <Td bold>{row.metric}</Td>
                        <Td right muted>{isCountMetric(row.metric) ? fmt(row.baseYear) : fmtC(row.baseYear)}</Td>
                        <Td right>{isCountMetric(row.metric) ? fmt(row.currentYear) : fmtC(row.currentYear)}</Td>
                        <Td right>
                          <span className={`flex items-center justify-end gap-1 font-semibold ${(row.growthPct ?? 0) >= 0 ? 'text-[color:var(--success)]' : 'text-[color:var(--danger)]'}`}>
                            {(row.growthPct ?? 0) >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                            {pct(row.growthPct)}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </ReportTable>
          </div>
        </div>
      ) : <EmptyState />}
    </>
  );
};


// ── main component ───────────────────────────────────────────────────────────
export default function AdminReports() {
  const dispatch   = useAppDispatch();
  const reports    = useAppSelector((s) => s.admin.reports);
  const settings   = useAppSelector((s) => s.admin.settings);
  const lk         = useLookups();
  const printRef   = useRef(null);

  const [tab,         setTab]         = useState('sales');
  const [downloading, setDownloading] = useState(false);
  const [generating,  setGenerating]  = useState(false);

  // filters per tab
  const [salesFilters,  setSalesFilters]  = useState({ from: monthStart, to: today, groupBy: 'day' });
  const [plFilters,     setPlFilters]     = useState({ year: yearNow, month: '' });
  const [gstFilters,    setGstFilters]    = useState({ from: monthStart, to: today });
  const [stockFilters,  setStockFilters]  = useState({ type: 'current' });
  const [marginFilters, setMarginFilters] = useState({ from: monthStart, to: today });
  const [yoyFilters,    setYoyFilters]    = useState({ baseYear: yearNow, compareYears: 2 });

  // stock: which report type the shown data belongs to
  const [stockSubTab, setStockSubTab] = useState('current');

  // company name for print headers comes from Settings
  useEffect(() => { if (!settings) dispatch(fetchSettings()); }, [dispatch, settings]);
  const companyName = settings?.siteName || '';

  // year pickers: backend-computed years, never in the future
  const years = (lk.years || []).filter((y) => y <= lk.currentYear);

  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));

  // ── generate handlers ─────────────────────────────────────────────────────
  const thunks = {
    sales:  () => fetchSalesReport(clean(salesFilters)),
    pl:     () => fetchPLReport(clean(plFilters)),
    gst:    () => fetchGstReport(clean(gstFilters)),
    stock:  () => fetchStockReport(clean(stockFilters)),
    margin: () => fetchMarginReport(clean(marginFilters)),
    yoy:    () => fetchYoYReport(clean(yoyFilters)),
  };
  const generate = async () => {
    setGenerating(true);
    const res = await dispatch(thunks[tab]());
    setGenerating(false);
    if (res.meta.requestStatus === 'fulfilled') {
      if (tab === 'stock') setStockSubTab(stockFilters.type);
    } else {
      toast.error(res.payload || 'Failed to generate report');
    }
  };

  // ── Excel download ────────────────────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    const configs = {
      sales:  { params: salesFilters,  filename: `SalesReport_${salesFilters.from}_${salesFilters.to}.xlsx` },
      pl:     { params: plFilters,     filename: `PLReport_${plFilters.year}${plFilters.month ? `_${plFilters.month}` : ''}.xlsx` },
      gst:    { params: gstFilters,    filename: `GSTReport_${gstFilters.from}_${gstFilters.to}.xlsx` },
      stock:  { params: stockFilters,  filename: `StockReport_${stockFilters.type}_${today}.xlsx` },
      margin: { params: marginFilters, filename: `MarginReport_${marginFilters.from}_${marginFilters.to}.xlsx` },
      yoy:    { params: yoyFilters,    filename: `YoYReport_${yoyFilters.baseYear}.xlsx` },
    };
    const cfg = configs[tab];
    const res = await dispatch(downloadReport({ type: tab, params: clean(cfg.params), filename: cfg.filename }));
    setDownloading(false);
    if (res.meta.requestStatus === 'fulfilled') toast.success('Excel downloaded!', { icon: '📥' });
    else toast.error(res.payload || 'Download failed');
  };

  // ── print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) { toast.error('Generate the report first'); return; }
    const win = window.open('', '_blank');
    if (!win) { toast.error('Allow pop-ups for this site to print'); return; }
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>${esc(companyName ? `${companyName} — ` : '')}${esc(TABS.find(t => t.key === tab)?.label)} Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; color: #1a5c2e; }
        .sub { font-size: 11px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #1a5c2e; color: white; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
        th.right, td.right { text-align: right; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
        tr:nth-child(even) td { background: #f9f9f9; }
        .kpis { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
        .kpi-card { border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; min-width: 140px; }
        .kpi-label { font-size: 10px; color: #666; margin-bottom: 4px; }
        .kpi-value { font-size: 16px; font-weight: bold; color: #1a5c2e; }
        .section-title { font-size: 13px; font-weight: bold; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        .green { color: #15803d; } .red { color: #dc2626; }
        button { display: none; }
        @media print { body { padding: 0; } }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    // close only after the print dialog finishes (closing right after print() kills the dialog in Chrome/Safari)
    win.onafterprint = () => win.close();
    const doPrint = () => { win.focus(); win.print(); };
    if (win.document.readyState === 'complete') setTimeout(doPrint, 50);
    else win.onload = doPrint;
  };

  const bar = { onGenerate: generate, loading: generating, onDownload: handleDownload, onPrint: handlePrint, downloading, printRef };
  const common = { bar, years, title: companyName || 'Report' };

  const TAB_CONTENT = {
    sales:  <SalesContent  {...common} d={reports.sales}  filters={salesFilters}  setFilters={setSalesFilters} />,
    pl:     <PLContent     {...common} d={reports.pl}     filters={plFilters}     setFilters={setPlFilters} />,
    gst:    <GSTContent    {...common} d={reports.gst}    filters={gstFilters}    setFilters={setGstFilters} />,
    stock:  <StockContent  {...common} d={reports.stock}  filters={stockFilters}  setFilters={setStockFilters} subTab={stockSubTab} />,
    margin: <MarginContent {...common} d={reports.margin} filters={marginFilters} setFilters={setMarginFilters} />,
    yoy:    <YoYContent    {...common} d={reports.yoy}    filters={yoyFilters}    setFilters={setYoyFilters} />,
  };

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader title="Reports & Analytics" description="Generate, preview, download Excel or print any report" />

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs items={TABS.map(t => ({ value: t.key, label: t.label, icon: t.icon }))} value={tab} onChange={setTab} />

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {TAB_CONTENT[tab]}
      </div>
    </div>
  );
}
