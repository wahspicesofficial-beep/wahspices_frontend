import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Lock, ChevronUp, ChevronDown, Check, X, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { Card, Badge, Button, IconButton, EmptyState } from '@/admin/ui';
import { reloadLookups } from '@/admin/lookups';

// Friendly names + where each list is used
const TYPE_INFO = {
  InventoryLocation: ['Inventory locations', 'Inventory · stock transfers'],
  Unit: ['Units of measure', 'Inventory, purchase, production, billing'],
  RecipeCategory: ['Recipe categories', 'Recipes'],
  RecipeDifficulty: ['Recipe difficulty', 'Recipes'],
  BlogCategory: ['Blog categories', 'Blog'],
  CustomerCategory: ['Customer categories', 'Customers, CRM'],
  PaymentMode: ['Payment modes', 'Customer & vendor payments'],
  ExpensePaidBy: ['Expense paid-by', 'Expenses'],
  StaffDocumentType: ['Staff document types', 'Staff documents'],
  HolidayType: ['Holiday types', 'Leave · holidays'],
  GstSlab: ['GST slabs (%)', 'Billing, purchase, GST'],
  GstSupplyType: ['GST supply types', 'Billing, purchase'],
  BarcodeType: ['Barcode types', 'Barcode'],
  InvoiceType: ['Invoice types', 'Billing'],
  CampaignType: ['Campaign / broadcast types', 'Marketing · campaigns, broadcasts, notification bell'],
};

