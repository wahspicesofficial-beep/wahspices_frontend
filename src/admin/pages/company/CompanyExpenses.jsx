import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Edit2, Paperclip, Plus, Receipt, Trash2, UserRound, Building2 } from 'lucide-react';
import api from '@/services/api';
import {
  Badge, Button, Card, EmptyState, IconButton, PageHeader, Pagination, SearchInput, Skeleton, Stat, Toolbar, usePagination,
} from '@/admin/ui';
import { useLookups } from '@/admin/lookups';
import CompanyExpenseDialog from '@/admin/components/company/CompanyExpenseDialog';
import { DateRange, SplitChips } from '@/admin/components/company/shared';
import {
  apiGet, downloadFile, errMsg, fmtAmt, fmtDate, monthStart, openFile, splitLabel, today, usePartners,
} from '@/admin/components/company/companyUtils';

export default function CompanyExpenses() {
  const lk = useLookups();
  const { partners, reload: reloadPartners } = usePartners();
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [filters, setFilters] = useState({ partnerId: '', payer: '', category: '' });
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [dialog, setDialog] = useState(null);   // { expense } | {}
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiGet('/admin/company/expenses', {
        from: range.from || undefined, to: range.to || undefined,
        partnerId: filters.partnerId || undefined, payer: filters.payer || undefined, category: filters.category || undefined,
      }));
    } catch (err) { toast.error(errMsg(err, 'Could not load expenses')); setData({ expenses: [], totals: {} }); }
  }, [range, filters]);
  useEffect(() => { load(); }, [load]);

  // Category suggestions: the Expenses module's list when readable, plus anything already used
  useEffect(() => {
    apiGet('/admin/expenses/categories').then((d) => setCategories((d.categories || []).filter((c) => c.isActive).map((c) => c.name))).catch(() => {});
  }, []);
  const allCategories = useMemo(
    () => [...new Set([...categories, ...(data?.expenses || []).map((e) => e.category), 'Assets & Equipment', 'Licences & Registrations'])].sort(),
    [categories, data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.expenses || []).filter((e) => !q || `${e.description} ${e.notes || ''} ${e.paidByName}`.toLowerCase().includes(q));
  }, [data, search]);
  const pg = usePagination(rows, 20);

  const remove = async (e) => {
    const linked = e.sourceType ? ` It stays on the ${e.sourceType.toLowerCase()} record but won't be linked any more.` : '';
    if (!window.confirm(`Delete "${e.description}"?${linked}`)) return;
    try { await api.delete(`/admin/company/expenses/${e.id}`); toast.success('Expense deleted'); load(); }
    catch (err) { toast.error(errMsg(err, 'Could not delete')); }
  };

  const exportXlsx = async () => {
    setExporting(true);
    await downloadFile('/admin/company/reports/export', 'Company_finance.xlsx', { from: range.from || undefined, to: range.to || undefined });
    setExporting(false);
  };

  const t = data?.totals || {};
  const modeLabel = (e) => (e.payerType === 'Partner' ? 'Personal money' : lk.label('ExpensePaidBy', e.paidBy));

  return (
    <div className="space-y-4">
      <PageHeader title="Expenses & split" description="Every expense with who paid it and how it is shared between partners"
        actions={<>
          <Button variant="secondary" onClick={exportXlsx} loading={exporting}><Download className="size-4" /> Export Excel</Button>
          <Button onClick={() => { reloadPartners(); setDialog({}); }}><Plus className="size-4" /> Add expense</Button>
        </>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total in range" value={fmtAmt(t.amount)} icon={Receipt} tone="danger" loading={!data} />
        <Stat label="Paid by partners" value={fmtAmt(t.partnerPaid)} icon={UserRound} tone="accent" loading={!data} />
        <Stat label="Paid by company" value={fmtAmt(t.companyPaid)} icon={Building2} tone="info" loading={!data} />
        <Stat label="Entries" value={t.count ?? 0} loading={!data} />
      </div>

      <Card bodyClassName="space-y-3 p-3">
        <Toolbar>
          <DateRange from={range.from} to={range.to} onChange={setRange} />
          <select value={filters.partnerId} onChange={(e) => setFilters((p) => ({ ...p, partnerId: e.target.value }))} className="input-field !h-9 !w-44" aria-label="Partner">
            <option value="">All partners</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filters.payer} onChange={(e) => setFilters((p) => ({ ...p, payer: e.target.value }))} className="input-field !h-9 !w-40" aria-label="Paid by">
            <option value="">Anyone paid</option>
            <option value="Partner">A partner paid</option>
            <option value="Company">Company paid</option>
          </select>
          <select value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))} className="input-field !h-9 !w-48" aria-label="Category">
            <option value="">All categories</option>
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <SearchInput value={search} onChange={setSearch} placeholder="Search description…" className="max-w-xs" />
        </Toolbar>

        {!data ? <Skeleton className="h-40 w-full" /> : rows.length === 0 ? (
          <EmptyState icon={Receipt} title="No expenses in this range" action={<Button size="sm" onClick={() => setDialog({})}><Plus className="size-3.5" /> Add expense</Button>} />
        ) : (
          <>
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Date</th>
                    <th className="text-left">Description</th>
                    <th className="text-right">Amount</th>
                    <th className="text-left">Paid by</th>
                    <th className="text-left">Split</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.items.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(e.date)}</td>
                      <td className="max-w-72">
                        <div className="truncate font-bold">{e.description}</div>
                        <div className="flex flex-wrap items-center gap-1 text-[12px] text-[color:var(--text-muted)]">
                          {e.category}
                          {e.sourceType && <Badge tone="info">{e.sourceType === 'Asset' ? 'Asset' : 'Licence'}</Badge>}
                          {!e.isApproved && <Badge tone="warning">Pending approval</Badge>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-right font-bold tabular-nums">{fmtAmt(e.amount)}</td>
                      <td className="whitespace-nowrap">
                        <div className="font-bold">{e.paidByName}</div>
                        <div className="text-[12px] text-[color:var(--text-muted)]">{modeLabel(e)}</div>
                      </td>
                      <td className="max-w-72">
                        <div className="mb-0.5 text-[11px] text-[color:var(--text-muted)]">{splitLabel(e.splits?.length ? e.splitMethod : 'None')}</div>
                        <SplitChips splits={e.splits} />
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          {e.hasReceipt && <IconButton label="View receipt" onClick={() => openFile('expense', e.id)}><Paperclip className="size-3.5" /></IconButton>}
                          <IconButton label="Edit" onClick={() => { reloadPartners(); setDialog({ expense: e }); }}><Edit2 className="size-3.5" /></IconButton>
                          <IconButton label="Delete" tone="danger" onClick={() => remove(e)}><Trash2 className="size-3.5" /></IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} noun="expenses" />
          </>
        )}
      </Card>

      {dialog && (
        <CompanyExpenseDialog expense={dialog.expense || null} partners={partners} categories={allCategories}
          onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />
      )}
    </div>
  );
}
