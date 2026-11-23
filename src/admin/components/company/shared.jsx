// Company finance & compliance — shared form pieces (payer + split editor, attachments, chips, date range).
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Paperclip, Trash2, Upload } from 'lucide-react';
import api from '@/services/api';
import { Badge, Button, Field, IconButton, Segmented, cn } from '@/admin/ui';
import { lookupOptions } from '@/admin/lookups';
import { ALLOWED_FILE, SPLIT_METHODS, checkFile, errMsg, fmtAmt, openFile, previewSplit, uploadFile } from '@/admin/components/company/companyUtils';

/**
 * Who paid + split editor. value = payment state (emptyPayment()), onChange(next).
 * Used by expenses, asset purchases and licence fees.
 */
export function PaymentFields({ value, onChange, amount, partners, paidByOptions }) {
  const p = value;
  const set = (patch) => onChange({ ...p, ...patch });
  const activePartners = partners.filter((x) => x.isActive);
  const preview = useMemo(() => previewSplit(amount, p, partners), [amount, p, partners]);
  const customKeys = ['', ...activePartners.map((x) => String(x.id))];
  const names = { '': 'Company (no partner)', ...Object.fromEntries(partners.map((x) => [String(x.id), x.name])) };

  const setPayer = (payerType) => set({
    payerType,
    splitMethod: payerType === 'Partner' ? (p.splitMethod === 'None' ? 'Share' : p.splitMethod) : p.splitMethod,
    paidByPartnerId: payerType === 'Partner' ? (p.paidByPartnerId || String(activePartners[0]?.id || '')) : '',
  });
  const setCustom = (k, field, v) => set({ custom: { ...p.custom, [k]: { ...(p.custom?.[k] || {}), [field]: v } } });

  return (
    <div className="space-y-3 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-[color:var(--text-secondary)]">Who paid?</span>
        <Segmented size="sm" value={p.payerType} onChange={setPayer}
          options={[{ value: 'Company', label: 'Company account' }, { value: 'Partner', label: 'A partner (personal)' }]} />
      </div>
      {p.payerType === 'Company' ? (
        <Field label="Paid from" required>
          <select value={p.paidBy} onChange={(e) => set({ paidBy: e.target.value })} className="input-field">
            {!p.paidBy && <option value="">Select…</option>}
            {lookupOptions(paidByOptions, p.paidBy).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      ) : (
        <Field label="Partner who paid" required hint={activePartners.length ? null : 'Add partners in Company → Partners first.'}>
          <select value={p.paidByPartnerId} onChange={(e) => set({ paidByPartnerId: e.target.value })} className="input-field">
            <option value="">Select…</option>
            {lookupOptions(partners.filter((x) => x.isActive || String(x.id) === p.paidByPartnerId).map((x) => ({ value: String(x.id), label: x.name })), p.paidByPartnerId)
              .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      )}

      <div>
        <span className="mb-1 block text-[12px] font-bold text-[color:var(--text-secondary)]">Split the cost</span>
        <div className="flex flex-wrap gap-1.5">
          {SPLIT_METHODS.map((m) => (
            <button key={m.value} type="button" onClick={() => set({ splitMethod: m.value })}
              className={cn('rounded-[6px] border px-2.5 py-1 text-[12px] font-bold transition-colors',
                p.splitMethod === m.value ? 'border-[color:var(--primary)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]'
                  : 'border-[color:var(--border)] bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]')}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {p.splitMethod === 'Custom' && (
        <div className="space-y-2">
          <Segmented size="sm" value={p.customMode} onChange={(v) => set({ customMode: v })} options={[{ value: 'Amount', label: '₹ amounts' }, { value: 'Percent', label: '% percents' }]} />
          {customKeys.map((k) => (
            <div key={k || 'company'} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px]">{names[k]}</span>
              <input type="number" min="0" step="0.01" className="input-field !h-8 !w-32 text-right"
                value={p.customMode === 'Amount' ? (p.custom?.[k]?.amount ?? '') : (p.custom?.[k]?.percent ?? '')}
                onChange={(e) => setCustom(k, p.customMode === 'Amount' ? 'amount' : 'percent', e.target.value)}
                placeholder={p.customMode === 'Amount' ? '₹ 0' : '0 %'} />
            </div>
          ))}
        </div>
      )}

      {Number(amount) > 0 && preview.rows.length > 0 && (
        <div className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface)] p-2">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-muted)]">Split preview</div>
          <div className="flex flex-wrap gap-1.5">
            {preview.rows.map((r) => (
              <Badge key={String(r.id)} tone={r.id == null || r.id === '' ? 'neutral' : 'primary'}>
                {r.name}: {fmtAmt(r.amount)} <span className="font-normal opacity-75">({Number(r.pct).toFixed(1)}%)</span>
              </Badge>
            ))}
          </div>
          {Math.abs(preview.diff) >= 0.01 && p.splitMethod === 'Custom' && (
            <p className="mt-1 text-[12px] text-[color:var(--danger)]">
              {p.customMode === 'Amount' ? `Split total ${fmtAmt(preview.sum)} doesn't match the amount (${preview.diff > 0 ? 'short' : 'over'} by ${fmtAmt(Math.abs(preview.diff))}).` : 'Percents must add up to 100%.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Attachment row: view / replace / remove an uploaded file (kind = expense | asset | licence). */
export function AttachmentField({ kind, id, hasFile, pending, onPending, onChanged, label = 'Bill / document' }) {
  const [busy, setBusy] = useState(false);
  const pick = async (file) => {
    const bad = checkFile(file);
    if (bad) { toast.error(bad); return; }
    if (!id) { onPending?.(file); return; }          // record not saved yet → upload after save
    setBusy(true);
    try { await uploadFile(kind, id, file); toast.success('File attached'); onChanged?.(true); }
    catch (err) { toast.error(errMsg(err, 'Upload failed')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Remove the attached file?')) return;
    try { await api.delete(`/admin/company/files/${kind}/${id}`); onChanged?.(false); toast.success('File removed'); }
    catch (err) { toast.error(errMsg(err, 'Could not remove the file')); }
  };
  return (
    <Field label={label} hint="PDF, JPG, PNG or WEBP · max 10 MB">
      <div className="flex flex-wrap items-center gap-2">
        {hasFile && id && (
          <>
            <Button size="sm" variant="secondary" onClick={() => openFile(kind, id)}><Paperclip className="size-3.5" /> View file</Button>
            <IconButton label="Remove file" tone="danger" onClick={remove}><Trash2 className="size-3.5" /></IconButton>
          </>
        )}
        {pending && <span className="truncate text-[12px] text-[color:var(--text-secondary)]">{pending.name} (uploads on save)</span>}
        <label className={cn('inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-3 text-[13px] font-bold hover:bg-[color:var(--surface-hover)]', busy && 'pointer-events-none opacity-50')}>
          <Upload className="size-3.5" /> {hasFile || pending ? 'Replace' : 'Upload'}
          <input type="file" accept={ALLOWED_FILE} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f); }} />
        </label>
      </div>
    </Field>
  );
}

/** Compact "A ₹600 · B ₹400" chips for a split. */
export function SplitChips({ splits }) {
  if (!splits?.length) return <span className="text-[color:var(--text-muted)]">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {splits.map((s) => (
        <span key={String(s.partnerId)} className="whitespace-nowrap rounded-[4px] bg-[color:var(--surface-hover)] px-1.5 text-[11px] leading-[18px] text-[color:var(--text-secondary)]">
          {s.partnerName}: <b className="text-[color:var(--text-primary)]">{fmtAmt(s.amount)}</b>
        </span>
      ))}
    </div>
  );
}

/** Date range inputs. */
export function DateRange({ from, to, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} className="input-field !h-9 !w-[150px]" aria-label="From date" />
      <span className="text-[12px] text-[color:var(--text-muted)]">to</span>
      <input type="date" value={to} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} className="input-field !h-9 !w-[150px]" aria-label="To date" />
    </div>
  );
}
