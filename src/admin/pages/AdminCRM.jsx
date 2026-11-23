import { useState, useEffect, useMemo } from 'react';
import { Plus, Send, Edit2, Trash2, Users, Wallet, CreditCard, Star, UserRound, Clock, Mail } from 'lucide-react';
import { SkPageHeader, SkTabs } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchCrmCustomers,
  fetchCrmStats,
  fetchCrmAging,
  createCrmCustomer,
  updateCrmCustomer,
  deleteCrmCustomer,
  sendCrmReminder,
  sendCrmBulkReminders,
} from '@/store/slices/adminSlice';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, SearchInput, EmptyState, DialogPanel, Field, Pagination,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';

// Purely visual maps (bucket keys / categories come from the API)
const BUCKET_TONE = { '0-30': 'success', '31-60': 'warning', '61-90': 'accent', '90+': 'danger' };
const BUCKET_BAR  = {
  '0-30':  'bg-[color:var(--success)]',
  '31-60': 'bg-[color:var(--warning)]',
  '61-90': 'bg-[color:var(--accent)]',
  '90+':   'bg-[color:var(--danger)]',
};
const CAT_TONE = { Wholesale: 'info', Retail: 'success', Ecom: 'primary', Distributor: 'accent' };

const EMPTY_FORM = {
  name: '', contactName: '', phone: '', email: '',
  city: '', state: '', category: '',
  gstin: '', creditLimit: '', notes: '',
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function AdminCRM() {
  const dispatch  = useAppDispatch();
  const lk        = useLookups();
  const customers = useAppSelector(s => s.admin.crm.items);
  const total     = useAppSelector(s => s.admin.crm.total);
  const stats     = useAppSelector(s => s.admin.crm.stats);
  const aging     = useAppSelector(s => s.admin.crm.aging);
  const loading   = useAppSelector(s => s.admin.loading);

  const categories = lk.list('CustomerCategory');

  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab]           = useState('customers');

  const [showModal, setShowModal]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [reminding, setReminding]   = useState(null);

  // Bulk reminder (controlled)
  const [bulk, setBulk] = useState({ minOutstanding: '', bucket: 'All', category: 'All', message: '' });
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult]   = useState(null);

  const refreshSummary = () => { dispatch(fetchCrmStats()); dispatch(fetchCrmAging()); };

  useEffect(() => {
    dispatch(fetchCrmStats());
    dispatch(fetchCrmAging());
  }, [dispatch]);

  const loadList = () => dispatch(fetchCrmCustomers({ page, search: search.trim() || undefined, limit: pageSize }));

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await dispatch(fetchCrmCustomers({ page, search: search.trim() || undefined, limit: pageSize }));
      setLoadedOnce(true);
      if (fetchCrmCustomers.rejected.match(res)) toast.error(res.payload || 'Failed to load customers');
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [dispatch, page, pageSize, search]);

  // Pager uses the filtered total returned by the list API (not overall stats)
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Deleting the last row of the last page → step back a page
  useEffect(() => { if (loadedOnce && page > totalPages) setPage(totalPages); }, [loadedOnce, page, totalPages]);

  // ── Modals ───────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM, category: categories[0]?.value ?? '' }); setShowModal(true); };

  const openEdit = (c) => {
    setEditTarget(c);
    setForm({
      name:        c.name        ?? '',
      contactName: c.contactName ?? '',
      phone:       c.phone       ?? '',
      email:       c.email       ?? '',
      city:        c.city        ?? '',
      state:       c.state       ?? '',
      category:    c.category    ?? '',
      gstin:       c.gstin       ?? '',
      creditLimit: String(c.creditLimit ?? ''),
      notes:       c.notes       ?? '',
      // keep fields this short form doesn't edit
      pan: c.pan, billingAddress: c.billingAddress, shippingAddress: c.shippingAddress,
      birthDate: c.birthDate, anniversaryDate: c.anniversaryDate, tags: c.tags,
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditTarget(null); setForm(EMPTY_FORM); };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { toast.error('Name and phone are required'); return; }
    setSaving(true);
    const payload = { ...form, category: form.category || undefined, creditLimit: Number(form.creditLimit) || 0 };
    const res = editTarget
      ? await dispatch(updateCrmCustomer({ id: editTarget.id, ...payload }))
      : await dispatch(createCrmCustomer(payload));
    setSaving(false);
    if ((editTarget ? updateCrmCustomer : createCrmCustomer).fulfilled.match(res)) {
      toast.success(editTarget ? 'Customer updated' : 'Customer added');
      closeModal();
      refreshSummary();
      if (!editTarget) loadList();
      if (editTarget && selected?.id === editTarget.id) setSelected(res.payload);
    } else {
      toast.error(res.payload || 'Operation failed');
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (c) => {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    const res = await dispatch(deleteCrmCustomer(c.id));
    if (deleteCrmCustomer.fulfilled.match(res)) {
      toast.success('Customer deleted');
      if (selected?.id === c.id) setSelected(null);
      refreshSummary();
      loadList();
    } else {
      toast.error(res.payload || 'Failed to delete');
    }
  };

  // ── Reminders (emailed by the backend; WhatsApp fallback when no email) ──────
  const sendReminder = async (c) => {
    setReminding(c.id);
    const res = await dispatch(sendCrmReminder({ id: c.id }));
    setReminding(null);
    if (!sendCrmReminder.fulfilled.match(res)) { toast.error(res.payload || 'Failed to send reminder'); return; }
    const r = res.payload;
    if (r.sent > 0) toast.success(r.notice || `Reminder emailed to ${r.email}`);
    else if (r.whatsAppUrl) {
      toast(`${c.name} has no email on file — opening WhatsApp with the reminder.`);
      window.open(r.whatsAppUrl, '_blank', 'noopener');
    } else toast.error(r.notice || `${c.name} has no email or valid phone — reminder not sent.`);
  };

  const bucketOptions = aging.buckets;
  const bulkPreview = useMemo(() => {
    const min = Number(bulk.minOutstanding) || 0;
    const rows = aging.rows.filter(r => !r.isBlocked && Number(r.outstandingDues) >= min
      && (bulk.bucket === 'All' || r.bucket === bulk.bucket)
      && (bulk.category === 'All' || r.category === bulk.category));
    return { matched: rows.length, withEmail: rows.filter(r => r.email).length };
  }, [aging.rows, bulk]);

  const sendBulk = async () => {
    setBulkSending(true);
    setBulkResult(null);
    const res = await dispatch(sendCrmBulkReminders({
      minOutstanding: Number(bulk.minOutstanding) || 0,
      bucket: bulk.bucket,
      category: bulk.category,
      message: bulk.message.trim() || undefined,
    }));
    setBulkSending(false);
    if (!sendCrmBulkReminders.fulfilled.match(res)) { toast.error(res.payload || 'Failed to send reminders'); return; }
    setBulkResult(res.payload);
    if (res.payload.sent > 0) toast.success(res.payload.notice);
    else toast.error(res.payload.notice || 'No reminders were sent');
  };

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  if (!loadedOnce && loading && customers.length === 0) return <div className="space-y-6"><SkPageHeader /><SkTabs tabCount={2} contentRows={6} /></div>;

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setB = (k) => (e) => setBulk(b => ({ ...b, [k]: e.target.value }));
  const agingTotal = aging.totalOutstanding;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer Management (CRM)"
        description="Credit limits, dues tracking, loyalty points, payment reminders"
        actions={<Button onClick={openCreate}><Plus className="size-4" /> Add Customer</Button>}
      />

      {/* KPIs — from /crm/stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Customers"   value={(stats?.total ?? 0).toLocaleString('en-IN')} icon={Users} tone="info" loading={!stats} />
        <Stat label="Total Outstanding" value={inr(stats?.totalDues)} hint={stats ? `${stats.withDues ?? 0} customers with dues` : undefined} icon={Wallet} tone="danger" loading={!stats} />
        <Stat label="Avg Credit Limit"  value={inr(stats?.avgCreditLimit)} hint="customers with a limit" icon={CreditCard} tone="success" loading={!stats} />
        <Stat label="Total Loyalty Pts" value={(stats?.totalPoints ?? 0).toLocaleString('en-IN')} icon={Star} tone="accent" loading={!stats} />
      </div>

      <Tabs
        items={[{ value: 'customers', label: 'Customers', icon: Users }, { value: 'aging', label: 'Aging Report', icon: Clock, count: aging.totalCustomers || undefined }]}
        value={tab}
        onChange={setTab}
      />

      {/* ── Customers Tab ── */}
      {tab === 'customers' && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Card
            title="Customer Master"
            className="xl:col-span-2"
            actions={<SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search…" className="!h-8 w-48 !min-w-0 !flex-none [&>input]:!h-8" />}
          >
            <div className="p-3">
              {loading && customers.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-[color:var(--text-muted)]">Loading customers…</div>
              ) : customers.length === 0 ? (
                <EmptyState icon={Users} title="No customers found">{search ? 'Try a different search.' : 'Add your first customer.'}</EmptyState>
              ) : (
                <>
                  <div className="grid-box">
                    <table>
                      <thead>
                        <tr>
                          <th className="text-left">Customer</th>
                          <th className="text-left">City</th>
                          <th className="text-left">Category</th>
                          <th className="text-right">Credit Limit</th>
                          <th className="text-right">Outstanding</th>
                          <th className="text-left">Last Order</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map(c => {
                          const dues   = Number(c.outstandingDues ?? 0);
                          const credit = Number(c.creditLimit    ?? 0);
                          const isSel  = selected?.id === c.id;
                          return (
                            <tr key={c.id}
                              className={`cursor-pointer ${isSel ? '[&>td]:!bg-[color:var(--selection)]' : ''}`}
                              onClick={() => setSelected(c)}>
                              <td className="font-bold text-[color:var(--text-primary)]">
                                {c.name}
                                {c.isBlocked && <Badge tone="danger" className="ml-1.5">Blocked</Badge>}
                              </td>
                              <td className="text-[color:var(--text-muted)]">{c.city || '—'}</td>
                              <td><Badge tone={CAT_TONE[c.category] ?? 'neutral'}>{lk.label('CustomerCategory', c.category)}</Badge></td>
                              <td className="text-right">{inr(credit)}</td>
                              <td className={`text-right font-bold ${dues > 0 ? 'text-[color:var(--danger)]' : 'text-[color:var(--success)]'}`}>{inr(dues)}</td>
                              <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(c.lastOrderDate)}</td>
                              <td onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  {dues > 0 && (
                                    <Button size="sm" variant="secondary" className="!h-7 !px-2 !text-[12px]" loading={reminding === c.id} onClick={() => sendReminder(c)}>
                                      <Send className="size-3" /> Remind
                                    </Button>
                                  )}
                                  <IconButton label="Edit customer" tone="primary" onClick={() => openEdit(c)}><Edit2 className="size-3.5" /></IconButton>
                                  <IconButton label="Delete customer" tone="danger" onClick={() => handleDelete(c)}><Trash2 className="size-3.5" /></IconButton>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Server-side paging — total is the filtered count from the API */}
                  <Pagination
                    page={Math.min(page, totalPages)}
                    pages={totalPages}
                    total={total}
                    pageSize={pageSize}
                    setPage={setPage}
                    setPageSize={(n) => { setPageSize(n); setPage(1); }}
                    noun="customers"
                  />
                </>
              )}
            </div>
          </Card>

          {/* Customer detail panel */}
          <Card title="Customer Detail" bodyClassName="p-4">
            {selected ? (
              <div key={selected.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-[color:var(--primary)] text-[16px] font-bold text-white">
                    {(selected.name ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-[color:var(--text-primary)]">{selected.name}</div>
                    <Badge tone={CAT_TONE[selected.category] ?? 'neutral'}>{lk.label('CustomerCategory', selected.category)}</Badge>
                  </div>
                </div>
                <dl className="divide-y divide-[color:var(--border)] text-[13px]">
                  {[
                    ['Contact',       selected.contactName   || '—'],
                    ['Phone',         selected.phone         || '—'],
                    ['Email',         selected.email         || '—'],
                    ['City',          selected.city          || '—'],
                    ['State',         selected.state         || '—'],
                    ['GSTIN',         selected.gstin         || '—'],
                    ['Credit Limit',  inr(selected.creditLimit)],
                    ['Outstanding',   inr(selected.outstandingDues)],
                    ['Loyalty Pts',   Number(selected.loyaltyPoints ?? 0).toLocaleString('en-IN')],
                    ['Last Order',    fmtDate(selected.lastOrderDate)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 py-2">
                      <dt className="text-[color:var(--text-muted)]">{k}</dt>
                      <dd className={`text-right font-bold ${k==='Outstanding' && Number(selected.outstandingDues)>0 ? 'text-[color:var(--danger)]' : ''}`}>{v}</dd>
                    </div>
                  ))}
                </dl>
                {selected.notes && (
                  <div>
                    <span className="text-[12px] font-bold text-[color:var(--text-secondary)]">Notes</span>
                    <p className="mt-1 text-[13px] text-[color:var(--text-secondary)]">{selected.notes}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  {Number(selected.outstandingDues) > 0 && (
                    <Button variant="secondary" className="flex-1" loading={reminding === selected.id} onClick={() => sendReminder(selected)}>
                      <Send className="size-3.5" /> Remind
                    </Button>
                  )}
                  <Button variant="secondary" className="flex-1" onClick={() => openEdit(selected)}>
                    <Edit2 className="size-3.5" /> Edit
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState icon={UserRound} title="No customer selected">Click a customer to view details</EmptyState>
            )}
          </Card>
        </div>
      )}

      {/* ── Aging Tab ── */}
      {tab === 'aging' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card title="Outstanding Dues — Aging Report" bodyClassName="p-4">
            {aging.totalCustomers === 0 ? (
              <EmptyState icon={Wallet} title="No outstanding dues" />
            ) : (
              <div className="space-y-3">
                {aging.buckets.map(a => {
                  const pct = agingTotal > 0 ? Math.round((Number(a.amount) / agingTotal) * 100) : 0;
                  return (
                    <div key={a.bucket}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                        <Badge tone={BUCKET_TONE[a.bucket] ?? 'neutral'}>{a.label} overdue</Badge>
                        <span className="font-bold tabular-nums text-[color:var(--text-primary)]">
                          {inr(a.amount)} <span className="font-normal text-[color:var(--text-muted)]">({a.customers} cust.)</span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
                        <div className={`h-full rounded-full ${BUCKET_BAR[a.bucket] ?? 'bg-[color:var(--text-muted)]'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between border-t border-[color:var(--border)] pt-3 font-bold">
                  <span className="text-[color:var(--text-secondary)]">Total Outstanding</span>
                  <span className="text-[16px] tabular-nums text-[color:var(--danger)]">{inr(agingTotal)}</span>
                </div>
              </div>
            )}
          </Card>

          <Card title="Bulk Payment Reminder" bodyClassName="space-y-3 p-4">
            <p className="text-[13px] text-[color:var(--text-muted)]">
              Emails a payment-due reminder to every non-blocked customer with dues matching these filters. Customers without an email on file are skipped.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min Outstanding (₹)">
                <input type="number" min="0" value={bulk.minOutstanding} onChange={setB('minOutstanding')} placeholder="0" className="input-field" />
              </Field>
              <Field label="Aging bucket">
                <select value={bulk.bucket} onChange={setB('bucket')} className="input-field">
                  <option value="All">All buckets</option>
                  {bucketOptions.map(b => <option key={b.bucket} value={b.bucket}>{b.label}</option>)}
                </select>
              </Field>
              <Field label="Category" className="col-span-2">
                <select value={bulk.category} onChange={setB('category')} className="input-field">
                  <option value="All">All categories</option>
                  {lookupOptions(categories).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Message" hint="Placeholders: {customer} {amount} {days} {company}. Leave blank for the standard reminder.">
              <textarea rows={3} value={bulk.message} onChange={setB('message')} className="input-field resize-none text-[12px]"
                placeholder="Dear {customer}, your outstanding amount of ₹{amount} with {company} is due ({days} days). Please make the payment at the earliest." />
            </Field>
            <div className="text-[12px] text-[color:var(--text-muted)]">
              <b className="text-[color:var(--text-primary)]">{bulkPreview.matched}</b> customers match · <b className="text-[color:var(--text-primary)]">{bulkPreview.withEmail}</b> have an email
            </div>
            <Button className="w-full" onClick={sendBulk} loading={bulkSending} disabled={bulkPreview.matched === 0}>
              <Mail className="size-3.5" /> {bulkSending ? 'Sending…' : 'Email Reminders'}
            </Button>
            {bulkResult && (
              <div className="rounded-[6px] border border-[color:var(--border)] p-3 text-[12px] text-[color:var(--text-secondary)]">
                <div><b>{bulkResult.sent}</b> sent · <b>{bulkResult.skipped}</b> skipped (no email){bulkResult.failed > 0 && <> · <b className="text-[color:var(--danger)]">{bulkResult.failed}</b> failed</>}</div>
                {bulkResult.skippedCustomers?.length > 0 && (
                  <div className="mt-1 text-[color:var(--text-muted)]">Skipped: {bulkResult.skippedCustomers.map(c => c.name).join(', ')}</div>
                )}
                {bulkResult.failedCustomers?.length > 0 && (
                  <div className="mt-1 text-[color:var(--danger)]">Failed: {bulkResult.failedCustomers.map(c => `${c.name} (${c.error})`).join(', ')}</div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <DialogPanel
            title={editTarget ? 'Edit Customer' : 'Add Customer'}
            onClose={closeModal}
            width="max-w-lg"
            footer={<>
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button type="submit" form="crm-customer-form" loading={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Customer'}
              </Button>
            </>}
          >
            <form id="crm-customer-form" onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company / Name" required>
                  <input value={form.name} onChange={setF('name')} placeholder="e.g. Raj Traders" className="input-field" required />
                </Field>
                <Field label="Contact Person">
                  <input value={form.contactName} onChange={setF('contactName')} placeholder="e.g. Rajesh Kumar" className="input-field" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone" required>
                  <input value={form.phone} onChange={setF('phone')} placeholder="+91 98765 12345" className="input-field" required />
                </Field>
                <Field label="Email" hint="Needed for emailed payment reminders">
                  <input type="email" value={form.email} onChange={setF('email')} placeholder="contact@example.com" className="input-field" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input value={form.city} onChange={setF('city')} placeholder="e.g. Mumbai" className="input-field" />
                </Field>
                <Field label="State">
                  <input value={form.state} onChange={setF('state')} placeholder="e.g. Maharashtra" className="input-field" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select value={form.category} onChange={setF('category')} className="input-field">
                    {!form.category && <option value="">Select…</option>}
                    {lookupOptions(categories, form.category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Credit Limit (₹)">
                  <input type="number" min="0" step="100" value={form.creditLimit} onChange={setF('creditLimit')} placeholder="e.g. 50000" className="input-field" />
                </Field>
              </div>
              <Field label="GSTIN">
                <input value={form.gstin} onChange={setF('gstin')} placeholder="15-char GSTIN (optional)" className="input-field" maxLength={15} />
              </Field>
              <Field label="Notes">
                <textarea rows={2} value={form.notes} onChange={setF('notes')} placeholder="Internal notes…" className="input-field resize-none text-[12px]" />
              </Field>
            </form>
          </DialogPanel>
        </div>
      )}
    </div>
  );
}
