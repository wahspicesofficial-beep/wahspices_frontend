import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Boxes, Download, FileBadge, PieChart, Receipt } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, Skeleton, Stat, Toolbar } from '@/admin/ui';
import { useLookups, MONTH_SHORT } from '@/admin/lookups';
import { DateRange } from '@/admin/components/company/shared';
import { apiGet, assetStatus, downloadFile, errMsg, fmtAmt, fyStart, today } from '@/admin/components/company/companyUtils';

function Bar({ value, max }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
      <div className="h-full rounded-full bg-[color:var(--primary)]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function CompanyReports() {
  const lk = useLookups();
  const [range, setRange] = useState({ from: fyStart(), to: today() });
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setData(null);
    try { setData(await apiGet('/admin/company/reports', { from: range.from || undefined, to: range.to || undefined })); }
    catch (err) { toast.error(errMsg(err, 'Could not load the report')); }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const exportXlsx = async () => {
    setExporting(true);
    await downloadFile('/admin/company/reports/export', 'Company_finance.xlsx', { from: range.from || undefined, to: range.to || undefined });
    setExporting(false);
  };

  const t = data?.totals || {};
  const maxCat = Math.max(0, ...(data?.byCategory || []).map((c) => c.total));
  const maxMonth = Math.max(0, ...(data?.byMonth || []).map((m) => m.total));

  return (
    <div className="space-y-4">
      <PageHeader title="Company reports" description="Totals by partner, category and month; asset register value; licence fees"
        actions={<Button variant="secondary" onClick={exportXlsx} loading={exporting}><Download className="size-4" /> Export Excel</Button>} />

      <Toolbar>
        <DateRange from={range.from} to={range.to} onChange={setRange} />
        <Button size="sm" variant="tertiary" onClick={() => setRange({ from: fyStart(), to: today() })}>This financial year</Button>
      </Toolbar>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Expenses in range" value={fmtAmt(t.amount)} icon={Receipt} tone="danger" loading={!data} hint={`${t.count ?? 0} entries`} />
        <Stat label="Paid by partners / company" value={`${fmtAmt(t.partnerPaid)} / ${fmtAmt(t.companyPaid)}`} icon={PieChart} loading={!data} />
        <Stat label="Assets in use" value={fmtAmt(data?.assets?.value)} icon={Boxes} tone="info" loading={!data} hint={`${data?.assets?.count ?? 0} item(s)`} />
        <Stat label="Licence fees in range" value={fmtAmt(data?.licenceFees?.total)} icon={FileBadge} tone="primary" loading={!data} hint={`All time ${fmtAmt(data?.licenceFees?.allTime)}`} />
      </div>

      {!data ? <Skeleton className="h-64 w-full" /> : (
        <>
          <Card title="By partner" bodyClassName="p-3">
            <div className="grid-box">
              <table>
                <thead><tr><th className="text-left">Partner</th><th className="text-right">Share %</th><th className="text-right">Paid for company</th><th className="text-right">Share of expenses</th><th className="text-right">Capital in</th><th className="text-right">Withdrawn</th><th className="text-right">Expense balance</th></tr></thead>
                <tbody>
                  {data.byPartner.map((p) => (
                    <tr key={p.partnerId ?? 'company'}>
                      <td className="font-bold">{p.name}</td>
                      <td className="text-right tabular-nums">{p.partnerId == null ? '—' : `${Number(p.sharePercent)}%`}</td>
                      <td className="text-right tabular-nums">{fmtAmt(p.paidOnBehalf)}</td>
                      <td className="text-right tabular-nums">{fmtAmt(p.shareOfExpenses)}</td>
                      <td className="text-right tabular-nums">{fmtAmt(p.contributions)}</td>
                      <td className="text-right tabular-nums">{fmtAmt(p.withdrawals)}</td>
                      <td className={`text-right font-bold tabular-nums ${p.expenseBalance < 0 ? 'text-[color:var(--danger)]' : ''}`}>{fmtAmt(p.expenseBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Card title="By category" bodyClassName="p-3">
              {data.byCategory.length === 0 ? <EmptyState title="No expenses in this range" /> : (
                <ul className="space-y-2.5">
                  {data.byCategory.map((c) => (
                    <li key={c.category}>
                      <div className="mb-1 flex justify-between text-[13px]"><span className="font-bold">{c.category} <span className="font-normal text-[color:var(--text-muted)]">· {c.count}</span></span><span className="font-bold tabular-nums">{fmtAmt(c.total)}</span></div>
                      <Bar value={c.total} max={maxCat} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="By month" bodyClassName="p-3">
              {data.byMonth.length === 0 ? <EmptyState title="No expenses in this range" /> : (
                <ul className="space-y-2.5">
                  {data.byMonth.map((m) => (
                    <li key={`${m.year}-${m.month}`}>
                      <div className="mb-1 flex justify-between text-[13px]">
                        <span className="font-bold">{MONTH_SHORT[m.month - 1]} {m.year}</span>
                        <span className="tabular-nums"><b>{fmtAmt(m.total)}</b> <span className="text-[12px] text-[color:var(--text-muted)]">(partners {fmtAmt(m.partnerPaid)} · company {fmtAmt(m.companyPaid)})</span></span>
                      </div>
                      <Bar value={m.total} max={maxMonth} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <Card title="Partner share by category" bodyClassName="p-3">
              {data.partnerCategory.length === 0 ? <EmptyState title="No split expenses" /> : (
                <div className="grid-box">
                  <table>
                    <thead><tr><th className="text-left">Partner</th><th className="text-left">Category</th><th className="text-right">Share</th></tr></thead>
                    <tbody>{data.partnerCategory.map((r, i) => <tr key={i}><td>{r.partnerName}</td><td>{r.category}</td><td className="text-right tabular-nums">{fmtAmt(r.total)}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title="Asset register" bodyClassName="p-3">
              <div className="grid-box">
                <table>
                  <thead><tr><th className="text-left">Category (in use)</th><th className="text-right">Items</th><th className="text-right">Value</th></tr></thead>
                  <tbody>
                    {data.assets.byCategory.map((c) => <tr key={c.category}><td>{lk.label('CompanyAssetCategory', c.category)}</td><td className="text-right">{c.count}</td><td className="text-right tabular-nums">{fmtAmt(c.value)}</td></tr>)}
                    <tr><td className="font-bold">Total in use</td><td className="text-right font-bold">{data.assets.count}</td><td className="text-right font-bold tabular-nums">{fmtAmt(data.assets.value)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 text-[12px] text-[color:var(--text-muted)]">
                {data.assets.byStatus.map((s) => <span key={s.status}>{assetStatus(s.status).label}: {s.count}</span>)}
                <span>Disposal value received: {fmtAmt(data.assets.disposedValue)}</span>
              </div>
            </Card>
            <Card title="Licence fees (in range)" bodyClassName="p-3">
              {data.licenceFees.byType.length === 0 ? <EmptyState title="No licence fees in this range" /> : (
                <div className="grid-box">
                  <table>
                    <thead><tr><th className="text-left">Type</th><th className="text-right">Periods</th><th className="text-right">Fees</th></tr></thead>
                    <tbody>
                      {data.licenceFees.byType.map((x) => <tr key={x.type}><td>{lk.label('LicenceType', x.type)}</td><td className="text-right">{x.count}</td><td className="text-right tabular-nums">{fmtAmt(x.total)}</td></tr>)}
                      <tr><td className="font-bold">Total</td><td /><td className="text-right font-bold tabular-nums">{fmtAmt(data.licenceFees.total)}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
