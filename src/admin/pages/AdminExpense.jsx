import { useState, useEffect } from 'react';
import {
  Plus, X, Download, Edit2, Trash2, Check, Pencil, Receipt, Wallet, Clock, ClipboardList, CheckCircle2, PiggyBank, Tag,
} from 'lucide-react';
import { SkPageHeader, SkTabs } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import AdminModal from '@/admin/components/AdminModal';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchExpenses, createExpense, updateExpense, deleteExpense, approveExpense,
  fetchExpenseBudgets, saveExpenseBudget,
  fetchExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
  exportExpenses,
} from '@/store/slices/adminSlice';
import { useLookups, lookupOptions, MONTH_SHORT } from '@/admin/lookups';
import {
  PageHeader, Stat, Card, Badge, Tabs, Toolbar, SearchInput, Button, IconButton, EmptyState, Skeleton,
  DialogPanel, Field, usePagination, Pagination,
} from '@/admin/ui';
import { canAccess } from '@/admin/components/AdminLayout';
import CompanyExpenseDialog from '@/admin/components/company/CompanyExpenseDialog';
import { apiGet } from '@/admin/components/company/companyUtils';

// Color key → Tailwind classes
const COLOR_MAP = {
  blue:   'bg-blue-50 text-blue-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  purple: 'bg-purple-50 text-purple-700',
  green:  'bg-green-50 text-green-700',
  orange: 'bg-orange-50 text-orange-700',
  pink:   'bg-pink-50 text-pink-700',
  red:    'bg-red-50 text-red-600',
  gray:   'bg-gray-100 text-gray-600',
  indigo: 'bg-indigo-50 text-indigo-700',
  teal:   'bg-teal-50 text-teal-700',
};
const COLOR_OPTIONS = Object.keys(COLOR_MAP);
const COLOR_DOT = {
  blue: 'bg-blue-500', yellow: 'bg-yellow-500', purple: 'bg-purple-500', green: 'bg-green-500',
  orange: 'bg-orange-500', pink: 'bg-pink-500', red: 'bg-red-500', gray: 'bg-gray-400',
  indigo: 'bg-indigo-500', teal: 'bg-teal-500',
};

// "PettyCash" is a system value of the ExpensePaidBy master list (the petty-cash register filters on it)
const PETTY_CASH = 'PettyCash';
const MONTHS = MONTH_SHORT;

