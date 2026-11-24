import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowRightLeft, Edit2, FileText, HandCoins, Plus, Trash2, Users } from 'lucide-react';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import {
  Badge, Button, Card, DialogPanel, EmptyState, Field, IconButton, PageHeader, Pagination, Skeleton, Toolbar, usePagination,
} from '@/admin/ui';
import { DateRange } from '@/admin/components/company/shared';
import { apiGet, errMsg, fmtAmt, fmtDate, fyStart, isoDay, today, usePartners } from '@/admin/components/company/companyUtils';
import PartnerTxnDialog from '@/admin/pages/company/PartnerTxnDialog';

const EMPTY = { name: '', phone: '', email: '', sharePercent: '', isActive: true, joinedOn: '', notes: '', adminUserId: '' };
const TXN_TONE = { Contribution: 'success', Withdrawal: 'warning', Settlement: 'info' };
const TXN_LABEL = { Contribution: 'Capital in', Withdrawal: 'Withdrawal', Settlement: 'Settlement' };
const money = (n, strong) => <span className={`tabular-nums ${strong ? 'font-bold' : ''} ${Number(n) < 0 ? 'text-[color:var(--danger)]' : ''}`}>{fmtAmt(n)}</span>;

export default function CompanyPartners() {
  const { partners, shareTotal, shareWarning, loading, reload } = usePartners();
  const [range, setRange] = useState({ from: fyStart(), to: today() });
  const [ledger, setLedger] = useState(null);
  const [txns, setTxns] = useState(null);
  const [edit, setEdit] = useState(null);           // partner form state (with id when editing)
  const [saving, setSaving] = useState(false);
  const [txnDialog, setTxnDialog] = useState(null); // { suggestion? , type? }
  const [statement, setStatement] = useState(null); // { partner, data }
  const [logins, setLogins] = useState([]);           // admin logins a partner can be linked to (expense approvals)
  useEffect(() => {
    if (!edit) return;
    apiGet('/admin/company/partner-logins').then(setLogins).catch(() => setLogins([]));
  }, [edit?.id, !!edit]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLedger = useCallback(async () => {
    const params = { from: range.from || undefined, to: range.to || undefined };
    try {
      const [l, t] = await Promise.all([apiGet('/admin/company/ledger', params), apiGet('/admin/company/transactions', params)]);
      setLedger(l); setTxns(t);
    } catch (err) { toast.error(errMsg(err, 'Could not load the ledger')); setLedger({ rows: [], balances: [], settlement: [] }); setTxns([]); }
  }, [range]);
  useEffect(() => { loadLedger(); }, [loadLedger]);
  const refresh = () => { reload(); loadLedger(); };

  const savePartner = async () => {
    if (!edit.name.trim()) { toast.error('Name is required'); return; }
    const share = Number(edit.sharePercent || 0);
    if (share < 0 || share > 100) { toast.error('Share % must be between 0 and 100'); return; }
    setSaving(true);
    try {
      const body = { ...edit, sharePercent: share, joinedOn: edit.joinedOn || null, phone: edit.phone || null, email: edit.email || null, notes: edit.notes || null,
        adminUserId: edit.adminUserId ? Number(edit.adminUserId) : null };
      const res = edit.id ? await api.put(`/admin/company/partners/${edit.id}`, body) : await api.post('/admin/company/partners', body);
      toast.success(edit.id ? 'Partner updated' : 'Partner added');
      if (res.data.data?.shareWarning) toast(res.data.data.shareWarning, { icon: '⚠️' });
      setEdit(null); refresh();
    } catch (err) { toast.error(errMsg(err, 'Could not save the partner')); }
    finally { setSaving(false); }
  };

  const removePartner = async (p) => {
    if (!window.confirm(`Delete partner "${p.name}"?`)) return;
    try { await api.delete(`/admin/company/partners/${p.id}`); toast.success('Partner deleted'); refresh(); }
    catch (err) { toast.error(errMsg(err, 'Could not delete')); }
  };

  const removeTxn = async (t) => {
    if (!window.confirm(`Delete this ${TXN_LABEL[t.type].toLowerCase()} entry of ${fmtAmt(t.amount)}?`)) return;
    try { await api.delete(`/admin/company/transactions/${t.id}`); toast.success('Entry deleted'); loadLedger(); }
    catch (err) { toast.error(errMsg(err, 'Could not delete')); }
  };

  const openStatement = async (p) => {
    try { setStatement({ partner: p, data: await apiGet(`/admin/company/partners/${p.id}/statement`, { from: range.from || undefined, to: range.to || undefined }) }); }
    catch (err) { toast.error(errMsg(err, 'Could not load the statement')); }
  };

  const txPg = usePagination(txns || [], 10);

  return (
    <div className="space-y-4">
      <PageHeader title="Partners & ledger" description="Profit/loss shares, money paid on the company's behalf, capital, withdrawals and settlements"
        actions={<>
          <Button variant="secondary" onClick={() => setTxnDialog({})}><ArrowRightLeft className="size-4" /> Record money entry</Button>
          <Button onClick={() => setEdit({ ...EMPTY })}><Plus className="size-4" /> Add partner</Button>
        </>} />

      <Card title="Partners" bodyClassName="p-3"
        actions={<span className={`text-[12px] font-bold ${shareWarning ? 'text-[color:var(--warning)]' : 'text-[color:var(--success)]'}`}>Active shares total {Number(shareTotal || 0)}%</span>}>
        {shareWarning && (
          <div className="mb-3 flex items-center gap-2 rounded-[6px] bg-[color:var(--warning-bg)] px-3 py-2 text-[13px] text-[color:var(--warning)]">
            <AlertTriangle className="size-4 shrink-0" /> <span className="text-[color:var(--text-primary)]">{shareWarning}</span>
          </div>
        )}
        {loading ? <Skeleton className="h-20 w-full" /> : partners.length === 0 ? (
          <EmptyState icon={Users} title="No partners yet">Add each partner with their profit/loss share %. Shares of active partners should add up to 100%.</EmptyState>
        ) : (
          <div className="grid-box">
            <table>
              <thead><tr><th className="text-left">Name</th><th className="text-left">Contact</th><th className="text-left">Admin login</th><th className="text-right">Share %</th><th className="text-left">Joined</th><th className="text-left">Status</th><th className="text-center">Actions</th></tr></thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id}>
                    <td className="font-bold">{p.name}{p.notes && <div className="max-w-60 truncate text-[12px] font-normal text-[color:var(--text-muted)]">{p.notes}</div>}</td>
                    <td className="text-[12px] text-[color:var(--text-secondary)]">{[p.phone, p.email].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="text-[12px]">{p.adminLogin ? <span className="text-[color:var(--text-secondary)]">{p.adminLogin}</span> : <Badge tone="warning" title="Link a login so this partner can approve the other partners' expenses">Not linked</Badge>}</td>
                    <td className="text-right font-bold tabular-nums">{Number(p.sharePercent)}%</td>
                    <td className="text-[color:var(--text-muted)]">{fmtDate(p.joinedOn)}</td>
                    <td><Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <IconButton label="Statement" onClick={() => openStatement(p)}><FileText className="size-3.5" /></IconButton>
                        <IconButton label="Edit" onClick={() => setEdit({ ...EMPTY, ...p, sharePercent: String(p.sharePercent), joinedOn: isoDay(p.joinedOn), phone: p.phone || '', email: p.email || '', notes: p.notes || '', adminUserId: p.adminUserId ? String(p.adminUserId) : '' })}><Edit2 className="size-3.5" /></IconButton>
                        <IconButton label="Delete" tone="danger" onClick={() => removePartner(p)}><Trash2 className="size-3.5" /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Toolbar>
        <span className="text-[13px] font-bold text-[color:var(--text-secondary)]">Ledger period</span>
        <DateRange from={range.from} to={range.to} onChange={setRange} />
        <Button size="sm" variant="tertiary" onClick={() => setRange({ from: '', to: today() })}>All time</Button>
      </Toolbar>

      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-3">
        <Card title="Partner ledger (selected period)" className="2xl:col-span-2" bodyClassName="p-3">
          {!ledger ? <Skeleton className="h-24 w-full" /> : (
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Partner</th>
                    <th className="text-right" title="Personal money spent on company expenses">Paid for company</th>
                    <th className="text-right" title="Their split of expenses">Share of expenses</th>
                    <th className="text-right">Capital in</th>
                    <th className="text-right">Withdrawn</th>
                    <th className="text-right" title="Settlements paid − received">Settlements</th>
                    <th className="text-right" title="+ others owe them · − they owe">Expense balance</th>
                    <th className="text-right" title="Capital + expense balance">Net balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map((r) => (
                    <tr key={r.partnerId ?? 'company'}>
                      <td className="font-bold">{r.name}{r.partnerId == null && <span className="ml-1 text-[11px] font-normal text-[color:var(--text-muted)]">(company account)</span>}</td>
                      <td className="text-right">{money(r.paidOnBehalf)}</td>
                      <td className="text-right">{money(r.shareOfExpenses)}</td>
                      <td className="text-right">{money(r.contributions)}</td>
                      <td className="text-right">{money(r.withdrawals)}</td>
                      <td className="text-right">{money(r.settlementsPaid - r.settlementsReceived)}</td>
                      <td className="text-right">{money(r.expenseBalance, true)}</td>
                      <td className="text-right">{r.partnerId == null ? '—' : money(r.netBalance, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[12px] text-[color:var(--text-muted)]">
            Expense balance = paid for company − share of expenses + settlements paid − settlements received. Expenses entered before this module (no split) count as company costs.
          </p>
        </Card>

        <Card title="Who owes whom" bodyClassName="p-3" actions={<span className="text-[11px] text-[color:var(--text-muted)]">all entries up to {fmtDate(range.to || today())}</span>}>
          {!ledger ? <Skeleton className="h-24 w-full" /> : ledger.settlement.length === 0 ? (
            <EmptyState icon={HandCoins} title="All settled">Nobody owes anyone for shared expenses.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {ledger.settlement.map((s, i) => (
                <li key={i} className="rounded-[6px] border border-[color:var(--border)] p-2.5 text-[13px]">
                  <div><b>{s.fromName}</b> pays <b>{s.toName}</b></div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[16px] font-bold tabular-nums">{fmtAmt(s.amount)}</span>
                    <Button size="sm" onClick={() => setTxnDialog({ suggestion: s })}>Record payment</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Capital, withdrawals & settlements" bodyClassName="p-3"
        actions={<Button size="sm" variant="secondary" onClick={() => setTxnDialog({})}><Plus className="size-3.5" /> Add entry</Button>}>
        {!txns ? <Skeleton className="h-20 w-full" /> : txns.length === 0 ? <EmptyState icon={ArrowRightLeft} title="No entries in this period" /> : (
          <>
            <div className="grid-box">
              <table>
                <thead><tr><th className="text-left">Date</th><th className="text-left">Type</th><th className="text-left">From → To</th><th className="text-right">Amount</th><th className="text-left">Mode / ref</th><th className="text-left">By</th><th /></tr></thead>
                <tbody>
                  {txPg.items.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(t.date)}</td>
                      <td><Badge tone={TXN_TONE[t.type]}>{TXN_LABEL[t.type]}</Badge></td>
                      <td>{t.fromName} → {t.toName}{t.notes && <div className="max-w-60 truncate text-[12px] text-[color:var(--text-muted)]">{t.notes}</div>}</td>
                      <td className="text-right font-bold tabular-nums">{fmtAmt(t.amount)}</td>
                      <td className="text-[12px] text-[color:var(--text-secondary)]">{[t.mode, t.reference].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="text-[12px] text-[color:var(--text-muted)]">{t.createdBy}</td>
                      <td><IconButton label="Delete" tone="danger" onClick={() => removeTxn(t)}><Trash2 className="size-3.5" /></IconButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...txPg} noun="entries" />
          </>
        )}
      </Card>

      {edit && (
        <AdminModal onClose={() => setEdit(null)}>
          <DialogPanel title={edit.id ? 'Edit partner' : 'Add partner'} onClose={() => setEdit(null)} width="max-w-md"
            footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={savePartner} loading={saving}>Save</Button></>}>
            <div className="space-y-3">
              <Field label="Name" required><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="input-field" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone"><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className="input-field" /></Field>
                <Field label="Email"><input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className="input-field" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Profit / loss share %" required hint={`Other active partners: ${Number(shareTotal || 0) - (edit.id && edit.isActive ? Number(partners.find((p) => p.id === edit.id)?.sharePercent || 0) : 0)}%`}>
                  <input type="number" min="0" max="100" step="0.01" value={edit.sharePercent} onChange={(e) => setEdit({ ...edit, sharePercent: e.target.value })} className="input-field" />
                </Field>
                <Field label="Joined on"><input type="date" value={edit.joinedOn} onChange={(e) => setEdit({ ...edit, joinedOn: e.target.value })} className="input-field" /></Field>
              </div>
              <Field label="Admin login" hint="The partner's own admin-panel account. Partners approve each other's expenses — nobody can approve an expense they added.">
                <select value={edit.adminUserId} onChange={(e) => setEdit({ ...edit, adminUserId: e.target.value })} className="input-field">
                  <option value="">— Not linked —</option>
                  {logins.map((u) => {
                    const takenByOther = u.linkedPartnerId && u.linkedPartnerId !== edit.id;
                    return <option key={u.id} value={u.id} disabled={takenByOther}>{u.name} ({u.email}){takenByOther ? ` — linked to ${u.linkedPartnerName}` : ''}</option>;
                  })}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Active partner (included in splits)
              </label>
              <Field label="Notes"><textarea rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} className="input-field !h-auto py-2" /></Field>
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {statement && (
        <AdminModal onClose={() => setStatement(null)}>
          <DialogPanel title={`Statement — ${statement.partner.name}`} onClose={() => setStatement(null)} width="max-w-3xl">
            {statement.data.rows.length === 0 ? <EmptyState title="No entries in this period" /> : (
              <div className="grid-box">
                <table>
                  <thead><tr><th className="text-left">Date</th><th className="text-left">Entry</th><th className="text-right">Credit</th><th className="text-right">Debit</th><th className="text-right">Balance</th></tr></thead>
                  <tbody>
                    {statement.data.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(r.date)}</td>
                        <td>{r.text}</td>
                        <td className="text-right tabular-nums">{r.credit ? fmtAmt(r.credit) : ''}</td>
                        <td className="text-right tabular-nums">{r.debit ? fmtAmt(r.debit) : ''}</td>
                        <td className="text-right">{money(r.balance, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[12px] text-[color:var(--text-muted)]">Credit = paid for the company, capital in, settlement paid · Debit = share of expenses, withdrawal, settlement received. Closing: <b>{fmtAmt(statement.data.closing)}</b></p>
          </DialogPanel>
        </AdminModal>
      )}

      {txnDialog && <PartnerTxnDialog suggestion={txnDialog.suggestion} onClose={() => setTxnDialog(null)} onSaved={() => { setTxnDialog(null); loadLedger(); }} />}
    </div>
  );
}
