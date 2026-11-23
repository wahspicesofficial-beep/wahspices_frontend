import { useState, useEffect } from 'react';
import { Download, Send, CheckCircle, Play, FileText, Wallet, Banknote, Landmark, Briefcase, HeartPulse, CalendarDays, Eye } from 'lucide-react';
import { SkPageHeader, SkTabs } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchPayroll,
  runPayroll,
  disbursePayrollEntry,
  approveAllPayroll,
  disburseAllPayroll,
  fetchSalaryStructures,
  fetchPayrollHistory,
  downloadNeftFile,
  fetchSalarySlipHtml,
  sendSalarySlip,
} from '@/store/slices/adminSlice';
import {
  PageHeader, Stat, Card, Badge, statusTone, Tabs, Button, IconButton, EmptyState, usePagination, Pagination,
} from '@/admin/ui';
import { useLookups, lookupOptions, MONTH_NAMES } from '@/admin/lookups';

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const fmtDue = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const cnRow = (active) => `cursor-pointer${active ? ' !bg-[color:var(--primary-soft)]' : ''}`;

export default function AdminPayroll() {
  const dispatch         = useAppDispatch();
  const entries          = useAppSelector(s => s.admin.payroll.entries);
  const salaryStructures = useAppSelector(s => s.admin.payroll.salaryStructures);
  const history          = useAppSelector(s => s.admin.payroll.history);
  const summaryTotals    = useAppSelector(s => s.admin.payroll.summaryTotals);
  const statutory        = useAppSelector(s => s.admin.payroll.statutory);
  const loading          = useAppSelector(s => s.admin.loading);
  const lk = useLookups();

  const now = new Date();
  const [tab,   setTab]   = useState('sheet');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [busy,  setBusy]  = useState('');   // action key in flight

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  useEffect(() => {
    dispatch(fetchPayroll({ month, year }));
  }, [dispatch, month, year]);

  useEffect(() => {
    dispatch(fetchSalaryStructures());
    dispatch(fetchPayrollHistory());
  }, [dispatch]);

  // Totals and statutory figures are computed by the backend (GET /admin/payroll)
  const totalGross = summaryTotals?.totalGross ?? 0;
  const totalNet   = summaryTotals?.totalNet   ?? 0;
  const totalEpf   = summaryTotals?.totalEpf   ?? 0;
  const totalEsic  = summaryTotals?.totalEsic  ?? 0;
  const totalPt    = summaryTotals?.totalPt    ?? 0;
  const totalDed   = summaryTotals?.totalDeductions ?? 0;
  const disbursed  = summaryTotals?.disbursed ?? entries.filter(e => e.status === 'Paid').length;
  const rates      = statutory?.rates;
  const allPaid    = entries.length > 0 && entries.every(e => e.status === 'Paid');
  const allApproved= entries.length > 0 && entries.every(e => e.status === 'Approved' || e.status === 'Paid');

  const sheetPg  = usePagination(entries, 20);
  const structPg = usePagination(salaryStructures, 20);
  const histPg   = usePagination(history, 20);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const refresh = () => { dispatch(fetchPayroll({ month, year })); dispatch(fetchPayrollHistory()); };

  const runAction = async (key, thunk, arg, okMsg) => {
    setBusy(key);
    const res = await dispatch(thunk(arg));
    setBusy('');
    if (thunk.fulfilled.match(res)) {
      if (okMsg) toast.success(typeof okMsg === 'function' ? okMsg(res.payload) : okMsg);
      return res;
    }
    toast.error(res.payload || 'Action failed');
    return null;
  };

  const handleRunPayroll = async () => {
    if (entries.length > 0 && !window.confirm(`Recalculate payroll for ${monthLabel}? Current figures will be replaced.`)) return;
    if (await runAction('run', runPayroll, { month, year }, `Payroll calculated for ${monthLabel}`)) refresh();
  };

  const handleApproveAll = async () => {
    if (await runAction('approve', approveAllPayroll, { month, year }, (p) => `${p?.approved ?? ''} salaries approved`)) refresh();
  };

  const handleDisburseAll = async () => {
    if (!window.confirm(`Mark all approved salaries for ${monthLabel} as paid?`)) return;
    if (await runAction('disburseAll', disburseAllPayroll, { month, year }, (p) => `${p?.disbursed ?? ''} salaries marked paid`)) refresh();
  };

  const handleDisburseOne = async (e) => {
    if (await runAction(`pay-${e.id}`, disbursePayrollEntry, e.id, `Salary marked paid for ${e.name}`)) refresh();
  };

  const handleNeft = () => runAction('neft', downloadNeftFile, { month, year, format: 'xlsx' }, 'NEFT file downloaded');

  const handleSendSlip = (e) => runAction(`slip-${e.id}`, sendSalarySlip, e.id, (p) => p?.message || `Salary slip sent to ${e.name}`);

  const handleViewSlip = async (e) => {
    const win = window.open('', '_blank');   // open synchronously so the popup isn't blocked
    const res = await dispatch(fetchSalarySlipHtml(e.id));
    if (fetchSalarySlipHtml.fulfilled.match(res)) {
      if (win) { win.document.open(); win.document.write(res.payload); win.document.close(); }
    } else {
      if (win) win.close();
      toast.error(res.payload || 'Failed to load salary slip');
    }
  };

  if (loading && entries.length === 0) return <div className="space-y-6"><SkPageHeader /><SkTabs tabCount={4} contentRows={7} /></div>;

  const dueLabel = fmtDue(statutory?.dueDate);
  const epf  = statutory?.epf;
  const esic = statutory?.esic;
  const pt   = statutory?.pt;
  const kv = (rows) => (
    <dl className="divide-y divide-[color:var(--border)] text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between py-2">
          <dt className="text-[color:var(--text-muted)]">{k}</dt>
          <dd className="font-bold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="space-y-4">

      <PageHeader
        title="Payroll & Salary"
        description="Auto salary calculation, EPF, ESIC, TDS, salary slips, bank NEFT"
        actions={<>
          <Button variant="secondary" onClick={handleNeft} loading={busy === 'neft'} disabled={!allApproved || !!busy}
            title={allApproved ? 'Download the bank NEFT bulk-payment file' : 'Approve payroll to generate the NEFT file'}>
            <Download className="size-4" /> NEFT File
          </Button>
          {!allApproved && (
            <Button variant="secondary" onClick={handleRunPayroll} loading={busy === 'run'} disabled={!!busy}>
              <Play className="size-4" /> {entries.length > 0 ? 'Recalculate' : 'Run Payroll'}
            </Button>
          )}
          {entries.length > 0 && !allApproved && (
            <Button variant="secondary" onClick={handleApproveAll} loading={busy === 'approve'} disabled={!!busy}>
              <CheckCircle className="size-4" /> Approve All
            </Button>
          )}
          {allApproved && !allPaid && (
            <Button onClick={handleDisburseAll} loading={busy === 'disburseAll'} disabled={!!busy}>
              <CheckCircle className="size-4" /> Disburse All
            </Button>
          )}
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Gross" value={inr(totalGross)} icon={Wallet} tone="success" />
        <Stat label="Total Net Pay" value={inr(totalNet)} icon={Banknote} tone="primary" />
        <Stat label="Deductions" value={inr(totalDed)} icon={Landmark} tone="danger" hint="EPF + ESIC + PT + TDS" />
        <Stat label="Disbursed" value={`${disbursed} / ${entries.length}`} icon={CheckCircle} tone="accent" />
      </div>

      <Card bodyClassName="p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-bold text-[color:var(--text-primary)]">Payroll — {monthLabel}</div>
            <div className="text-[12px] text-[color:var(--text-muted)]">{rates?.summary || '\u00a0'}</div>
          </div>
          <div className="flex items-center gap-2">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input-field !h-9 !w-36" aria-label="Month">
              {MONTH_NAMES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field !h-9 !w-24" aria-label="Year">
              {lookupOptions(lk.years.map(y => ({ value: y, label: String(y) })), year).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {allPaid && <Badge tone="success"><CheckCircle className="size-3" /> All Paid</Badge>}
          </div>
        </div>
      </Card>

      <Tabs
        items={[
          { value: 'sheet',      label: 'Salary Sheet', count: entries.length },
          { value: 'structure',  label: 'Salary Structure' },
          { value: 'deductions', label: 'EPF / ESIC / PT' },
          { value: 'history',    label: 'Payroll History' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* TAB 1 — Salary Sheet */}
      {tab === 'sheet' && (
        <Card bodyClassName="p-3">
          {loading && <div className="pb-2 text-[12px] text-[color:var(--text-muted)]">Loading…</div>}
          {!loading && entries.length === 0 && (
            <EmptyState icon={Briefcase} title={`No payroll for ${monthLabel}`}>
              Click "Run Payroll" to calculate salaries for this month.
            </EmptyState>
          )}
          {entries.length > 0 && (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Emp ID</th>
                      <th className="text-left">Name</th>
                      <th className="text-left">Dept</th>
                      <th className="text-right" title="Paid days / loss-of-pay days">Days (LOP)</th>
                      <th className="text-right">Gross</th>
                      <th className="text-right">EPF</th>
                      <th className="text-right">ESIC</th>
                      <th className="text-right">PT</th>
                      <th className="text-right">Net Pay</th>
                      <th className="text-left">Status</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetPg.items.map(e => (
                      <tr key={e.id}>
                        <td className="font-bold text-[color:var(--primary)]">{e.empId}</td>
                        <td className="whitespace-nowrap font-bold">{e.name}</td>
                        <td className="text-[color:var(--text-muted)]">{e.department ?? '—'}</td>
                        <td className="whitespace-nowrap text-right">
                          {e.daysWorked ?? '—'}
                          {e.lossOfPayDays > 0 && <span className="ml-1 text-[color:var(--danger)]">({e.lossOfPayDays})</span>}
                        </td>
                        <td className="whitespace-nowrap text-right font-bold">{inr(e.grossSalary)}</td>
                        <td className="whitespace-nowrap text-right text-[color:var(--danger)]">-{inr(e.epf)}</td>
                        <td className="whitespace-nowrap text-right text-[color:var(--danger)]">-{inr(e.esic)}</td>
                        <td className="whitespace-nowrap text-right text-[color:var(--danger)]">-{inr(e.professionalTax)}</td>
                        <td className="whitespace-nowrap text-right font-bold text-[color:var(--primary)]">{inr(e.netSalary)}</td>
                        <td>
                          <Badge tone={statusTone(e.status ?? 'Calculated')}>{e.status ?? 'Calculated'}</Badge>
                          {!e.hasBank && <div className="mt-0.5 text-[11px] text-[color:var(--warning)]">No bank details</div>}
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            {e.status === 'Approved' && (
                              <Button size="sm" variant="secondary" className="!h-7 !px-2 !text-[12px]" loading={busy === `pay-${e.id}`} disabled={!!busy} onClick={() => handleDisburseOne(e)}>
                                Pay
                              </Button>
                            )}
                            <IconButton label="View / print slip" onClick={() => handleViewSlip(e)}>
                              <Eye className="size-3.5" />
                            </IconButton>
                            <IconButton label={e.hasEmail ? 'Email salary slip' : 'No email on file'} tone="primary" disabled={!e.hasEmail || busy === `slip-${e.id}`} onClick={() => handleSendSlip(e)}>
                              <Send className="size-3.5" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td colSpan={4}>TOTAL ({entries.length} employees)</td>
                      <td className="whitespace-nowrap text-right">{inr(totalGross)}</td>
                      <td className="whitespace-nowrap text-right text-[color:var(--danger)]">-{inr(totalEpf)}</td>
                      <td className="whitespace-nowrap text-right text-[color:var(--danger)]">-{inr(totalEsic)}</td>
                      <td className="whitespace-nowrap text-right text-[color:var(--danger)]">-{inr(totalPt)}</td>
                      <td className="whitespace-nowrap text-right text-[color:var(--primary)]">{inr(totalNet)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Pagination {...sheetPg} noun="employees" />
            </>
          )}
        </Card>
      )}

      {/* TAB 2 — Salary Structure */}
      {tab === 'structure' && (
        <Card bodyClassName="p-3">
          {loading && salaryStructures.length === 0 && (
            <div className="text-[13px] text-[color:var(--text-muted)]">Loading…</div>
          )}
          {!loading && salaryStructures.length === 0 && (
            <EmptyState icon={FileText} title="No employees found" />
          )}
          {salaryStructures.length > 0 && (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Emp ID</th>
                      <th className="text-left">Name</th>
                      <th className="text-left">Dept</th>
                      <th className="text-right">Basic</th>
                      <th className="text-right">HRA</th>
                      <th className="text-right">TA</th>
                      <th className="text-right">Gross CTC</th>
                      <th className="text-right">EPF</th>
                      <th className="text-right">ESIC</th>
                      <th className="text-right">PT</th>
                      <th className="text-right">Net CTC</th>
                      <th className="text-left">Structure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structPg.items.map(s => (
                      <tr key={s.employeeId}>
                        <td className="font-bold text-[color:var(--primary)]">{s.empCode}</td>
                        <td className="whitespace-nowrap font-bold">{s.employeeName}</td>
                        <td className="text-[color:var(--text-muted)]">{s.department}</td>
                        <td className="whitespace-nowrap text-right">₹{Math.round(s.basicSalary ?? 0).toLocaleString()}</td>
                        <td className="whitespace-nowrap text-right">₹{Math.round(s.hra ?? 0).toLocaleString()}</td>
                        <td className="whitespace-nowrap text-right">₹{Math.round(s.ta ?? 0).toLocaleString()}</td>
                        <td className="whitespace-nowrap text-right font-bold">₹{Math.round(s.grossSalary ?? 0).toLocaleString()}</td>
                        <td className="whitespace-nowrap text-right text-[color:var(--danger)]" title={`${s.epfPercent}% of Basic + DA`}>{inr(s.epf)}</td>
                        <td className="whitespace-nowrap text-right text-[color:var(--danger)]">
                          {s.esicApplicable ? <span title={`${s.esicPercent}%`}>{inr(s.esic)}</span> : <span className="text-[color:var(--text-muted)]">Exempt</span>}
                        </td>
                        <td className="whitespace-nowrap text-right text-[color:var(--danger)]">{inr(s.professionalTax)}</td>
                        <td className="whitespace-nowrap text-right font-bold text-[color:var(--primary)]">₹{Math.round(s.netSalary ?? 0).toLocaleString()}</td>
                        <td>
                          {s.hasStructure
                            ? <Badge tone="success">Configured</Badge>
                            : <Badge tone="warning">Default</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...structPg} noun="employees" />
            </>
          )}
        </Card>
      )}

      {/* TAB 3 — EPF / ESIC / PT Deduction Summary */}
      {tab === 'deductions' && (
        <div className="space-y-3">
          {entries.length === 0 && (
            <Card>
              <EmptyState icon={Landmark} title="No deduction summary">
                Run payroll for {monthLabel} to see deduction summary.
              </EmptyState>
            </Card>
          )}
          {entries.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card title={<span className="flex items-center gap-1.5"><Landmark className="size-4 text-[color:var(--info)]" /> EPF Statement</span>} bodyClassName="px-4 py-2">
                  <p className="pb-1 text-[12px] text-[color:var(--text-muted)]">Employees' Provident Fund</p>
                  {kv([
                    [`Employee EPF (${rates?.epfEmployeeRate ?? '—'}%)`, inr(epf?.employee)],
                    [`Employer EPS (${rates?.epsRate ?? '—'}%)`,         inr(epf?.employerEps)],
                    ['Employer EPF A/c',                                 inr(epf?.employerEpf)],
                    [`EDLI + admin (${(rates?.edliRate ?? 0) + (rates?.epfAdminRate ?? 0)}%)`, inr((epf?.edli ?? 0) + (epf?.adminCharges ?? 0))],
                    ['Total EPF Challan',                                inr(epf?.challanTotal)],
                    ['Employees Covered',                                epf?.covered ?? 0],
                    ['Challan Due',                                      dueLabel],
                  ])}
                </Card>

                <Card title={<span className="flex items-center gap-1.5"><HeartPulse className="size-4 text-[color:var(--success)]" /> ESIC Statement</span>} bodyClassName="px-4 py-2">
                  <p className="pb-1 text-[12px] text-[color:var(--text-muted)]">Employees' State Insurance</p>
                  {kv([
                    [`Employee ESIC (${rates?.esicEmployeeRate ?? '—'}%)`, inr(esic?.employee)],
                    [`Employer ESIC (${rates?.esicEmployerRate ?? '—'}%)`, inr(esic?.employer)],
                    ['Total ESIC Challan',                                 inr(esic?.challanTotal)],
                    ['Employees Covered',                                  esic?.covered ?? 0],
                    ['Challan Due',                                        dueLabel],
                  ])}
                </Card>

                <Card title={<span className="flex items-center gap-1.5"><FileText className="size-4 text-[color:var(--accent-strong)]" /> PT / TDS Statement</span>} bodyClassName="px-4 py-2">
                  <p className="pb-1 text-[12px] text-[color:var(--text-muted)]">Professional Tax &amp; TDS</p>
                  {kv([
                    [`Prof. Tax (${rates?.ptState ?? ''} ₹${rates?.ptAmount ?? '—'} slab)`, inr(pt?.total)],
                    ['TDS (Sec 192)',           inr(statutory?.tds)],
                    ['Total Deductions',        inr(totalDed)],
                    ['Net Payable',             inr(totalNet)],
                    ['Employer Cost (CTC)',     inr(statutory?.employerCost)],
                    ['PT Filing Due',           dueLabel],
                  ])}
                </Card>
              </div>

              {(esic?.exempt ?? 0) > 0 && (
                <div className="rounded-[8px] border border-[rgba(180,120,20,0.3)] bg-[color:var(--warning-bg)] px-4 py-2.5 text-[13px] text-[color:var(--warning)]">
                  <span className="font-bold">Note:</span> {esic.exempt} employee(s) are exempt from ESIC (gross salary &gt; ₹{Number(rates?.esicWageCeiling ?? 0).toLocaleString('en-IN')}).
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 4 — Payroll History */}
      {tab === 'history' && (
        <Card bodyClassName="p-3">
          {loading && history.length === 0 && (
            <div className="text-[13px] text-[color:var(--text-muted)]">Loading…</div>
          )}
          {!loading && history.length === 0 && (
            <EmptyState icon={CalendarDays} title="No payroll history yet">Run payroll to get started.</EmptyState>
          )}
          {history.length > 0 && (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Month</th>
                      <th className="text-right">Employees</th>
                      <th className="text-right">Total Gross</th>
                      <th className="text-right">EPF</th>
                      <th className="text-right">ESIC</th>
                      <th className="text-right">PT</th>
                      <th className="text-right">Total Net</th>
                      <th className="text-right">Disbursed</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histPg.items.map(h => (
                      <tr key={`${h.year}-${h.month}`}
                        className={cnRow(h.year === year && h.month === month)} onClick={() => { setMonth(h.month); setYear(h.year); setTab('sheet'); }}>
                        <td className="font-bold">{h.monthLabel}</td>
                        <td className="text-right">{h.employees}</td>
                        <td className="whitespace-nowrap text-right font-bold">{inr(h.totalGross)}</td>
                        <td className="whitespace-nowrap text-right text-[color:var(--danger)]">{inr(h.totalEpf)}</td>
                        <td className="whitespace-nowrap text-right text-[color:var(--danger)]">{inr(h.totalEsic)}</td>
                        <td className="whitespace-nowrap text-right text-[color:var(--danger)]">{inr(h.totalPt)}</td>
                        <td className="whitespace-nowrap text-right font-bold text-[color:var(--primary)]">{inr(h.totalNet)}</td>
                        <td className="text-right">{h.disbursed}/{h.employees}</td>
                        <td><Badge tone={statusTone(h.status)}>{h.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...histPg} noun="months" />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
