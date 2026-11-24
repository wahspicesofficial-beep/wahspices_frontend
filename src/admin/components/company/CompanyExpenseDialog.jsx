// Add / edit an expense with who-paid (company account or a partner) + split between partners + receipt.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import { Button, DialogPanel, Field } from '@/admin/ui';
import { useLookups } from '@/admin/lookups';
import { AttachmentField, PaymentFields } from '@/admin/components/company/shared';
import { emptyPayment, errMsg, isoDay, paymentFromExpense, paymentToApi, today, uploadFile } from '@/admin/components/company/companyUtils';

/**
 * <CompanyExpenseDialog expense={null|row} partners={[]} categories={['Rent', …]} onClose onSaved />
 * expense rows come from GET /admin/company/expenses (or the Expenses list: it is re-fetched for its split).
 */
export default function CompanyExpenseDialog({ expense, partners, categories = [], onClose, onSaved }) {
  const lk = useLookups();
  const paidByOptions = lk.list('ExpensePaidBy');
  const firstMode = paidByOptions[0]?.value || '';
  const [form, setForm] = useState({ date: today(), category: categories[0] || '', description: '', amount: '', notes: '' });
  const [payment, setPayment] = useState(emptyPayment(firstMode));
  const [hasReceipt, setHasReceipt] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!expense);
  const f = (v) => setForm((p) => ({ ...p, ...v }));

  // Load the full record (with split rows) when editing
  useEffect(() => {
    if (!expense) return;
    let live = true;
    api.get(`/admin/company/expenses/${expense.id}`).then((res) => {
      if (!live) return;
      const e = res.data.data;
      setForm({ date: isoDay(e.date), category: e.category, description: e.description, amount: String(e.amount), notes: e.notes || '' });
      setPayment(paymentFromExpense(e, firstMode));
      setHasReceipt(!!e.hasReceipt);
      setLoaded(true);
    }).catch((err) => { toast.error(errMsg(err, 'Could not load the expense')); onClose(); });
    return () => { live = false; };
  }, [expense]); // eslint-disable-line react-hooks/exhaustive-deps

  // Company account mode default once lookups arrive
  useEffect(() => { if (!payment.paidBy && firstMode) setPayment((p) => ({ ...p, paidBy: firstMode })); }, [firstMode, payment.paidBy]);

  const save = async () => {
    if (!form.date || !form.description.trim() || !(Number(form.amount) > 0)) { toast.error('Date, description and amount are required'); return; }
    if (!form.category.trim()) { toast.error('Enter a category'); return; }
    setSaving(true);
    try {
      const body = { ...form, category: form.category.trim(), amount: Number(form.amount), notes: form.notes || null, ...paymentToApi(payment) };
      const res = expense
        ? await api.put(`/admin/company/expenses/${expense.id}`, body)
        : await api.post('/admin/company/expenses', body);
      const saved = res.data.data;
      if (pendingFile) {
        try { await uploadFile('expense', saved.id, pendingFile); }
        catch (err) { toast.error(errMsg(err, 'Expense saved, but the receipt upload failed')); }
      }
      // the server says when an edit needs approval again / that another partner must approve a new one
      toast.success(res?.data?.message && res.data.message !== 'Saved.' ? res.data.message : (expense ? 'Expense updated' : 'Expense recorded'), { duration: 6000 });
      onSaved?.(saved);
    } catch (err) {
      toast.error(errMsg(err, 'Could not save the expense'));
    } finally { setSaving(false); }
  };

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={expense ? 'Edit expense' : 'Add expense'}
        onClose={onClose}
        width="max-w-xl"
        footer={<>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!loaded}>{expense ? 'Update' : 'Save expense'}</Button>
        </>}
      >
        <div className="space-y-3">
          {expense?.sourceType && (
            <p className="rounded-[6px] bg-[color:var(--info-bg)] px-3 py-2 text-[12px] text-[color:var(--info)]">
              This expense was created from a {expense.sourceType === 'Asset' ? 'company asset' : 'licence'} — its amount follows that record when you edit it there.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <input type="date" value={form.date} onChange={(e) => f({ date: e.target.value })} className="input-field" />
            </Field>
            <Field label="Amount (₹)" required>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => f({ amount: e.target.value })} className="input-field" />
            </Field>
          </div>
          <Field label="Category" required>
            <input list="company-expense-categories" value={form.category} onChange={(e) => f({ category: e.target.value })} className="input-field" placeholder="e.g. Licences & Registrations" />
            <datalist id="company-expense-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Description" required>
            <input value={form.description} onChange={(e) => f({ description: e.target.value })} className="input-field" placeholder="What was it for? e.g. FSSAI renewal fee, rubber stamps" />
          </Field>
          <PaymentFields value={payment} onChange={setPayment} amount={form.amount} partners={partners} paidByOptions={paidByOptions} />
          <Field label="Notes">
            <input value={form.notes} onChange={(e) => f({ notes: e.target.value })} className="input-field" placeholder="Optional" />
          </Field>
          <AttachmentField kind="expense" id={expense?.id} hasFile={hasReceipt} pending={pendingFile} onPending={setPendingFile}
            onChanged={setHasReceipt} label="Receipt / bill" />
        </div>
      </DialogPanel>
    </AdminModal>
  );
}
