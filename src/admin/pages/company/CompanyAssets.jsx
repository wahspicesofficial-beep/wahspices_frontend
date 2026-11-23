import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Boxes, Edit2, History, Paperclip, Plus, ShieldAlert, Trash2, Wrench } from 'lucide-react';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import {
  Badge, Button, Card, DialogPanel, EmptyState, Field, IconButton, PageHeader, Pagination, SearchInput, Skeleton, Stat, Toolbar, usePagination,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';
import { AttachmentField, PaymentFields, SplitChips } from '@/admin/components/company/shared';
import {
  ASSET_STATUS, apiGet, assetStatus, daysText, daysTone, emptyPayment, errMsg, fmtAmt, fmtDate, isoDay, openFile,
  paymentFromExpense, paymentToApi, today, uploadFile, usePartners,
} from '@/admin/components/company/companyUtils';

const EMPTY = {
  name: '', category: '', purchaseDate: today(), cost: '', vendor: '', invoiceNumber: '', location: '', assignedTo: '',
  serialNumber: '', warrantyExpiry: '', status: 'InUse', disposalDate: '', disposalValue: '', notes: '', createExpense: true,
};

export default function CompanyAssets() {
  const lk = useLookups();
  const cats = lk.list('CompanyAssetCategory');
  const paidByOptions = lk.list('ExpensePaidBy');
  const { partners, reload: reloadPartners } = usePartners();
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);          // asset form (+ id)
  const [payment, setPayment] = useState(emptyPayment());
  const [paymentDirty, setPaymentDirty] = useState(false);   // unchanged split on edit → server re-scales the stored split
  const [pendingFile, setPendingFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusDlg, setStatusDlg] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try { setData(await apiGet('/admin/company/assets', { status: filters.status || undefined, category: filters.category || undefined })); }
    catch (err) { toast.error(errMsg(err, 'Could not load assets')); setData({ assets: [], totals: {} }); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.assets || []).filter((a) => !q || `${a.name} ${a.serialNumber || ''} ${a.vendor || ''} ${a.assignedTo || ''} ${a.location || ''}`.toLowerCase().includes(q));
  }, [data, search]);
  const pg = usePagination(rows, 20);
  const f = (v) => setForm((p) => ({ ...p, ...v }));
  const catLabel = (v) => lk.label('CompanyAssetCategory', v);

  const openNew = () => {
    reloadPartners();
    setForm({ ...EMPTY, category: cats[0]?.value || '' });
    setPayment(emptyPayment(paidByOptions[0]?.value || ''));
    setPaymentDirty(false);
    setPendingFile(null);
  };
  const openEdit = (a) => {
    reloadPartners();
    setForm({
      ...EMPTY, ...a, id: a.id, cost: String(a.cost), purchaseDate: isoDay(a.purchaseDate), warrantyExpiry: isoDay(a.warrantyExpiry),
      disposalDate: isoDay(a.disposalDate), disposalValue: a.disposalValue ?? '', vendor: a.vendor || '', invoiceNumber: a.invoiceNumber || '',
      location: a.location || '', assignedTo: a.assignedTo || '', serialNumber: a.serialNumber || '', notes: a.notes || '',
      createExpense: !!a.expense, hadExpense: !!a.expense, hasDocument: a.hasDocument,
    });
    setPayment(paymentFromExpense(a.expense, paidByOptions[0]?.value || ''));
    setPaymentDirty(false);
    setPendingFile(null);
  };

  const save = async () => {
    if (!form.name.trim() || !form.category || !form.purchaseDate) { toast.error('Name, category and purchase date are required'); return; }
    if (form.createExpense && !(Number(form.cost) > 0)) { toast.error('Enter the cost to record the purchase expense'); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name, category: form.category, purchaseDate: form.purchaseDate, cost: Number(form.cost || 0),
        vendor: form.vendor || null, invoiceNumber: form.invoiceNumber || null, location: form.location || null, assignedTo: form.assignedTo || null,
        serialNumber: form.serialNumber || null, warrantyExpiry: form.warrantyExpiry || null, status: form.status,
        disposalDate: form.disposalDate || null, disposalValue: form.disposalValue === '' ? null : Number(form.disposalValue), notes: form.notes || null,
        createExpense: form.createExpense, payment: form.createExpense && (!form.hadExpense || paymentDirty) ? paymentToApi(payment) : null,
      };
      const res = form.id ? await api.put(`/admin/company/assets/${form.id}`, body) : await api.post('/admin/company/assets', body);
      const id = res.data.data.id;
      if (pendingFile) {
        try { await uploadFile('asset', id, pendingFile); } catch (err) { toast.error(errMsg(err, 'Saved, but the bill upload failed')); }
      }
      toast.success(form.id ? 'Asset updated' : (form.createExpense ? 'Asset added with its purchase expense' : 'Asset added'));
      setForm(null); load();
    } catch (err) { toast.error(errMsg(err, 'Could not save the asset')); }
    finally { setSaving(false); }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.name}"?${a.expense ? ` Its purchase expense of ${fmtAmt(a.expense.amount)} is deleted too.` : ''}`)) return;
    try { await api.delete(`/admin/company/assets/${a.id}`, { params: { withExpense: true } }); toast.success('Asset deleted'); load(); }
    catch (err) { toast.error(errMsg(err, 'Could not delete')); }
  };

  const saveStatus = async () => {
    try {
      await api.post(`/admin/company/assets/${statusDlg.asset.id}/status`, {
        status: statusDlg.status, date: statusDlg.date || null, note: statusDlg.note || null,
        disposalValue: statusDlg.disposalValue === '' ? null : Number(statusDlg.disposalValue),
      });
      toast.success('Status updated'); setStatusDlg(null); load();
    } catch (err) { toast.error(errMsg(err, 'Could not change the status')); }
  };

  const openDetail = async (a) => {
    try { setDetail(await apiGet(`/admin/company/assets/${a.id}`)); } catch (err) { toast.error(errMsg(err, 'Could not load history')); }
  };

  const t = data?.totals || {};
  const editingExisting = !!form?.id;

  return (
    <div className="space-y-4">
      <PageHeader title="Assets register" description="Printers, stamps & seals, furniture, computers, machines — what the company owns and who paid"
        actions={<Button onClick={openNew}><Plus className="size-4" /> Add asset</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Value in use" value={fmtAmt(t.activeValue)} icon={Boxes} tone="primary" loading={!data} hint={`${t.activeCount ?? 0} item(s)`} />
        <Stat label="Total purchase cost" value={fmtAmt(t.totalCost)} loading={!data} hint={`${t.count ?? 0} item(s) incl. disposed`} />
        <Stat label="Warranty ending ≤ 30 days" value={t.warrantyDue ?? 0} icon={ShieldAlert} tone={t.warrantyDue ? 'warning' : 'neutral'} loading={!data} />
        <Stat label="Under repair" value={(data?.assets || []).filter((a) => a.status === 'UnderRepair').length} icon={Wrench} tone="accent" loading={!data} />
      </div>

      <Card bodyClassName="space-y-3 p-3">
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, serial, vendor, assigned to…" className="max-w-sm" />
          <select value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))} className="input-field !h-9 !w-48" aria-label="Category">
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="input-field !h-9 !w-40" aria-label="Status">
            <option value="">Any status</option>
            {ASSET_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Toolbar>
        {!data ? <Skeleton className="h-40 w-full" /> : rows.length === 0 ? (
          <EmptyState icon={Boxes} title="No assets yet" action={<Button size="sm" onClick={openNew}><Plus className="size-3.5" /> Add asset</Button>}>Record things the company buys — with the bill and who paid for it.</EmptyState>
        ) : (
          <>
            <div className="grid-box">
              <table>
                <thead><tr><th className="text-left">Asset</th><th className="text-left">Purchased</th><th className="text-right">Cost</th><th className="text-left">Paid by / split</th><th className="text-left">Where / who</th><th className="text-left">Warranty</th><th className="text-left">Status</th><th className="text-center">Actions</th></tr></thead>
                <tbody>
                  {pg.items.map((a) => (
                    <tr key={a.id}>
                      <td className="max-w-56">
                        <div className="truncate font-bold">{a.name}</div>
                        <div className="truncate text-[12px] text-[color:var(--text-muted)]">{catLabel(a.category)}{a.serialNumber ? ` · SN ${a.serialNumber}` : ''}</div>
                      </td>
                      <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(a.purchaseDate)}{a.vendor && <div className="text-[12px]">{a.vendor}</div>}</td>
                      <td className="whitespace-nowrap text-right font-bold tabular-nums">{fmtAmt(a.cost)}</td>
                      <td className="max-w-60">{a.expense ? <><div className="text-[12px] font-bold">{a.expense.paidByName}</div><SplitChips splits={a.expense.splits} /></> : <span className="text-[12px] text-[color:var(--text-muted)]">No expense linked</span>}</td>
                      <td className="text-[12px] text-[color:var(--text-secondary)]">{[a.location, a.assignedTo].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{a.warrantyExpiry ? <Badge tone={a.status === 'Disposed' || a.status === 'Lost' ? 'neutral' : daysTone(a.warrantyDaysLeft)}>{a.warrantyDaysLeft < 0 ? `Ended ${fmtDate(a.warrantyExpiry)}` : `${daysText(a.warrantyDaysLeft)}`}</Badge> : <span className="text-[color:var(--text-muted)]">—</span>}</td>
                      <td><Badge tone={assetStatus(a.status).tone}>{assetStatus(a.status).label}</Badge></td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          {a.hasDocument && <IconButton label="View bill" onClick={() => openFile('asset', a.id)}><Paperclip className="size-3.5" /></IconButton>}
                          <IconButton label="Change status" onClick={() => setStatusDlg({ asset: a, status: a.status === 'InUse' ? 'UnderRepair' : 'InUse', date: today(), note: '', disposalValue: '' })}><Wrench className="size-3.5" /></IconButton>
                          <IconButton label="History" onClick={() => openDetail(a)}><History className="size-3.5" /></IconButton>
                          <IconButton label="Edit" onClick={() => openEdit(a)}><Edit2 className="size-3.5" /></IconButton>
                          <IconButton label="Delete" tone="danger" onClick={() => remove(a)}><Trash2 className="size-3.5" /></IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} noun="assets" />
          </>
        )}
      </Card>

      {form && (
        <AdminModal onClose={() => setForm(null)}>
          <DialogPanel title={editingExisting ? 'Edit asset' : 'Add asset'} onClose={() => setForm(null)} width="max-w-2xl"
            footer={<><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button onClick={save} loading={saving}>Save asset</Button></>}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Asset name" required><input value={form.name} onChange={(e) => f({ name: e.target.value })} className="input-field" placeholder="e.g. HP LaserJet printer, company rubber stamp" /></Field>
                <Field label="Category" required hint="Edit the list in Settings → master data (CompanyAssetCategory)">
                  <select value={form.category} onChange={(e) => f({ category: e.target.value })} className="input-field">
                    {!form.category && <option value="">Select…</option>}
                    {lookupOptions(cats, form.category).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Purchase date" required><input type="date" value={form.purchaseDate} onChange={(e) => f({ purchaseDate: e.target.value })} className="input-field" /></Field>
                <Field label="Cost (₹)" required={form.createExpense}><input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => f({ cost: e.target.value })} className="input-field" /></Field>
                <Field label="Warranty until"><input type="date" value={form.warrantyExpiry} onChange={(e) => f({ warrantyExpiry: e.target.value })} className="input-field" /></Field>
                <Field label="Vendor"><input value={form.vendor} onChange={(e) => f({ vendor: e.target.value })} className="input-field" /></Field>
                <Field label="Bill / invoice no."><input value={form.invoiceNumber} onChange={(e) => f({ invoiceNumber: e.target.value })} className="input-field" /></Field>
                <Field label="Serial no."><input value={form.serialNumber} onChange={(e) => f({ serialNumber: e.target.value })} className="input-field" /></Field>
                <Field label="Location"><input value={form.location} onChange={(e) => f({ location: e.target.value })} className="input-field" placeholder="Office, factory…" /></Field>
                <Field label="Assigned to"><input value={form.assignedTo} onChange={(e) => f({ assignedTo: e.target.value })} className="input-field" placeholder="Person / desk" /></Field>
                <Field label="Status">
                  <select value={form.status} onChange={(e) => f({ status: e.target.value })} className="input-field">
                    {ASSET_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
              </div>
              {(form.status === 'Disposed' || form.status === 'Lost') && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Disposal date"><input type="date" value={form.disposalDate} onChange={(e) => f({ disposalDate: e.target.value })} className="input-field" /></Field>
                  <Field label="Disposal / sale value (₹)"><input type="number" min="0" value={form.disposalValue} onChange={(e) => f({ disposalValue: e.target.value })} className="input-field" /></Field>
                </div>
              )}

              <label className="flex items-center gap-2 text-[13px] font-bold">
                <input type="checkbox" checked={form.createExpense} disabled={form.hadExpense} onChange={(e) => f({ createExpense: e.target.checked })} />
                {form.hadExpense ? 'Purchase expense is linked — cost / date changes update it' : 'Also record the purchase as an expense (with who paid + split)'}
              </label>
              {form.createExpense && <PaymentFields value={payment} onChange={(v) => { setPayment(v); setPaymentDirty(true); }} amount={form.cost} partners={partners} paidByOptions={paidByOptions} />}

              <Field label="Notes"><textarea rows={2} value={form.notes} onChange={(e) => f({ notes: e.target.value })} className="input-field !h-auto py-2" /></Field>
              <AttachmentField kind="asset" id={form.id} hasFile={form.hasDocument} pending={pendingFile} onPending={setPendingFile}
                onChanged={(v) => { f({ hasDocument: v }); load(); }} label="Bill / invoice" />
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {statusDlg && (
        <AdminModal onClose={() => setStatusDlg(null)}>
          <DialogPanel title={`Change status — ${statusDlg.asset.name}`} onClose={() => setStatusDlg(null)} width="max-w-sm"
            footer={<><Button variant="secondary" onClick={() => setStatusDlg(null)}>Cancel</Button><Button onClick={saveStatus}>Save</Button></>}>
            <div className="space-y-3">
              <Field label="New status">
                <select value={statusDlg.status} onChange={(e) => setStatusDlg({ ...statusDlg, status: e.target.value })} className="input-field">
                  {ASSET_STATUS.filter((s) => s.value !== statusDlg.asset.status).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Date"><input type="date" value={statusDlg.date} onChange={(e) => setStatusDlg({ ...statusDlg, date: e.target.value })} className="input-field" /></Field>
              {(statusDlg.status === 'Disposed' || statusDlg.status === 'Lost') && (
                <Field label="Disposal / sale value (₹)"><input type="number" min="0" value={statusDlg.disposalValue} onChange={(e) => setStatusDlg({ ...statusDlg, disposalValue: e.target.value })} className="input-field" /></Field>
              )}
              <Field label="Note"><input value={statusDlg.note} onChange={(e) => setStatusDlg({ ...statusDlg, note: e.target.value })} className="input-field" placeholder="e.g. sent for repair to vendor" /></Field>
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {detail && (
        <AdminModal onClose={() => setDetail(null)}>
          <DialogPanel title={detail.asset.name} onClose={() => setDetail(null)} width="max-w-lg">
            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-[color:var(--text-muted)]">Category:</span> {catLabel(detail.asset.category)}</div>
                <div><span className="text-[color:var(--text-muted)]">Cost:</span> <b>{fmtAmt(detail.asset.cost)}</b></div>
                <div><span className="text-[color:var(--text-muted)]">Purchased:</span> {fmtDate(detail.asset.purchaseDate)}</div>
                <div><span className="text-[color:var(--text-muted)]">Bill no.:</span> {detail.asset.invoiceNumber || '—'}</div>
              </div>
              {detail.asset.expense && (
                <div className="rounded-[6px] border border-[color:var(--border)] p-2">
                  <div className="mb-1 text-[12px] font-bold">Purchase expense — paid by {detail.asset.expense.paidByName}</div>
                  <SplitChips splits={detail.asset.expense.splits} />
                </div>
              )}
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-muted)]">Status history</div>
                <ul className="space-y-1.5">
                  {detail.history.map((h) => (
                    <li key={h.id} className="flex items-start gap-2">
                      <span className="w-24 shrink-0 text-[color:var(--text-muted)]">{fmtDate(h.date)}</span>
                      <span className="flex-1">{h.fromStatus ? `${assetStatus(h.fromStatus).label} → ` : ''}<b>{assetStatus(h.toStatus).label}</b>{h.note && <span className="text-[color:var(--text-muted)]"> · {h.note}</span>}</span>
                      <span className="text-[12px] text-[color:var(--text-muted)]">{h.createdBy}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}
