import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing, Edit2, FileBadge, History, Paperclip, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import {
  Badge, Button, Card, DialogPanel, EmptyState, Field, IconButton, PageHeader, SearchInput, Skeleton, Stat, Toolbar,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';
import { AttachmentField, PaymentFields, SplitChips } from '@/admin/components/company/shared';
import {
  LICENCE_STATUS, apiGet, daysText, daysTone, emptyPayment, errMsg, fmtAmt, fmtDate, isoDay, openFile,
  paymentFromExpense, paymentToApi, today, uploadFile, usePartners,
} from '@/admin/components/company/companyUtils';

const EMPTY = {
  licenceType: '', title: '', number: '', issuingAuthority: '', startDate: '', expiryDate: '', lifetime: false,
  fee: '', reminderDays: '30', notes: '', createExpense: false,
};

export default function CompanyLicences() {
  const lk = useLookups();
  const types = lk.list('LicenceType');
  const paidByOptions = lk.list('ExpensePaidBy');
  const { partners, reload: reloadPartners } = usePartners();
  const [data, setData] = useState(null);
  const [showRenewed, setShowRenewed] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);        // { mode: 'new' | 'edit' | 'renew', id?, … }
  const [payment, setPayment] = useState(emptyPayment());
  const [paymentDirty, setPaymentDirty] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try { setData(await apiGet('/admin/company/licences', { includeRenewed: showRenewed })); }
    catch (err) { toast.error(errMsg(err, 'Could not load licences')); setData({ licences: [], totals: {} }); }
  }, [showRenewed]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.licences || []).filter((l) => (!statusFilter || l.status === statusFilter)
      && (!q || `${l.title} ${l.number || ''} ${l.licenceType} ${l.issuingAuthority || ''}`.toLowerCase().includes(q)));
  }, [data, search, statusFilter]);
  const alerts = (data?.licences || []).filter((l) => l.status === 'ExpiringSoon' || l.status === 'Expired');
  const typeLabel = (v) => lk.label('LicenceType', v);
  const f = (v) => setForm((p) => ({ ...p, ...v }));

  const open = (mode, l) => {
    reloadPartners();
    setPendingFile(null);
    setPaymentDirty(false);
    const firstMode = paidByOptions[0]?.value || '';
    if (mode === 'new') {
      setForm({ ...EMPTY, mode, licenceType: types[0]?.value || '' });
      setPayment(emptyPayment(firstMode));
      return;
    }
    const base = {
      ...EMPTY, mode, id: l.id, licenceType: l.licenceType, title: l.title, number: l.number || '', issuingAuthority: l.issuingAuthority || '',
      reminderDays: String(l.reminderDays ?? 30), notes: l.notes || '',
    };
    if (mode === 'edit') {
      setForm({
        ...base, startDate: isoDay(l.startDate), expiryDate: isoDay(l.expiryDate), lifetime: !l.expiryDate, fee: String(l.fee),
        createExpense: !!l.expense, hadExpense: !!l.expense, hasDocument: l.hasDocument,
      });
      setPayment(paymentFromExpense(l.expense, firstMode));
    } else {
      // renew: next period starts the day after the current expiry
      const start = l.expiryDate ? new Date(new Date(l.expiryDate).getTime() + 86400000).toLocaleDateString('en-CA') : today();
      setForm({ ...base, startDate: start, expiryDate: '', fee: String(l.fee || ''), createExpense: Number(l.fee) > 0, previous: l });
      setPayment(l.expense ? { ...paymentFromExpense(l.expense, firstMode) } : emptyPayment(firstMode));
      setPaymentDirty(true);
    }
  };

  const save = async () => {
    if (!form.licenceType || !form.title.trim()) { toast.error('Type and name are required'); return; }
    if (!form.lifetime && form.mode !== 'edit' && !form.expiryDate && !window.confirm('No expiry date — save it as a lifetime registration?')) return;
    if (form.createExpense && !(Number(form.fee) > 0)) { toast.error('Enter the fee to record it as an expense'); return; }
    setSaving(true);
    try {
      const body = {
        licenceType: form.licenceType, title: form.title, number: form.number || null, issuingAuthority: form.issuingAuthority || null,
        startDate: form.startDate || null, expiryDate: form.lifetime ? null : (form.expiryDate || null), fee: Number(form.fee || 0),
        reminderDays: Number(form.reminderDays || 30), notes: form.notes || null, createExpense: form.createExpense,
        payment: form.createExpense && (!form.hadExpense || paymentDirty) ? paymentToApi(payment) : null,
      };
      const res = form.mode === 'new' ? await api.post('/admin/company/licences', body)
        : form.mode === 'edit' ? await api.put(`/admin/company/licences/${form.id}`, body)
          : await api.post(`/admin/company/licences/${form.id}/renew`, body);
      const id = res.data.data.id;
      if (pendingFile) {
        try { await uploadFile('licence', id, pendingFile); } catch (err) { toast.error(errMsg(err, 'Saved, but the document upload failed')); }
      }
      toast.success(form.mode === 'renew' ? 'Licence renewed — the old period is kept in history' : form.mode === 'edit' ? 'Licence updated' : 'Licence added');
      setForm(null); load();
    } catch (err) { toast.error(errMsg(err, 'Could not save the licence')); }
    finally { setSaving(false); }
  };

  const remove = async (l) => {
    if (!window.confirm(`Delete "${l.title}"${l.number ? ` (${l.number})` : ''}?${l.expense ? ` Its fee expense of ${fmtAmt(l.expense.amount)} is deleted too.` : ''}`)) return;
    try { await api.delete(`/admin/company/licences/${l.id}`, { params: { withExpense: true } }); toast.success('Licence deleted'); load(); }
    catch (err) { toast.error(errMsg(err, 'Could not delete')); }
  };

  const runAlerts = async () => {
    setSending(true);
    try { const res = await api.post('/admin/company/alerts/run'); toast.success(res.data.message || 'Done'); }
    catch (err) { toast.error(errMsg(err, 'Could not send the alert email')); }
    finally { setSending(false); }
  };

  const openHistory = async (l) => {
    try { setHistory(await apiGet(`/admin/company/licences/${l.id}`)); } catch (err) { toast.error(errMsg(err, 'Could not load history')); }
  };

  const t = data?.totals || {};
  const statusBadge = (l) => {
    const s = LICENCE_STATUS[l.status] || { label: l.status, tone: 'neutral' };
    return <Badge tone={s.tone}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Licences & registrations" description="FSSAI, GST, Udyam, trade licence, trademark… with expiry alerts, fees and renewal history"
        actions={<>
          <Button variant="secondary" onClick={runAlerts} loading={sending} title="Email the store inbox about alerts not sent before"><Send className="size-4" /> Email alerts now</Button>
          <Button onClick={() => open('new')}><Plus className="size-4" /> Add licence</Button>
        </>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active / lifetime" value={t.active ?? 0} icon={FileBadge} tone="success" loading={!data} />
        <Stat label="Expiring soon" value={t.expiringSoon ?? 0} icon={BellRing} tone={t.expiringSoon ? 'warning' : 'neutral'} loading={!data} />
        <Stat label="Expired" value={t.expired ?? 0} tone={t.expired ? 'danger' : 'neutral'} loading={!data} />
        <Stat label="Fees this financial year" value={fmtAmt(t.feesThisFy)} loading={!data} />
      </div>

      {alerts.length > 0 && (
        <Card title="Needs renewal" bodyClassName="p-3">
          <ul className="space-y-2">
            {alerts.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Badge tone={daysTone(l.daysLeft)}>{daysText(l.daysLeft)}</Badge>
                <span className="min-w-0 flex-1 truncate"><b>{l.title}</b> · {typeLabel(l.licenceType)}{l.number ? ` · ${l.number}` : ''} · expires {fmtDate(l.expiryDate)}</span>
                <Button size="sm" onClick={() => open('renew', l)}><RefreshCw className="size-3.5" /> Renew</Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-[color:var(--text-muted)]">The store inbox (Settings → email) gets a reminder at 30, 15, 7 and 1 day(s) before expiry and on expiry — each only once.</p>
        </Card>
      )}

      <Card bodyClassName="space-y-3 p-3">
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, number, type…" className="max-w-sm" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field !h-9 !w-44" aria-label="Status">
            <option value="">Any status</option>
            {Object.entries(LICENCE_STATUS).filter(([k]) => k !== 'Renewed' || showRenewed).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={showRenewed} onChange={(e) => setShowRenewed(e.target.checked)} /> Show renewed (old) periods</label>
        </Toolbar>
        {!data ? <Skeleton className="h-40 w-full" /> : rows.length === 0 ? (
          <EmptyState icon={FileBadge} title="No licences yet" action={<Button size="sm" onClick={() => open('new')}><Plus className="size-3.5" /> Add licence</Button>}>Add FSSAI, GST, Udyam, trade licence and others to get renewal reminders.</EmptyState>
        ) : (
          <div className="grid-box">
            <table>
              <thead><tr><th className="text-left">Licence</th><th className="text-left">Number / authority</th><th className="text-left">Valid</th><th className="text-left">Status</th><th className="text-right">Fee</th><th className="text-left">Paid by / split</th><th className="text-center">Actions</th></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="max-w-56"><div className="truncate font-bold">{l.title}</div><div className="truncate text-[12px] text-[color:var(--text-muted)]">{typeLabel(l.licenceType)}</div></td>
                    <td className="text-[12px]"><div className="font-bold">{l.number || '—'}</div><div className="text-[color:var(--text-muted)]">{l.issuingAuthority || ''}</div></td>
                    <td className="whitespace-nowrap text-[12px]">{fmtDate(l.startDate)} → {l.expiryDate ? fmtDate(l.expiryDate) : 'Lifetime'}
                      {l.expiryDate && l.status !== 'Renewed' && <div className="text-[color:var(--text-muted)]">{daysText(l.daysLeft)} · remind {l.reminderDays}d before</div>}</td>
                    <td>{statusBadge(l)}</td>
                    <td className="whitespace-nowrap text-right font-bold tabular-nums">{Number(l.fee) ? fmtAmt(l.fee) : '—'}</td>
                    <td className="max-w-56">{l.expense ? <><div className="text-[12px] font-bold">{l.expense.paidByName}</div><SplitChips splits={l.expense.splits} /></> : <span className="text-[12px] text-[color:var(--text-muted)]">—</span>}</td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        {l.hasDocument && <IconButton label="View document" onClick={() => openFile('licence', l.id)}><Paperclip className="size-3.5" /></IconButton>}
                        {l.status !== 'Renewed' && l.expiryDate && <IconButton label="Renew" tone="primary" onClick={() => open('renew', l)}><RefreshCw className="size-3.5" /></IconButton>}
                        <IconButton label="History" onClick={() => openHistory(l)}><History className="size-3.5" /></IconButton>
                        <IconButton label="Edit" onClick={() => open('edit', l)}><Edit2 className="size-3.5" /></IconButton>
                        {l.status !== 'Renewed' && <IconButton label="Delete" tone="danger" onClick={() => remove(l)}><Trash2 className="size-3.5" /></IconButton>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {form && (
        <AdminModal onClose={() => setForm(null)}>
          <DialogPanel title={form.mode === 'renew' ? `Renew — ${form.title}` : form.mode === 'edit' ? 'Edit licence' : 'Add licence'} onClose={() => setForm(null)} width="max-w-2xl"
            footer={<><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button onClick={save} loading={saving}>{form.mode === 'renew' ? 'Save renewal' : 'Save'}</Button></>}>
            <div className="space-y-3">
              {form.mode === 'renew' && (
                <p className="rounded-[6px] bg-[color:var(--info-bg)] px-3 py-2 text-[12px] text-[color:var(--info)]">
                  The current period ({fmtDate(form.previous?.startDate)} → {fmtDate(form.previous?.expiryDate)}) stays in history. Enter the new period, fee and certificate.
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Type" required hint="Edit the list in Settings → master data (LicenceType)">
                  <select value={form.licenceType} onChange={(e) => f({ licenceType: e.target.value })} className="input-field">
                    {!form.licenceType && <option value="">Select…</option>}
                    {lookupOptions(types, form.licenceType).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Name / title" required><input value={form.title} onChange={(e) => f({ title: e.target.value })} className="input-field" placeholder="e.g. FSSAI State licence — factory" /></Field>
                <Field label="Licence / registration no."><input value={form.number} onChange={(e) => f({ number: e.target.value })} className="input-field" /></Field>
                <Field label="Issuing authority"><input value={form.issuingAuthority} onChange={(e) => f({ issuingAuthority: e.target.value })} className="input-field" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Start / issue date"><input type="date" value={form.startDate} onChange={(e) => f({ startDate: e.target.value })} className="input-field" /></Field>
                <Field label="Expiry date"><input type="date" value={form.lifetime ? '' : form.expiryDate} disabled={form.lifetime} onChange={(e) => f({ expiryDate: e.target.value })} className="input-field" /></Field>
                <Field label="Remind days before"><input type="number" min="0" max="365" value={form.reminderDays} onChange={(e) => f({ reminderDays: e.target.value })} className="input-field" /></Field>
                <Field label="Fee paid (₹)"><input type="number" min="0" step="0.01" value={form.fee} onChange={(e) => f({ fee: e.target.value })} className="input-field" /></Field>
              </div>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.lifetime} onChange={(e) => f({ lifetime: e.target.checked })} /> No expiry (lifetime, e.g. Udyam)</label>
              <label className="flex items-center gap-2 text-[13px] font-bold">
                <input type="checkbox" checked={form.createExpense} disabled={form.hadExpense} onChange={(e) => f({ createExpense: e.target.checked })} />
                {form.hadExpense ? 'Fee expense is linked — fee / date changes update it' : 'Record the fee as an expense (with who paid + split)'}
              </label>
              {form.createExpense && <PaymentFields value={payment} onChange={(v) => { setPayment(v); setPaymentDirty(true); }} amount={form.fee} partners={partners} paidByOptions={paidByOptions} />}
              <Field label="Notes"><textarea rows={2} value={form.notes} onChange={(e) => f({ notes: e.target.value })} className="input-field !h-auto py-2" /></Field>
              <AttachmentField kind="licence" id={form.mode === 'edit' ? form.id : null} hasFile={form.mode === 'edit' && form.hasDocument} pending={pendingFile}
                onPending={setPendingFile} onChanged={(v) => { f({ hasDocument: v }); load(); }} label="Certificate / document" />
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {history && (
        <AdminModal onClose={() => setHistory(null)}>
          <DialogPanel title={`History — ${history.licence.title}`} onClose={() => setHistory(null)} width="max-w-2xl">
            <div className="space-y-4">
              <div className="grid-box">
                <table>
                  <thead><tr><th className="text-left">Period</th><th className="text-left">Number</th><th className="text-left">Status</th><th className="text-right">Fee</th><th className="text-left">Paid by</th><th /></tr></thead>
                  <tbody>
                    {history.history.map((h) => (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap">{fmtDate(h.startDate)} → {h.expiryDate ? fmtDate(h.expiryDate) : 'Lifetime'}</td>
                        <td>{h.number || '—'}</td>
                        <td>{statusBadge(h)}</td>
                        <td className="text-right tabular-nums">{Number(h.fee) ? fmtAmt(h.fee) : '—'}</td>
                        <td className="text-[12px]">{h.expense?.paidByName || '—'}</td>
                        <td>{h.hasDocument && <IconButton label="View document" onClick={() => openFile('licence', h.id)}><Paperclip className="size-3.5" /></IconButton>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-muted)]">Alert emails sent</div>
                {history.alertsSent.length === 0 ? <p className="text-[13px] text-[color:var(--text-muted)]">None yet.</p> : (
                  <ul className="space-y-1 text-[13px]">
                    {history.alertsSent.map((a, i) => (
                      <li key={i}>{new Date(a.sentAt).toLocaleString('en-IN')} — {a.threshold === 0 ? 'on/after expiry' : `${a.threshold}-day reminder`} to {a.recipient}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}
