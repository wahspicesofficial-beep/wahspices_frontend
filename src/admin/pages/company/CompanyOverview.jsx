import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowRight, BellRing, Boxes, FileBadge, HandCoins, Receipt, Send } from 'lucide-react';
import api from '@/services/api';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, Stat } from '@/admin/ui';
import { apiGet, daysText, daysTone, errMsg, fmtAmt, fmtDate } from '@/admin/components/company/companyUtils';
import PartnerTxnDialog from '@/admin/pages/company/PartnerTxnDialog';

export default function CompanyOverview() {
  const [data, setData] = useState(null);
  const [sending, setSending] = useState(false);
  const [settle, setSettle] = useState(null);

  const load = useCallback(async () => {
    try { setData(await apiGet('/admin/company/overview')); }
    catch (err) { toast.error(errMsg(err, 'Could not load the overview')); setData({ alerts: [], partners: [], settlement: [], totals: {} }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const runAlerts = async () => {
    setSending(true);
    try { const res = await api.post('/admin/company/alerts/run'); toast.success(res.data.message || 'Done'); }
    catch (err) { toast.error(errMsg(err, 'Could not send the alert email')); }
    finally { setSending(false); }
  };

  const t = data?.totals || {};
  const licenceAlerts = (data?.alerts || []).filter((a) => a.kind === 'Licence');
  const warrantyAlerts = (data?.alerts || []).filter((a) => a.kind !== 'Licence');

  return (
    <div className="space-y-4">
      <PageHeader title="Company finance & compliance" description="Who spent what, where — partner splits, assets, licences and renewal alerts" />

      {data?.shareWarning && (
        <div className="flex items-center gap-2.5 rounded-[8px] border border-[rgba(180,83,15,0.25)] bg-[color:var(--warning-bg)] px-3 py-2 text-[13px] text-[color:var(--warning)]">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1 text-[color:var(--text-primary)]">{data.shareWarning}</span>
          <Link to="/admin/company/partners" className="text-[12px] font-bold hover:underline">Fix shares →</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Expenses this financial year" value={fmtAmt(t.fyExpenses)} icon={Receipt} tone="danger" loading={!data} hint={t.fyStart ? `Since ${fmtDate(t.fyStart)}` : null} />
        <Stat label="Assets in use" value={fmtAmt(t.assetValue)} icon={Boxes} tone="info" loading={!data} hint={`${t.assetCount ?? 0} item(s)`} />
        <Stat label="Licences tracked" value={t.licenceCount ?? 0} icon={FileBadge} tone="primary" loading={!data} />
        <Stat label="Renewal alerts" value={data?.alerts?.length ?? 0} icon={BellRing} tone={data?.alerts?.length ? 'warning' : 'success'} loading={!data} />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card title="Renewals needing attention" bodyClassName="p-3"
          actions={<Button size="sm" variant="secondary" onClick={runAlerts} loading={sending} title="Email the store inbox about alerts not sent before"><Send className="size-3.5" /> Email alerts now</Button>}>
          {!data ? <Skeleton className="h-24 w-full" /> : data.alerts.length === 0 ? (
            <EmptyState icon={BellRing} title="Nothing expiring soon">Licences within their reminder window and warranties ending in 30 days show here.</EmptyState>
          ) : (
            <div className="space-y-3">
              {[['Licences & registrations', licenceAlerts, '/admin/company/licences'], ['Asset warranties', warrantyAlerts, '/admin/company/assets']].map(([title, list, to]) => list.length > 0 && (
                <div key={title}>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-muted)]">{title}</div>
                  <ul className="divide-y divide-[color:var(--border)] rounded-[6px] border border-[color:var(--border)]">
                    {list.map((a) => (
                      <li key={`${a.kind}-${a.id}`} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold">{a.title}</div>
                          <div className="truncate text-[12px] text-[color:var(--text-muted)]">{a.category}{a.number ? ` · ${a.number}` : ''} · expires {fmtDate(a.expiryDate)}</div>
                        </div>
                        <Badge tone={daysTone(a.daysLeft)}>{daysText(a.daysLeft)}</Badge>
                        <Link to={to} className="text-[color:var(--text-muted)] hover:text-[color:var(--primary)]" aria-label="Open"><ArrowRight className="size-4" /></Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Partner balances" bodyClassName="p-3" actions={<Link to="/admin/company/partners" className="text-[12px] font-bold text-[color:var(--primary)] hover:underline">Ledger →</Link>}>
          {!data ? <Skeleton className="h-24 w-full" /> : data.partners.length === 0 ? (
            <EmptyState icon={HandCoins} title="No partners yet" action={<Link to="/admin/company/partners"><Button size="sm">Add partners</Button></Link>} />
          ) : (
            <div className="space-y-3">
              <div className="grid-box">
                <table>
                  <thead><tr><th className="text-left">Partner</th><th className="text-right">Share</th><th className="text-right">Paid for company</th><th className="text-right">Their share</th><th className="text-right">Capital</th><th className="text-right">Net</th></tr></thead>
                  <tbody>
                    {data.partners.map((p) => (
                      <tr key={p.partnerId}>
                        <td className="font-bold">{p.name}{!p.isActive && <Badge className="ml-1.5">Inactive</Badge>}</td>
                        <td className="text-right tabular-nums">{Number(p.sharePercent)}%</td>
                        <td className="text-right tabular-nums">{fmtAmt(p.paidOnBehalf)}</td>
                        <td className="text-right tabular-nums">{fmtAmt(p.shareOfExpenses)}</td>
                        <td className="text-right tabular-nums">{fmtAmt(p.capital)}</td>
                        <td className={`text-right font-bold tabular-nums ${p.netBalance < 0 ? 'text-[color:var(--danger)]' : ''}`}>{fmtAmt(p.netBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-muted)]">Who owes whom</div>
                {data.settlement.length === 0 ? <p className="text-[13px] text-[color:var(--success)]">All expense shares are settled.</p> : (
                  <ul className="space-y-1.5">
                    {data.settlement.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-[13px]">
                        <span className="flex-1"><b>{s.fromName}</b> pays <b>{s.toName}</b></span>
                        <span className="font-bold tabular-nums">{fmtAmt(s.amount)}</span>
                        <Button size="sm" variant="secondary" className="!h-7" onClick={() => setSettle(s)}>Record</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {settle && <PartnerTxnDialog suggestion={settle} onClose={() => setSettle(null)} onSaved={() => { setSettle(null); load(); }} />}
    </div>
  );
}