export default function MasterDataManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('InventoryLocation');
  const [draft, setDraft] = useState({ value: '', label: '' });
  const [editing, setEditing] = useState(null); // { id, value, label }
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/admin/master-data');
      setItems(res.data.data || []);
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Could not load master data');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const types = useMemo(() => [...new Set([...Object.keys(TYPE_INFO), ...items.map((i) => i.type)])], [items]);
  const rows = useMemo(() => items.filter((i) => i.type === type).sort((a, b) => a.sortOrder - b.sortOrder), [items, type]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      await load();
      reloadLookups();
      return true;
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!draft.value.trim()) { toast.error('Enter a value'); return; }
    const ok = await run(() => api.post('/admin/master-data', { type, value: draft.value.trim(), label: draft.label.trim() || null }), 'Added');
    if (ok) setDraft({ value: '', label: '' });
  };
  const save = (row) => run(() => api.put(`/admin/master-data/${row.id}`, {
    type, value: editing.value.trim(), label: editing.label.trim() || null, sortOrder: row.sortOrder, isActive: row.isActive,
  }), 'Saved').then((ok) => ok && setEditing(null));
  const toggle = (row) => run(() => api.put(`/admin/master-data/${row.id}`, {
    type, value: row.value, label: row.label, sortOrder: row.sortOrder, isActive: !row.isActive,
  }), row.isActive ? 'Hidden from dropdowns' : 'Shown in dropdowns');
  const remove = (row) => {
    if (!window.confirm(`Delete "${row.label}"? Records already using it keep their value.`)) return;
    run(() => api.delete(`/admin/master-data/${row.id}`), 'Deleted');
  };
  const move = (row, dir) => {
    const i = rows.findIndex((r) => r.id === row.id);
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const reordered = [...rows];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    run(() => Promise.all(reordered.map((r, k) => r.sortOrder === k ? null : api.put(`/admin/master-data/${r.id}`, {
      type, value: r.value, label: r.label, sortOrder: k, isActive: r.isActive,
    }))));
  };

  const [title, usedIn] = TYPE_INFO[type] || [type, ''];

  return (
    <Card title={<span className="inline-flex items-center gap-2"><Database className="size-4 text-[color:var(--primary)]" />Master data (dropdown lists)</span>}>
      <div className="grid min-h-[360px] grid-cols-1 md:grid-cols-[240px_1fr]">
        {/* List picker */}
        <nav className="border-b border-[color:var(--border)] p-2 md:border-b-0 md:border-r">
          {types.map((t) => {
            const count = items.filter((i) => i.type === t).length;
            return (
              <button key={t} type="button" onClick={() => { setType(t); setEditing(null); }}
                className={`flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-left text-[13px] ${t === type ? 'bg-[color:var(--selection)] font-bold' : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'}`}>
                <span className="truncate">{TYPE_INFO[t]?.[0] || t}</span>
                <span className="text-[11px] text-[color:var(--text-muted)]">{count}</span>
              </button>
            );
          })}
        </nav>

        {/* Values */}
        <div className="space-y-3 p-3">
          <div>
            <div className="text-[14px] font-bold">{title}</div>
            {usedIn && <div className="text-[12px] text-[color:var(--text-muted)]">Used in: {usedIn}</div>}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[160px] flex-1">
              <span className="mb-1 block text-[12px] font-bold text-[color:var(--text-secondary)]">Value</span>
              <input className="input-field" value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Stored value, e.g. Warehouse C" />
            </label>
            <label className="min-w-[160px] flex-1">
              <span className="mb-1 block text-[12px] font-bold text-[color:var(--text-secondary)]">Label (optional)</span>
              <input className="input-field" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Shown in dropdowns" />
            </label>
            <Button onClick={add} loading={busy}><Plus className="size-4" /> Add</Button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-[13px] text-[color:var(--text-muted)]">Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState title="No values yet">Add the first value above.</EmptyState>
          ) : (
            <div className="grid-box">
              <table>
                <thead>
                  <tr><th className="w-16 text-left">Order</th><th className="text-left">Value</th><th className="text-left">Label</th><th className="text-left">Status</th><th className="text-center">Actions</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const isEdit = editing?.id === r.id;
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="flex items-center gap-0.5">
                            <IconButton label="Move up" disabled={i === 0} onClick={() => move(r, -1)} className="disabled:opacity-30"><ChevronUp className="size-3.5" /></IconButton>
                            <IconButton label="Move down" disabled={i === rows.length - 1} onClick={() => move(r, 1)} className="disabled:opacity-30"><ChevronDown className="size-3.5" /></IconButton>
                          </div>
                        </td>
                        <td className="font-mono text-[12px]">
                          {isEdit && !r.isSystem
                            ? <input className="input-field !h-8" value={editing.value} onChange={(e) => setEditing((d) => ({ ...d, value: e.target.value }))} />
                            : <span className="inline-flex items-center gap-1">{r.value}{r.isSystem && <Lock className="size-3 text-[color:var(--text-muted)]" title="System value" />}</span>}
                        </td>
                        <td>
                          {isEdit
                            ? <input className="input-field !h-8" value={editing.label} onChange={(e) => setEditing((d) => ({ ...d, label: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && save(r)} />
                            : r.label}
                        </td>
                        <td><Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Shown' : 'Hidden'}</Badge></td>
                        <td>
                          <div className="flex items-center justify-center gap-0.5">
                            {isEdit ? (
                              <>
                                <IconButton label="Save" tone="primary" onClick={() => save(r)}><Check className="size-3.5" /></IconButton>
                                <IconButton label="Cancel" onClick={() => setEditing(null)}><X className="size-3.5" /></IconButton>
                              </>
                            ) : (
                              <>
                                <IconButton label="Edit" tone="primary" onClick={() => setEditing({ id: r.id, value: r.value, label: r.label })}><Pencil className="size-3.5" /></IconButton>
                                <IconButton label={r.isActive ? 'Hide' : 'Show'} onClick={() => toggle(r)}>{r.isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</IconButton>
                                {!r.isSystem && <IconButton label="Delete" tone="danger" onClick={() => remove(r)}><Trash2 className="size-3.5" /></IconButton>}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[12px] text-[color:var(--text-muted)]">
            <Lock className="mr-1 inline size-3" />System values are used by business logic — you can rename or hide them, but not delete them or change their stored value.
          </p>
        </div>
      </div>
    </Card>
  );
}