const EMPTY_FORM = { date: '', category: '', description: '', amount: '', paidBy: '', notes: '' };
const EMPTY_CAT  = { name: '', color: 'blue' };

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtAmt  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function AdminExpense() {
  const dispatch = useAppDispatch();
  const { items: expenses, summary, budgets, categories, total } = useAppSelector((s) => s.admin.expenses);
  const loading  = useAppSelector((s) => s.admin.loading);
  const lk = useLookups();
  const paidByOptions = lk.list('ExpensePaidBy');
  const paidByLabel = (v) => lk.label('ExpensePaidBy', v);
  const paidByText = (exp) => (exp.payerType === 'Partner' ? `${exp.paidByName || 'Partner'} (personal)` : paidByLabel(exp.paidBy));
  const [exporting, setExporting] = useState(false);
  // Company module: who paid (partner / company) + split between partners
  const canCompany = canAccess(useAppSelector((s) => s.admin.admin), 'Company');
  const [partners, setPartners] = useState([]);
  const [coDialog, setCoDialog] = useState(null);
  useEffect(() => {
    if (canCompany) apiGet('/admin/company/partners').then((d) => setPartners(d.partners || [])).catch(() => {});
  }, [canCompany]);

  const now = new Date();
  const [tab, setTab]       = useState('list');
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year, setYear]     = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [modal, setModal]   = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [budgetEdit, setBudgetEdit] = useState({});

  // Category management state
  const [catModal, setCatModal]   = useState(false);
  const [editCat, setEditCat]     = useState(null);
  const [catForm, setCatForm]     = useState(EMPTY_CAT);
  const [savingCat, setSavingCat] = useState(false);

  const f  = (v) => setForm((p) => ({ ...p, ...v }));
  const cf = (v) => setCatForm((p) => ({ ...p, ...v }));

  useEffect(() => {
    dispatch(fetchExpenses({ month, year, limit: 2000 }));
    dispatch(fetchExpenseBudgets());
    dispatch(fetchExpenseCategories());
  }, [dispatch, month, year]);

  // Set default category once categories load
  const firstActiveCat = categories.find(c => c.isActive)?.name || '';
  useEffect(() => {
    if (firstActiveCat && !form.category) {
      setForm((p) => ({ ...p, category: firstActiveCat }));
    }
  }, [firstActiveCat, form.category]);

  const catColor = (name) => {
    const cat = categories.find(c => c.name === name);
    return COLOR_MAP[cat?.color] || 'bg-gray-100 text-gray-600';
  };

  const openAdd = () => {
    if (canCompany) { setCoDialog({ expense: null }); return; }
    setEditItem(null);
    setForm({ ...EMPTY_FORM, category: firstActiveCat, paidBy: paidByOptions[0]?.value || '', date: new Date().toLocaleDateString('en-CA') });
    setModal(true);
  };
  const openEdit = (exp) => {
    if (canCompany) { setCoDialog({ expense: exp }); return; }
    setEditItem(exp);
    setForm({ date: exp.date ? exp.date.substring(0, 10) : '', category: exp.category, description: exp.description, amount: String(exp.amount), paidBy: exp.paidBy, notes: exp.notes || '' });
    setModal(true);
  };

  const save = async () => {
    if (!form.description || !form.amount || !form.date) { toast.error('Date, description and amount required'); return; }
    if (!form.category) { toast.error('Select a category (add one in the Categories tab)'); return; }
    if (!form.paidBy) { toast.error('Select how it was paid'); return; }
    setSaving(true);
    try {
      const payload = { date: form.date, category: form.category, description: form.description, amount: Number(form.amount), paidBy: form.paidBy, notes: form.notes || null };
      if (editItem) {
        await dispatch(updateExpense({ id: editItem.id, ...payload })).unwrap();
        toast.success('Expense updated!', { style: { borderRadius: '12px' } });
      } else {
        await dispatch(createExpense(payload)).unwrap();
        toast.success('Expense recorded!', { style: { borderRadius: '12px' } });
      }
      setModal(false);
      dispatch(fetchExpenses({ month, year, limit: 2000 }));
    } catch (err) {
      toast.error(err || 'Failed to save expense', { style: { borderRadius: '12px' } });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await dispatch(deleteExpense(id)).unwrap();
      toast.success('Expense deleted', { style: { borderRadius: '12px' } });
      dispatch(fetchExpenses({ month, year, limit: 2000 }));
    } catch (err) { toast.error(err || 'Failed to delete', { style: { borderRadius: '12px' } }); }
  };

  const handleApprove = async (id) => {
    try {
      await dispatch(approveExpense(id)).unwrap();
      toast.success('Expense approved!', { icon: '✅', style: { borderRadius: '12px' } });
      dispatch(fetchExpenses({ month, year, limit: 2000 }));
    } catch (err) { toast.error(err || 'Failed to approve', { style: { borderRadius: '12px' } }); }
  };

  const handleSaveBudget = async (category) => {
    const val = budgetEdit[category];
    if (!val || isNaN(Number(val))) { toast.error('Enter a valid amount'); return; }
    try {
      await dispatch(saveExpenseBudget({ category, monthlyLimit: Number(val) })).unwrap();
      toast.success('Budget saved!', { style: { borderRadius: '12px' } });
      setBudgetEdit((p) => { const n = { ...p }; delete n[category]; return n; });
      dispatch(fetchExpenseBudgets());
    } catch (err) { toast.error(err || 'Failed to save budget', { style: { borderRadius: '12px' } }); }
  };

  const openAddCat  = () => { setEditCat(null); setCatForm(EMPTY_CAT); setCatModal(true); };
  const openEditCat = (cat) => { setEditCat(cat); setCatForm({ name: cat.name, color: cat.color }); setCatModal(true); };

  const saveCat = async () => {
    if (!catForm.name.trim()) { toast.error('Category name is required'); return; }
    setSavingCat(true);
    try {
      if (editCat) {
        await dispatch(updateExpenseCategory({ id: editCat.id, name: catForm.name.trim(), color: catForm.color })).unwrap();
        toast.success('Category updated!', { style: { borderRadius: '12px' } });
      } else {
        await dispatch(createExpenseCategory({ name: catForm.name.trim(), color: catForm.color })).unwrap();
        toast.success('Category added!', { style: { borderRadius: '12px' } });
      }
      setCatModal(false);
      if (editCat && editCat.name !== catForm.name.trim()) { dispatch(fetchExpenses({ month, year, limit: 2000 })); dispatch(fetchExpenseBudgets()); }
    } catch (err) {
      toast.error(err || 'Failed to save category', { style: { borderRadius: '12px' } });
    } finally { setSavingCat(false); }
  };

  const handleDeleteCat = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    try {
      await dispatch(deleteExpenseCategory(id)).unwrap();
      toast.success('Category deleted', { style: { borderRadius: '12px' } });
    } catch (err) { toast.error(err || 'Failed to delete', { style: { borderRadius: '12px' } }); }
  };

  const filtered = expenses.filter(e => {
    const matchSearch = !search || (e.description || '').toLowerCase().includes(search.toLowerCase());
    const matchCat    = !catFilter || e.category === catFilter;
    return matchSearch && matchCat;
  });

  const pettyCash      = expenses.filter(e => e.paidBy === PETTY_CASH);
  const vouchers       = expenses.filter(e => !e.isApproved);
  const totalSpent     = summary.reduce((s, e) => s + (Number(e.total) || 0), 0);
  const pettyCashTotal = pettyCash.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const handleExport = async () => {
    setExporting(true);
    try {
      await dispatch(exportExpenses({ month, year, category: catFilter || undefined, search: search || undefined, format: 'xlsx' })).unwrap();
      toast.success('Expense report downloaded');
    } catch (err) { toast.error(err || 'Export failed'); }
    finally { setExporting(false); }
  };

  const listPg    = usePagination(filtered, 20);
  const pettyPg   = usePagination(pettyCash, 20);
  const voucherPg = usePagination(vouchers, 20);
  const catPg     = usePagination(categories, 20);

  if (loading && expenses.length === 0) return <div className="space-y-6"><SkPageHeader /><SkTabs tabCount={5} contentRows={6} /></div>;

  const catChip = (name) => (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-bold ${catColor(name)}`}>{name}</span>
  );
  const approvedBadge = (exp) => (
    <Badge tone={exp.isApproved ? 'success' : 'warning'}>{exp.isApproved ? 'Approved' : 'Pending'}</Badge>
  );
  const skeletonRows = (cols) => Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => <td key={j}><Skeleton className="h-3 w-3/4" /></td>)}
    </tr>
  ));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Company Expense Management"
        description="Petty cash, categories, budget vs actual, vouchers"
        actions={<>
          <Button variant="secondary" onClick={handleExport} loading={exporting} title="Download the month's expenses (current category / search filter) as Excel">
            <Download className="size-4" /> Export
          </Button>
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add Expense
          </Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Total (${MONTHS[month - 1]} ${year})`} value={fmtAmt(totalSpent)} icon={Receipt} tone="danger" />
        <Stat label="Petty Cash Used" value={fmtAmt(pettyCashTotal)} icon={Wallet} tone="accent" />
        <Stat label="Pending Approval" value={vouchers.length} icon={Clock} tone="warning" />
        <Stat label="Total Entries" value={total} icon={ClipboardList} tone="info" />
      </div>

      <Tabs
        items={[
          { value: 'list',       label: 'Expense List' },
          { value: 'petty',      label: 'Petty Cash' },
          { value: 'budget',     label: 'Budget vs Actual' },
          { value: 'vouchers',   label: 'Vouchers', count: vouchers.length > 0 ? vouchers.length : undefined },
          { value: 'categories', label: 'Categories' },
        ]}
        value={tab}
        onChange={setTab}
        trailing={
          <div className="flex items-center gap-2 py-1">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input-field !h-8 !w-24">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field !h-8 !w-24">
              {lookupOptions(lk.years.map(y => ({ value: y, label: String(y) })), year).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        }
      />

      {/* ── Tab: Expense List ─────────────────────────────────────────────── */}
      {tab === 'list' && (
        <Card>
          <div className="space-y-3 p-3">
            <Toolbar>
              <SearchInput value={search} onChange={setSearch} placeholder="Search expenses…" className="max-w-sm" />
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input-field !h-9 !w-44">
                <option value="">All Categories</option>
                {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Toolbar>

            {!loading && filtered.length === 0 ? (
              <EmptyState icon={Receipt} title="No expenses found">
                {expenses.length ? 'Try another category or clear the search.' : `No expenses recorded for ${MONTHS[month - 1]} ${year}.`}
              </EmptyState>
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Date</th>
                        <th className="text-left">Category</th>
                        <th className="text-left">Description</th>
                        <th className="text-right">Amount</th>
                        <th className="text-left">Paid By</th>
                        <th className="text-left">Status</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && expenses.length === 0 ? skeletonRows(7) : listPg.items.map(exp => (
                        <tr key={exp.id}>
                          <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(exp.date)}</td>
                          <td>{catChip(exp.category)}</td>
                          <td className="max-w-48 truncate">{exp.description}</td>
                          <td className="whitespace-nowrap text-right font-bold">{fmtAmt(exp.amount)}</td>
                          <td className="text-[color:var(--text-muted)]">{paidByText(exp)}{exp.splitMethod && exp.splitMethod !== 'None' && <Badge tone="primary" className="ml-1">Split</Badge>}</td>
                          <td>{approvedBadge(exp)}</td>
                          <td>
                            <div className="flex items-center justify-center gap-1">
                              {!exp.isApproved && (
                                <IconButton label="Approve" tone="primary" onClick={() => handleApprove(exp.id)}><Check className="size-3.5" /></IconButton>
                              )}
                              <IconButton label="Edit" onClick={() => openEdit(exp)}><Edit2 className="size-3.5" /></IconButton>
                              <IconButton label="Delete" tone="danger" onClick={() => handleDelete(exp.id)}><Trash2 className="size-3.5" /></IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...listPg} noun="expenses" />
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── Tab: Petty Cash ───────────────────────────────────────────────── */}
      {tab === 'petty' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Stat label="Total Petty Cash Used" value={fmtAmt(pettyCashTotal)} icon={Wallet} tone="accent" />
            <Stat label="Transactions" value={pettyCash.length} icon={ClipboardList} />
            <Stat label="Approved Entries" value={pettyCash.filter(e => e.isApproved).length} icon={CheckCircle2} tone="success" />
          </div>
          <Card title={`Petty Cash Register — ${MONTHS[month - 1]} ${year}`} bodyClassName="p-3">
            {pettyCash.length === 0 ? (
              <EmptyState icon={Wallet} title="No petty cash entries for this period" />
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Date</th>
                        <th className="text-left">Category</th>
                        <th className="text-left">Description</th>
                        <th className="text-right">Amount</th>
                        <th className="text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pettyPg.items.map(exp => (
                        <tr key={exp.id}>
                          <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(exp.date)}</td>
                          <td>{catChip(exp.category)}</td>
                          <td>{exp.description}</td>
                          <td className="whitespace-nowrap text-right font-bold">{fmtAmt(exp.amount)}</td>
                          <td>{approvedBadge(exp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...pettyPg} noun="entries" />
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Tab: Budget vs Actual ─────────────────────────────────────────── */}
      {tab === 'budget' && (
        <Card
          title={`Budget vs Actual — ${MONTHS[month - 1]} ${year}`}
          actions={<span className="flex items-center gap-1 text-[12px] text-[color:var(--text-muted)]">Click <Pencil className="size-3" /> to set budget limits</span>}
          bodyClassName="p-4"
        >
          <div className="space-y-4">
            {categories.filter(c => c.isActive).map(cat => {
              const summaryEntry = summary.find(s => s.category === cat.name);
              const spent  = summaryEntry ? Number(summaryEntry.total) : 0;
              const budgetEntry = budgets.find(b => b.category === cat.name);
              const limit  = budgetEntry ? Number(budgetEntry.monthlyLimit) : 0;
              const pct    = limit > 0 ? Math.min((spent / limit) * 100, 100) : (spent > 0 ? 100 : 0);
              const over   = limit > 0 && spent > limit;
              const editing = budgetEdit[cat.name] !== undefined;
              if (spent === 0 && limit === 0) return null;
              return (
                <div key={cat.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${COLOR_MAP[cat.color] || 'bg-gray-100 text-gray-600'}`}>{cat.name}</span>
                      {over && <Badge tone="danger">Over Budget!</Badge>}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className={`text-[13px] font-bold tabular-nums ${over ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-primary)]'}`}>{fmtAmt(spent)}</span>
                      {limit > 0 && <span className="text-[12px] text-[color:var(--text-muted)]">/ {fmtAmt(limit)}</span>}
                      {editing ? (
                        <div className="flex items-center gap-1">
                          <input type="number" value={budgetEdit[cat.name]}
                            onChange={e => setBudgetEdit(p => ({ ...p, [cat.name]: e.target.value }))}
                            className="input-field !h-7 !w-28 !px-2 !text-[12px]" placeholder="Monthly limit" />
                          <Button size="sm" className="!h-7 !px-2 !text-[12px]" onClick={() => handleSaveBudget(cat.name)}>Save</Button>
                          <IconButton label="Cancel" onClick={() => setBudgetEdit(p => { const n = { ...p }; delete n[cat.name]; return n; })}>
                            <X className="size-3.5" />
                          </IconButton>
                        </div>
                      ) : (
                        <IconButton label="Set budget" tone="primary" onClick={() => setBudgetEdit(p => ({ ...p, [cat.name]: limit > 0 ? String(limit) : '' }))}>
                          <Pencil className="size-3.5" />
                        </IconButton>
                      )}
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
                    <div
                      className={`h-full rounded-full transition-all ${over ? 'bg-[color:var(--danger)]' : pct > 80 ? 'bg-[color:var(--warning)]' : 'bg-[color:var(--primary)]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {limit > 0 && (
                    <div className="mt-0.5 flex justify-between text-[12px]">
                      <span className="text-[color:var(--text-muted)]">{Math.round(pct)}% used</span>
                      <span className={over ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-muted)]'}>
                        {over ? `Over by ${fmtAmt(spent - limit)}` : `${fmtAmt(limit - spent)} remaining`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {categories.filter(c => c.isActive).length === 0 && (
              <EmptyState icon={PiggyBank} title="No categories yet">Add from the Categories tab.</EmptyState>
            )}
          </div>
        </Card>
      )}

      {/* ── Tab: Vouchers ─────────────────────────────────────────────────── */}
      {tab === 'vouchers' && (
        <Card
          title="Pending Vouchers"
          actions={<span className="text-[12px] text-[color:var(--text-muted)]">{vouchers.length} awaiting approval</span>}
          bodyClassName="p-3"
        >
          {vouchers.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All expenses approved">No pending vouchers for this period</EmptyState>
          ) : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Date</th>
                      <th className="text-left">Category</th>
                      <th className="text-left">Description</th>
                      <th className="text-left">Paid By</th>
                      <th className="text-right">Amount</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voucherPg.items.map(exp => (
                      <tr key={exp.id}>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(exp.date)}</td>
                        <td>{catChip(exp.category)}</td>
                        <td className="max-w-64 truncate">{exp.description}</td>
                        <td className="text-[color:var(--text-muted)]">{paidByText(exp)}{exp.splitMethod && exp.splitMethod !== 'None' && <Badge tone="primary" className="ml-1">Split</Badge>}</td>
                        <td className="whitespace-nowrap text-right font-bold">{fmtAmt(exp.amount)}</td>
                        <td className="text-center">
                          <Button size="sm" className="!h-7 !px-2 !text-[12px]" onClick={() => handleApprove(exp.id)}>
                            <Check className="size-3" /> Approve
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...voucherPg} noun="vouchers" />
            </>
          )}
        </Card>
      )}

      {/* ── Tab: Categories ───────────────────────────────────────────────── */}
      {tab === 'categories' && (
        <Card
          title="Expense Categories"
          actions={<Button size="sm" onClick={openAddCat}><Plus className="size-3.5" /> Add Category</Button>}
          bodyClassName="p-3"
        >
          {!loading && categories.length === 0 ? (
            <EmptyState icon={Tag} title="No categories yet" />
          ) : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Category Name</th>
                      <th className="text-left">Color</th>
                      <th className="text-left">Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && categories.length === 0 ? skeletonRows(4) : catPg.items.map(cat => (
                      <tr key={cat.id}>
                        <td>
                          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${COLOR_MAP[cat.color] || 'bg-gray-100 text-gray-600'}`}>{cat.name}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className={`size-3 rounded-full ${COLOR_DOT[cat.color] || 'bg-gray-400'}`} />
                            <span className="capitalize text-[color:var(--text-secondary)]">{cat.color}</span>
                          </div>
                        </td>
                        <td><Badge tone={cat.isActive ? 'success' : 'neutral'}>{cat.isActive ? 'Active' : 'Inactive'}</Badge></td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <IconButton label="Edit" onClick={() => openEditCat(cat)}><Edit2 className="size-3.5" /></IconButton>
                            <IconButton label="Delete" tone="danger" onClick={() => handleDeleteCat(cat.id, cat.name)}><Trash2 className="size-3.5" /></IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...catPg} noun="categories" />
            </>
          )}
        </Card>
      )}

      {/* ── Add/Edit Expense Modal ────────────────────────────────────────── */}
      {modal && (
        <AdminModal onClose={() => setModal(false)}>
          <DialogPanel
            title={editItem ? 'Edit Expense' : 'Add Expense'}
            onClose={() => setModal(false)}
            width="max-w-md"
            footer={<>
              <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
              <Button onClick={save} loading={saving}>
                {saving ? 'Saving…' : editItem ? 'Update' : 'Save Expense'}
              </Button>
            </>}
          >
            <div className="space-y-3">
              <Field label="Date" required>
                <input type="date" value={form.date} onChange={e => f({ date: e.target.value })} className="input-field" />
              </Field>
              <Field label="Category">
                <select value={form.category} onChange={e => f({ category: e.target.value })} className="input-field">
                  {!form.category && <option value="">Select…</option>}
                  {lookupOptions(categories.filter(c => c.isActive).map(c => ({ value: c.name, label: c.name })), form.category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Description" required>
                <input value={form.description} onChange={e => f({ description: e.target.value })} className="input-field" placeholder="Expense description" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (₹)" required>
                  <input type="number" value={form.amount} onChange={e => f({ amount: e.target.value })} className="input-field" />
                </Field>
                <Field label="Paid By">
                  <select value={form.paidBy} onChange={e => f({ paidBy: e.target.value })} className="input-field">
                    {!form.paidBy && <option value="">Select…</option>}
                    {lookupOptions(paidByOptions, form.paidBy).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Notes">
                <input value={form.notes} onChange={e => f({ notes: e.target.value })} className="input-field" placeholder="Optional notes" />
              </Field>
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {/* ── Company: expense with who-paid + partner split ─────────────────── */}
      {coDialog && (
        <CompanyExpenseDialog expense={coDialog.expense} partners={partners}
          categories={categories.filter((c) => c.isActive).map((c) => c.name)}
          onClose={() => setCoDialog(null)}
          onSaved={() => { setCoDialog(null); dispatch(fetchExpenses({ month, year, limit: 2000 })); }} />
      )}

      {/* ── Add/Edit Category Modal ───────────────────────────────────────── */}
      {catModal && (
        <AdminModal onClose={() => setCatModal(false)}>
          <DialogPanel
            title={editCat ? 'Edit Category' : 'Add Category'}
            onClose={() => setCatModal(false)}
            width="max-w-sm"
            footer={<>
              <Button variant="secondary" onClick={() => setCatModal(false)}>Cancel</Button>
              <Button onClick={saveCat} loading={savingCat}>
                {savingCat ? 'Saving…' : editCat ? 'Update' : 'Add Category'}
              </Button>
            </>}
          >
            <div className="space-y-3">
              <Field label="Category Name" required>
                <input value={catForm.name} onChange={e => cf({ name: e.target.value })} className="input-field" placeholder="e.g. Office Supplies" />
              </Field>
              <div>
                <span className="mb-1 block text-[12px] font-bold text-[color:var(--text-secondary)]">Color</span>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c} type="button" onClick={() => cf({ color: c })}
                      className={`flex items-center gap-1.5 rounded-[6px] border-2 px-2.5 py-1 text-[12px] font-bold transition-all ${catForm.color === c ? 'border-[color:var(--primary)]' : 'border-transparent'} ${COLOR_MAP[c]}`}>
                      <div className={`size-2 rounded-full ${COLOR_DOT[c]}`} />
                      {c}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-2.5">
                  <span className="text-[12px] text-[color:var(--text-muted)]">Preview:</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${COLOR_MAP[catForm.color]}`}>{catForm.name || 'Category Name'}</span>
                </div>
              </div>
            </div>
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}
