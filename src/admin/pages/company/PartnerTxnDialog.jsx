// Record a capital contribution, a withdrawal, or a settlement payment between partners / the company.
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import { Button, DialogPanel, Field, Segmented } from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';
import { errMsg, today, usePartners } from '@/admin/components/company/companyUtils';

const TYPES = [
  { value: 'Contribution', label: 'Capital in' },
  { value: 'Withdrawal', label: 'Withdrawal' },
  { value: 'Settlement', label: 'Settlement' },
];
const idOf = (v) => (v == null ? '' : String(v));   // '' = the company

/** suggestion = { fromPartnerId, toPartnerId, amount } from the "who owes whom" list (pre-fills a settlement). */
export default function PartnerTxnDialog({ suggestion, type: initialType, onClose, onSaved }) {
  const { partners } = usePartners();
  const lk = useLookups();
  const [form, setForm] = useState({
    type: suggestion ? 'Settlement' : (initialType || 'Contribution'),
    date: today(),
    from: idOf(suggestion?.fromPartnerId),
    to: idOf(suggestion?.toPartnerId),
    amount: suggestion ? String(suggestion.amount) : '',
    mode: '', reference: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const f = (v) => setForm((p) => ({ ...p, ...v }));
  const partyOptions = [{ value: '', label: 'Company account' }, ...partners.map((p) => ({ value: String(p.id), label: p.name + (p.isActive ? '' : ' (inactive)') }))];
  const partnerOptions = partyOptions.slice(1);

  const save = async () => {
    if (!(Number(form.amount) > 0)) { toast.error('Enter an amount'); return; }
    const body = {
      date: form.date, type: form.type, amount: Number(form.amount), mode: form.mode || null, reference: form.reference || null, notes: form.notes || null,
      fromPartnerId: form.type === 'Withdrawal' ? null : (form.from ? Number(form.from) : null),
      toPartnerId: form.type === 'Contribution' ? null : (form.to ? Number(form.to) : null),
    };
    setSaving(true);
    try { await api.post('/admin/company/transactions', body); toast.success('Entry recorded'); onSaved?.(); }
    catch (err) { toast.error(errMsg(err, 'Could not save')); }
    finally { setSaving(false); }
  };

  const select = (value, onChange, options) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
      <option value="" disabled={options === partnerOptions}>{options === partnerOptions ? 'Select partner…' : 'Company account'}</option>
      {options.filter((o) => o.value !== '').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel title="Partner money entry" onClose={onClose} width="max-w-md"
        footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save entry</Button></>}>
        <div className="space-y-3">
          <Segmented value={form.type} onChange={(v) => f({ type: v })} options={TYPES} />
          <p className="text-[12px] text-[color:var(--text-muted)]">
            {form.type === 'Contribution' && 'Money a partner put into the company (capital).'}
            {form.type === 'Withdrawal' && 'Money a partner took out of the company (drawings).'}
            {form.type === 'Settlement' && 'Squaring up expense shares — e.g. one partner pays another, or the company reimburses a partner.'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {form.type !== 'Withdrawal' && (
              <Field label={form.type === 'Contribution' ? 'Partner' : 'Paid by'} required>{select(form.from, (v) => f({ from: v }), form.type === 'Contribution' ? partnerOptions : partyOptions)}</Field>
            )}
            {form.type !== 'Contribution' && (
              <Field label={form.type === 'Withdrawal' ? 'Partner' : 'Paid to'} required>{select(form.to, (v) => f({ to: v }), form.type === 'Withdrawal' ? partnerOptions : partyOptions)}</Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required><input type="date" value={form.date} onChange={(e) => f({ date: e.target.value })} className="input-field" /></Field>
            <Field label="Amount (₹)" required><input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => f({ amount: e.target.value })} className="input-field" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mode">
              <select value={form.mode} onChange={(e) => f({ mode: e.target.value })} className="input-field">
                <option value="">—</option>
                {lookupOptions(lk.list('PaymentMode'), form.mode).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Reference"><input value={form.reference} onChange={(e) => f({ reference: e.target.value })} className="input-field" placeholder="UTR / cheque no." /></Field>
          </div>
          <Field label="Notes"><input value={form.notes} onChange={(e) => f({ notes: e.target.value })} className="input-field" /></Field>
        </div>
      </DialogPanel>
    </AdminModal>
  );
}
