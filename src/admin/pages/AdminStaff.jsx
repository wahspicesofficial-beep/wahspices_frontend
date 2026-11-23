import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Plus, Trash2, CheckCircle, UserCheck, Users, Building2, Wallet, FileText,
  TrendingUp, ArrowRightLeft, Briefcase, Pencil, UserX, Download, ExternalLink, ShieldCheck,
} from 'lucide-react';
import api from '@/services/api';
import { SkPageHeader, SkCardList } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import AdminModal from '@/admin/components/AdminModal';
import {
  fetchAdminStaff, createEmployee, updateEmployee, deleteEmployee,
  fetchDepartments, createDepartment, deleteDepartment,
  fetchDesignations, createDesignation, deleteDesignation,
  fetchEmployeeDocuments, addEmployeeDocument, deleteEmployeeDocument, uploadEmployeeDocument, downloadEmployeeDocument,
  fetchSalaryStructure, updateSalaryStructure,
  fetchIncrements, createIncrement,
  fetchTransfers, transferEmployee,
} from '@/store/slices/adminSlice';
import {
  PageHeader, Stat, Card, Badge, Button, IconButton, Tabs, Segmented, SearchInput,
  Toolbar, EmptyState, DialogPanel, Field, usePagination, Pagination, cn,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';

const inp = 'input-field w-full';

const TABS = ['Employees', 'Departments & Designations', 'Documents', 'Salary & Increments', 'Transfers'];
const TAB_ICONS = [Users, Building2, FileText, Wallet, ArrowRightLeft];
// Employment types (EmploymentType enum), document types (StaffDocumentType list) and departments come from the API.
// Purely visual: a stable badge tone per department name / document type.
const TONES = ['success', 'info', 'accent', 'primary', 'danger', 'warning'];
const toneFor = (key) => { if (!key) return 'neutral'; let h = 0; for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return TONES[h % TONES.length]; };
const deptTone = new Proxy({}, { get: (_, k) => toneFor(k) });
const docTone  = deptTone;
const EMPTY_DOC = { documentType: '', documentName: '', documentNumber: '', expiryDate: '', notes: '' };
const SAL_EMPTY = { basicSalary: '', hraPercent: '', taAmount: '', daPercent: '', specialAllowance: '', pfPercent: '', esicPercent: '', professionalTax: '', effectiveFrom: '' };
const nullIfEmpty = (v) => (v === '' || v === undefined ? null : v);

function Avatar({ name, photo, size = 'size-6 text-[11px]' }) {
  return photo
    ? <img src={photo} className={cn(size, 'shrink-0 rounded-full object-cover')} alt="" />
    : <div className={cn(size, 'flex shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] font-bold text-white')}>{(name || '?')[0]}</div>;
}

function normalizeEmp(e) {
  return {
    id: e.id,
    empId: e.employeeId,
    name: e.name || '',
    dept: e.department || '',
    desg: e.designation || '',
    type: e.employmentType || '',
    salary: e.salary || 0,
    joined: e.joinedAt || '',
    status: e.isActive ? 'Active' : 'Inactive',
    noticePeriodDays: e.noticePeriodDays || 30,
    branch: e.branch || '',
    email: e.email || '',
    phone: e.phone || '',
    aadhar: e.aadharNumber || '',
    pan: e.panNumber || '',
    bankAcc: e.bankAccountNo || '',
    bankIfsc: e.bankIfsc || '',
    pf: e.pfNumber || '',
    esic: e.esicNumber || '',
    reportingMgr: e.reportingManagerId || '',
    photo: e.photoUrl || '',
    confirmationDate: e.confirmationDate || '',
  };
}

// ── Employee Form Modal ────────────────────────────────────────────────────────
function EmployeeModal({ emp, departments, designations, employees, onClose, onSave }) {
  const isEdit = !!emp;
  const lk = useLookups();
  const empTypes = lk.enumList('EmploymentType');
  const [section, setSection] = useState('personal');
  const [form, setForm] = useState({
    name: emp?.name || '',
    phone: emp?.phone || '',
    email: emp?.email || '',
    photoUrl: emp?.photo || '',
    department: emp?.dept || (departments[0]?.name || ''),
    designation: emp?.desg || '',
    employmentType: emp?.type || '',
    joinedAt: emp?.joined?.split('T')[0] || '',
    confirmationDate: emp?.confirmationDate?.split('T')[0] || '',
    noticePeriodDays: emp?.noticePeriodDays || 30,
    branch: emp?.branch || '',
    aadharNumber: emp?.aadhar || '',
    panNumber: emp?.pan || '',
    bankAccountNo: emp?.bankAcc || '',
    bankIfsc: emp?.bankIfsc || '',
    pfNumber: emp?.pf || '',
    esicNumber: emp?.esic || '',
    reportingManagerId: emp?.reportingMgr || '',
    salary: emp?.salary || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ID/bank numbers arrive masked (XXXX-XXXX-1234). Revealing the real values is permission-checked and audited server-side.
  const [revealed, setRevealed] = useState(false);
  const reveal = async () => {
    try {
      const res = await api.post(`/admin/sensitive/employees/${emp.id}/reveal`, { reason: 'Edit employee form' });
      const d = res.data?.data || {};
      setForm(f => ({
        ...f,
        aadharNumber: d.aadharNumber || '', panNumber: d.panNumber || '', bankAccountNo: d.bankAccountNo || '',
        bankIfsc: d.bankIfsc || '', pfNumber: d.pfNumber || '', esicNumber: d.esicNumber || '',
      }));
      setRevealed(true);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not reveal the details');
    }
  };
  const revealBar = isEdit && !revealed && (
    <div className="col-span-2 flex items-center justify-between gap-2 text-xs text-[color:var(--text-muted)]">
      <span>Numbers are masked for privacy. Leave them as is to keep the saved values.</span>
      <Button variant="secondary" size="sm" onClick={reveal}>Reveal (logged)</Button>
    </div>
  );

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.phone.trim()) { toast.error('Phone is required'); return; }
    if (!form.joinedAt) { toast.error('Joining date is required'); return; }
    if (!form.department) { toast.error('Department is required — add one under Departments & Designations'); return; }
    const employmentType = form.employmentType || empTypes[0]?.value;
    if (!employmentType) { toast.error('Employment type is required'); return; }
    // Empty strings would fail JSON date binding on the API → send null
    onSave({
      ...form, employmentType,
      salary: +form.salary || 0, noticePeriodDays: +form.noticePeriodDays || 30,
      confirmationDate: nullIfEmpty(form.confirmationDate),
      email: form.email.trim() || null,
    });
  };


  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
        onClose={onClose}
        width="max-w-2xl"
        footer={<>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{isEdit ? 'Update Employee' : 'Add Employee'}</Button>
        </>}
      >
        <Tabs
          className="-mx-4 -mt-4 mb-4 px-2"
          items={['personal', 'employment', 'documents', 'banking'].map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
          value={section}
          onChange={setSection}
        />
        {section === 'personal' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" required className="col-span-2">
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Employee name" />
            </Field>
            <Field label="Phone" required>
              <input className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="10-digit mobile" />
            </Field>
            <Field label="Email">
              <input type="email" className={inp} value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@company.com" />
            </Field>
            <Field label="Photo URL" className="col-span-2">
              <input className={inp} value={form.photoUrl} onChange={e => set('photoUrl', e.target.value)} placeholder="https://..." />
            </Field>
          </div>
        )}
        {section === 'employment' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <select className={inp} value={form.department} onChange={e => set('department', e.target.value)}>
                {!form.department && <option value="">{departments.length ? 'Select…' : 'No departments yet'}</option>}
                {lookupOptions(departments.map(d => ({ value: d.name, label: d.name })), form.department).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Designation" required>
              <input className={inp} value={form.designation} onChange={e => set('designation', e.target.value)}
                placeholder="e.g. Production Manager" list="desg-list" />
              <datalist id="desg-list">{designations.map(d => <option key={d.id} value={d.name} />)}</datalist>
            </Field>
            <Field label="Employment type">
              <select className={inp} value={form.employmentType || empTypes[0]?.value || ''} onChange={e => set('employmentType', e.target.value)}>
                {lookupOptions(empTypes, form.employmentType).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Basic salary (₹)">
              <input type="number" className={inp} value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Joining date" required>
              <input type="date" className={inp} value={form.joinedAt} onChange={e => set('joinedAt', e.target.value)} />
            </Field>
            <Field label="Confirmation date">
              <input type="date" className={inp} value={form.confirmationDate} onChange={e => set('confirmationDate', e.target.value)} />
            </Field>
            <Field label="Notice period (days)">
              <input type="number" className={inp} value={form.noticePeriodDays} onChange={e => set('noticePeriodDays', e.target.value)} />
            </Field>
            <Field label="Branch">
              <input className={inp} value={form.branch} onChange={e => set('branch', e.target.value)} placeholder="Branch name" />
            </Field>
            <Field label="Reporting manager" className="col-span-2">
              <select className={inp} value={form.reportingManagerId} onChange={e => set('reportingManagerId', e.target.value)}>
                <option value="">— None —</option>
                {employees.filter(e => e.id !== emp?.id && e.status === 'Active').map(e => <option key={e.empId} value={e.empId}>{e.name} ({e.empId})</option>)}
              </select>
            </Field>
          </div>
        )}
        {section === 'documents' && (
          <div className="grid grid-cols-2 gap-3">
            {revealBar}
            <Field label="Aadhar number">
              <input className={inp} value={form.aadharNumber} onChange={e => set('aadharNumber', e.target.value)} placeholder="12-digit Aadhar" />
            </Field>
            <Field label="PAN number">
              <input className={inp} value={form.panNumber} onChange={e => set('panNumber', e.target.value)} placeholder="ABCDE1234F" />
            </Field>
          </div>
        )}
        {section === 'banking' && (
          <div className="grid grid-cols-2 gap-3">
            {revealBar}
            <Field label="Bank account no">
              <input className={inp} value={form.bankAccountNo} onChange={e => set('bankAccountNo', e.target.value)} />
            </Field>
            <Field label="Bank IFSC">
              <input className={inp} value={form.bankIfsc} onChange={e => set('bankIfsc', e.target.value)} placeholder="HDFC0001234" />
            </Field>
            <Field label="PF number">
              <input className={inp} value={form.pfNumber} onChange={e => set('pfNumber', e.target.value)} />
            </Field>
            <Field label="ESIC number">
              <input className={inp} value={form.esicNumber} onChange={e => set('esicNumber', e.target.value)} />
            </Field>
          </div>
        )}
      </DialogPanel>
    </AdminModal>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminStaff() {
  const dispatch = useDispatch();
  const lk = useLookups();
  const docTypes = lk.list('StaffDocumentType');
  const staffState = useSelector(s => s.admin.staff);
  const loading = useSelector(s => s.admin.loading);
  const rawItems = staffState?.items || [];
  const departments = staffState?.departments || [];
  const designations = staffState?.designations || [];
  const docsEmpId = staffState?.documentsEmpId;
  const salaryStructure = staffState?.salaryStructure || null;
  const increments = staffState?.increments || [];
  const transfers = staffState?.transfers || [];

  const employees = useMemo(() => rawItems.map(normalizeEmp), [rawItems]);

  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [editEmp, setEditEmp] = useState(null);

  // Departments & Designations tab
  const [newDept, setNewDept] = useState({ name: '', description: '' });
  const [newDesg, setNewDesg] = useState({ name: '', department: '', level: 1 });

  // Documents tab
  const [docEmpId, setDocEmpId] = useState('');
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docForm, setDocForm] = useState(EMPTY_DOC);
  const [docFile, setDocFile] = useState(null);
  const [savingDoc, setSavingDoc] = useState(false);
  // Only show documents that belong to the selected employee (cleared immediately on switch)
  const documents = useMemo(
    () => (docEmpId && String(docsEmpId) === String(docEmpId) ? (staffState?.documents || []) : []),
    [docEmpId, docsEmpId, staffState?.documents],
  );

  // Salary & Increments tab
  const [salEmpId, setSalEmpId] = useState('');
  const [salForm, setSalForm] = useState(SAL_EMPTY);
  const [salHasStructure, setSalHasStructure] = useState(false);
  const [salPreview, setSalPreview] = useState(null);
  const [savingSal, setSavingSal] = useState(false);
  const [showAddInc, setShowAddInc] = useState(false);
  const [incForm, setIncForm] = useState({ newSalary: '', reason: '', effectiveDate: '' });

  // Transfers tab
  const [showAddTransfer, setShowAddTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ empId: '', toDepartment: '', toBranch: '', toDesignation: '', transferDate: '', reason: '' });

  const reloadStaff = () => dispatch(fetchAdminStaff({ limit: 1000 }));

  useEffect(() => {
    dispatch(fetchAdminStaff({ limit: 1000 }));
    dispatch(fetchDepartments());
    dispatch(fetchDesignations());
    dispatch(fetchTransfers());
  }, [dispatch]);

  useEffect(() => {
    if (tab === 3 && salEmpId) {
      dispatch(fetchSalaryStructure(salEmpId));
      dispatch(fetchIncrements(salEmpId));
    }
  }, [tab, salEmpId, dispatch]);

  useEffect(() => {
    if (tab === 2 && docEmpId) dispatch(fetchEmployeeDocuments(docEmpId));
  }, [tab, docEmpId, dispatch]);

  // Load the employee's structure, or the backend's statutory defaults when none is configured
  const salLoadedFor = staffState?.salaryEmpId;
  useEffect(() => {
    if (!salEmpId || String(salLoadedFor) !== String(salEmpId)) { setSalForm(SAL_EMPTY); setSalHasStructure(false); return; }
    if (salaryStructure) {
      setSalHasStructure(true);
      setSalForm({
        basicSalary: salaryStructure.basicSalary ?? '',
        hraPercent: salaryStructure.hraPercent ?? '',
        taAmount: salaryStructure.taAmount ?? '',
        daPercent: salaryStructure.daPercent ?? '',
        specialAllowance: salaryStructure.specialAllowance ?? '',
        pfPercent: salaryStructure.pfPercent ?? '',
        esicPercent: salaryStructure.esicPercent ?? '',
        professionalTax: salaryStructure.professionalTax ?? '',
        effectiveFrom: salaryStructure.effectiveFrom?.split('T')[0] || '',
      });
      return;
    }
    let cancelled = false;
    setSalHasStructure(false);
    api.get(`/admin/staff/${salEmpId}/salary/defaults`)
      .then(res => { if (!cancelled) setSalForm({ ...SAL_EMPTY, ...res.data.data, effectiveFrom: '' }); })
      .catch(err => { if (!cancelled) toast.error(err.response?.data?.error?.message || 'Could not load salary defaults'); });
    return () => { cancelled = true; };
  }, [salEmpId, salLoadedFor, salaryStructure]);

  // Gross / deductions / net preview computed by the backend with the same statutory rules as payroll
  useEffect(() => {
    if (!salEmpId || !(+salForm.basicSalary > 0)) { setSalPreview(null); return; }
    const body = {
      basicSalary: +salForm.basicSalary || 0, hraPercent: +salForm.hraPercent || 0, taAmount: +salForm.taAmount || 0,
      daPercent: +salForm.daPercent || 0, specialAllowance: +salForm.specialAllowance || 0, pfPercent: +salForm.pfPercent || 0,
      esicPercent: +salForm.esicPercent || 0, professionalTax: +salForm.professionalTax || 0, effectiveFrom: null,
    };
    let cancelled = false;
    const t = setTimeout(() => {
      api.post(`/admin/staff/${salEmpId}/salary/preview`, body)
        .then(res => { if (!cancelled) setSalPreview(res.data.data); })
        .catch(() => { if (!cancelled) setSalPreview(null); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [salEmpId, salForm]);

  // Keep the profile panel in sync after edits / refetches
  useEffect(() => {
    if (selected) {
      const fresh = employees.find(e => e.id === selected.id);
      if (fresh && fresh !== selected) setSelected(fresh);
    }
  }, [employees, selected]);

  const deptList = useMemo(() => ['All', ...Array.from(new Set(employees.map(e => e.dept).filter(Boolean)))], [employees]);

  const filtered = employees.filter(e =>
    (e.name.toLowerCase().includes(search.toLowerCase()) || e.desg.toLowerCase().includes(search.toLowerCase())) &&
    (deptFilter === 'All' || e.dept === deptFilter)
  );

  const activeCount = employees.filter(e => e.status === 'Active').length;
  const totalPayroll = employees.filter(e => e.status === 'Active').reduce((s, e) => s + (e.salary || 0), 0);

  const handleAddEmployee = async (data) => {
    try {
      const created = await dispatch(createEmployee(data)).unwrap();
      toast.success(`Employee added${created?.employeeId ? ` (${created.employeeId})` : ''}`);
      setShowAddEmp(false);
      reloadStaff();
      dispatch(fetchDepartments());
    } catch (err) { toast.error(err || 'Failed to add employee'); }
  };

  const handleEditEmployee = async (data) => {
    try {
      await dispatch(updateEmployee({ id: editEmp.id, ...data })).unwrap();
      reloadStaff();
      dispatch(fetchDepartments());
      toast.success('Employee updated');
      setEditEmp(null);
    } catch (err) { toast.error(err || 'Failed to update'); }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this employee?')) return;
    try {
      await dispatch(deleteEmployee(id)).unwrap();
      toast.success('Employee deactivated');
      setSelected(null);
      reloadStaff();
    } catch (err) { toast.error(err || 'Failed'); }
  };

  const empPg   = usePagination(filtered, 20);
  const deptPg  = usePagination(departments, 10);
  const desgPg  = usePagination(designations, 10);
  const docPg   = usePagination(documents, 20);
  const incPg   = usePagination(increments, 10);
  const trfPg   = usePagination(transfers, 20);

  if (loading && rawItems.length === 0) return <div className="space-y-6"><SkPageHeader /><SkCardList count={6} /></div>;

  const employeeSelect = (value, onChange, className) => (
    <select className={cn(inp, className)} value={value} onChange={onChange}>
      <option value="">— Select employee —</option>
      {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.empId})</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        description="Employee master, documents, hierarchy and salary structure"
        actions={<Button onClick={() => setShowAddEmp(true)}><Plus className="size-4" /> Add Employee</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total employees" value={employees.length} icon={Users} tone="info" />
        <Stat label="Active" value={activeCount} icon={UserCheck} tone="success" />
        <Stat label="Departments" value={departments.length} icon={Building2} tone="primary" />
        <Stat label="Monthly payroll" value={`₹${totalPayroll.toLocaleString()}`} icon={Wallet} tone="accent" hint="Active employees" />
      </div>

      <Tabs items={TABS.map((t, i) => ({ value: i, label: t, icon: TAB_ICONS[i] }))} value={tab} onChange={setTab} />

      {/* ── TAB 0: Employees ─────────────────────────────────────────────────── */}
      {tab === 0 && (
        <div className="flex flex-col gap-3 xl:flex-row">
          <Card className="flex-1">
            <div className="space-y-3 p-3">
              <Toolbar>
                <SearchInput value={search} onChange={setSearch} placeholder="Search by name or designation…" className="max-w-sm" />
                <div className="overflow-x-auto">
                  <Segmented options={deptList} value={deptFilter} onChange={setDeptFilter} />
                </div>
              </Toolbar>

              {filtered.length === 0 ? (
                <EmptyState icon={Users} title={employees.length ? 'No employees found' : 'No employees yet'}>
                  {employees.length ? 'Try another department or clear the search.' : 'Add your first employee to get started.'}
                </EmptyState>
              ) : (
                <>
                  <div className="grid-box">
                    <table>
                      <thead>
                        <tr>
                          <th className="text-left">Emp ID</th>
                          <th className="text-left">Name</th>
                          <th className="text-left">Department</th>
                          <th className="text-left">Designation</th>
                          <th className="text-left">Type</th>
                          <th className="text-right">Salary</th>
                          <th className="text-left">Joined</th>
                          <th className="text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empPg.items.map(e => (
                          <tr key={e.id} onClick={() => setSelected(e)}
                            className={cn('cursor-pointer', selected?.id === e.id && '[&>td]:!bg-[color:var(--selection)]')}>
                            <td className="whitespace-nowrap font-bold text-[color:var(--primary)]">{e.empId}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <Avatar name={e.name} photo={e.photo} />
                                <span className="font-bold">{e.name}</span>
                              </div>
                            </td>
                            <td>{e.dept && <Badge tone={deptTone[e.dept] || 'neutral'}>{e.dept}</Badge>}</td>
                            <td className="text-[color:var(--text-secondary)]">{e.desg}</td>
                            <td><Badge tone={e.type === 'Permanent' ? 'success' : 'accent'}>{lk.label('EmploymentType', e.type)}</Badge></td>
                            <td className="text-right font-bold">₹{(e.salary || 0).toLocaleString()}</td>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{e.joined?.split('T')[0]}</td>
                            <td><Badge tone={e.status === 'Active' ? 'success' : 'neutral'}>{e.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination {...empPg} noun="employees" />
                </>
              )}
            </div>
          </Card>

          {/* Profile Panel */}
          <Card title="Employee profile" className="w-full shrink-0 self-start xl:w-72" bodyClassName="p-3">
            {selected ? (
              <div className="space-y-2">
                <div className="mb-3 text-center">
                  <div className="mb-2 flex justify-center"><Avatar name={selected.name} photo={selected.photo} size="size-14 text-[22px]" /></div>
                  <div className="text-[14px] font-bold">{selected.name}</div>
                  <div className="text-[12px] text-[color:var(--text-muted)]">{selected.empId}</div>
                  {selected.dept && <Badge className="mt-1" tone={deptTone[selected.dept] || 'neutral'}>{selected.dept}</Badge>}
                </div>
                <dl className="text-[13px]">
                  {[
                    ['Designation', selected.desg],
                    ['Type', lk.label('EmploymentType', selected.type)],
                    ['Salary', `₹${(selected.salary || 0).toLocaleString()}/mo`],
                    ['Phone', selected.phone],
                    ['Email', selected.email || '—'],
                    ['Branch', selected.branch || '—'],
                    ['Joined', selected.joined?.split('T')[0]],
                    ['Notice Period', `${selected.noticePeriodDays} days`],
                    ['Status', selected.status],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 border-b border-[color:var(--border)] py-1.5 last:border-0">
                      <dt className="text-[color:var(--text-muted)]">{k}</dt>
                      <dd className="max-w-[150px] truncate text-right font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" onClick={() => setEditEmp(selected)}><Pencil className="size-3.5" /> Edit</Button>
                  <Button size="sm" variant="danger" className="flex-1" onClick={() => handleDeactivate(selected.id)}><UserX className="size-3.5" /> Deactivate</Button>
                </div>
              </div>
            ) : (
              <EmptyState icon={UserCheck} title="No employee selected">Click a row to view the profile.</EmptyState>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 1: Departments & Designations ────────────────────────────────── */}
      {tab === 1 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Departments */}
          <Card title="Departments" bodyClassName="p-3 space-y-3">
            <div className="flex gap-2">
              <input className={inp + ' flex-1'} value={newDept.name}
                onChange={e => setNewDept(f => ({ ...f, name: e.target.value }))}
                placeholder="Department name" onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
              <Button onClick={async () => {
                if (!newDept.name.trim()) return;
                try {
                  await dispatch(createDepartment({ name: newDept.name.trim(), description: newDept.description || null })).unwrap();
                  setNewDept({ name: '', description: '' });
                  dispatch(fetchDepartments());
                  toast.success('Department added');
                } catch (err) { toast.error(err || 'Failed'); }
              }}><Plus className="size-4" /> Add</Button>
            </div>
            {departments.length === 0 ? (
              <EmptyState icon={Building2} title="No departments yet" />
            ) : (
              <div>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Department</th>
                        <th className="text-right">Employees</th>
                        <th className="w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptPg.items.map(d => (
                        <tr key={d.id}>
                          <td>
                            <div className="font-bold">{d.name}</div>
                            {d.description && <div className="text-[12px] text-[color:var(--text-muted)]">{d.description}</div>}
                          </td>
                          <td className="text-right">{d.employeeCount ?? 0}</td>
                          <td>
                            <div className="flex justify-center">
                              <IconButton label="Delete department" tone="danger" onClick={async () => {
                                if (!window.confirm(`Delete department "${d.name}"?`)) return;
                                try { await dispatch(deleteDepartment(d.id)).unwrap(); toast.success('Department deleted'); dispatch(fetchDepartments()); }
                                catch (err) { toast.error(err || 'Failed to delete department'); }
                              }}><Trash2 className="size-3.5" /></IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...deptPg} noun="departments" />
              </div>
            )}
          </Card>

          {/* Designations */}
          <Card title="Designations" bodyClassName="p-3 space-y-3">
            <div className="flex gap-2">
              <input className={inp + ' flex-1'} value={newDesg.name}
                onChange={e => setNewDesg(f => ({ ...f, name: e.target.value }))} placeholder="Title" />
              <select className={inp + ' flex-1'} value={newDesg.department}
                onChange={e => setNewDesg(f => ({ ...f, department: e.target.value }))}>
                <option value="">— Dept —</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <Button onClick={async () => {
                if (!newDesg.name.trim()) return;
                try {
                  await dispatch(createDesignation({ name: newDesg.name.trim(), department: newDesg.department || null, level: +newDesg.level || 1 })).unwrap();
                  setNewDesg({ name: '', department: '', level: 1 });
                  dispatch(fetchDesignations());
                  toast.success('Designation added');
                } catch (err) { toast.error(err || 'Failed'); }
              }}><Plus className="size-4" /> Add</Button>
            </div>
            {designations.length === 0 ? (
              <EmptyState icon={Briefcase} title="No designations yet" />
            ) : (
              <div>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Designation</th>
                        <th className="text-left">Department</th>
                        <th className="text-right">Level</th>
                        <th className="w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {desgPg.items.map(d => (
                        <tr key={d.id}>
                          <td className="font-bold">{d.name}</td>
                          <td className="text-[color:var(--text-muted)]">{d.department || 'All departments'}</td>
                          <td className="text-right">{d.level}</td>
                          <td>
                            <div className="flex justify-center">
                              <IconButton label="Delete designation" tone="danger" onClick={async () => {
                                if (!window.confirm(`Delete designation "${d.name}"?`)) return;
                                try { await dispatch(deleteDesignation(d.id)).unwrap(); toast.success('Designation deleted'); dispatch(fetchDesignations()); }
                                catch (err) { toast.error(err || 'Failed to delete designation'); }
                              }}><Trash2 className="size-3.5" /></IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...desgPg} noun="designations" />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 2: Documents ─────────────────────────────────────────────────── */}
      {tab === 2 && (
        <Card
          title="Employee documents"
          actions={<Button size="sm" onClick={() => setShowAddDoc(true)} disabled={!docEmpId}><Plus className="size-3.5" /> Add Document</Button>}
        >
          <div className="space-y-3 p-3">
            <Field label="Select employee" className="max-w-xs">
              {employeeSelect(docEmpId, e => setDocEmpId(e.target.value))}
            </Field>
            {docEmpId ? (
              String(docsEmpId) !== String(docEmpId) ? (
                <p className="px-1 py-2 text-[13px] text-[color:var(--text-muted)]">Loading documents…</p>
              ) : documents.length === 0 ? (
                <EmptyState icon={FileText} title="No documents uploaded">This employee has no documents yet.</EmptyState>
              ) : (
                <>
                  <div className="grid-box">
                    <table>
                      <thead>
                        <tr>
                          <th className="text-left">Type</th>
                          <th className="text-left">Document</th>
                          <th className="text-left">Number</th>
                          <th className="text-left">Expiry</th>
                          <th className="text-left">Verified</th>
                          <th className="w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {docPg.items.map(doc => (
                          <tr key={doc.id}>
                            <td><Badge tone={docTone[doc.documentType] || 'neutral'}>{lk.label('StaffDocumentType', doc.documentType)}</Badge></td>
                            <td className="font-bold">
                              {doc.documentName}
                              {doc.notes && <div className="text-[12px] font-normal text-[color:var(--text-muted)]">{doc.notes}</div>}
                            </td>
                            <td className="text-[color:var(--text-secondary)]">{doc.documentNumber ? `#${doc.documentNumber}` : '—'}</td>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{doc.expiryDate ? doc.expiryDate.split('T')[0] : '—'}</td>
                            <td>
                              {doc.isVerified
                                ? <Badge tone="success"><CheckCircle className="size-3" /> Verified</Badge>
                                : <span className="text-[color:var(--text-muted)]">—</span>}
                            </td>
                            <td>
                              <div className="flex justify-center gap-1">
                                {doc.hasFile && !doc.fileUrl && (
                                  <IconButton label="Download file" tone="primary" onClick={async () => {
                                    try { await dispatch(downloadEmployeeDocument({ empId: +docEmpId, docId: doc.id, filename: doc.documentName })).unwrap(); }
                                    catch (err) { toast.error(err || 'Failed to download'); }
                                  }}><Download className="size-3.5" /></IconButton>
                                )}
                                {doc.fileUrl && (
                                  <IconButton label="Open link" tone="primary" onClick={() => window.open(doc.fileUrl, '_blank', 'noopener')}><ExternalLink className="size-3.5" /></IconButton>
                                )}
                                {!doc.isVerified && (
                                  <IconButton label="Mark verified" onClick={async () => {
                                    try { await api.put(`/admin/staff/${docEmpId}/documents/${doc.id}/verify`); toast.success('Document verified'); dispatch(fetchEmployeeDocuments(docEmpId)); }
                                    catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to verify'); }
                                  }}><ShieldCheck className="size-3.5" /></IconButton>
                                )}
                                <IconButton label="Remove document" tone="danger" onClick={async () => {
                                  if (!window.confirm(`Remove "${doc.documentName}"?`)) return;
                                  try {
                                    await dispatch(deleteEmployeeDocument({ empId: +docEmpId, docId: doc.id })).unwrap();
                                    toast.success('Document removed');
                                  } catch (err) { toast.error(err || 'Failed'); }
                                }}><Trash2 className="size-3.5" /></IconButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination {...docPg} noun="documents" />
                </>
              )
            ) : (
              <EmptyState icon={FileText} title="Select an employee">Choose an employee to view their documents.</EmptyState>
            )}
          </div>

          {showAddDoc && (
            <AdminModal onClose={() => setShowAddDoc(false)}>
              <DialogPanel
                title="Add Document"
                onClose={() => setShowAddDoc(false)}
                width="max-w-md"
                footer={<>
                  <Button variant="secondary" onClick={() => setShowAddDoc(false)}>Cancel</Button>
                  <Button loading={savingDoc} onClick={async () => {
                    const documentType = docForm.documentType || docTypes[0]?.value;
                    if (!documentType) { toast.error('Document type required'); return; }
                    if (!docForm.documentName.trim() && !docFile) { toast.error('Document name required'); return; }
                    setSavingDoc(true);
                    try {
                      const payload = { empId: +docEmpId, ...docForm, documentType, documentName: docForm.documentName.trim(), expiryDate: docForm.expiryDate || null, notes: docForm.notes || null, documentNumber: docForm.documentNumber || null };
                      if (docFile) await dispatch(uploadEmployeeDocument({ ...payload, file: docFile })).unwrap();
                      else await dispatch(addEmployeeDocument(payload)).unwrap();
                      dispatch(fetchEmployeeDocuments(docEmpId));
                      toast.success(docFile ? 'Document uploaded' : 'Document added');
                      setShowAddDoc(false);
                      setDocForm(EMPTY_DOC);
                      setDocFile(null);
                    } catch (err) { toast.error(err || 'Failed to save document'); }
                    finally { setSavingDoc(false); }
                  }}>Save</Button>
                </>}
              >
                <div className="space-y-3">
                  <Field label="File" hint="PDF, JPG, PNG, WEBP or Word — up to 10 MB (optional)">
                    <input type="file" className={inp} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      onChange={e => setDocFile(e.target.files?.[0] || null)} />
                  </Field>
                  {[
                    { label: 'Document type', key: 'documentType', type: 'select', opts: docTypes },
                    { label: 'Document name', key: 'documentName', placeholder: 'e.g. Aadhaar Card', required: !docFile },
                    { label: 'Document number', key: 'documentNumber' },
                    { label: 'Expiry date', key: 'expiryDate', type: 'date' },
                    { label: 'Notes', key: 'notes' },
                  ].map(f => (
                    <Field key={f.key} label={f.label} required={f.required}>
                      {f.type === 'select'
                        ? <select className={inp} value={docForm[f.key] || f.opts[0]?.value || ''} onChange={e => setDocForm(d => ({ ...d, [f.key]: e.target.value }))}>
                            {lookupOptions(f.opts, docForm[f.key]).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        : <input type={f.type || 'text'} className={inp} value={docForm[f.key]}
                            placeholder={f.placeholder || ''}
                            onChange={e => setDocForm(d => ({ ...d, [f.key]: e.target.value }))} />
                      }
                    </Field>
                  ))}
                </div>
              </DialogPanel>
            </AdminModal>
          )}
        </Card>
      )}

      {/* ── TAB 3: Salary & Increments ───────────────────────────────────────── */}
      {tab === 3 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Salary Structure */}
          <Card title="Salary structure" bodyClassName="p-3 space-y-3">
            <Field label="Select employee">
              {employeeSelect(salEmpId, e => setSalEmpId(e.target.value))}
            </Field>
            {salEmpId ? (
              <>
                {!salHasStructure && String(salLoadedFor) === String(salEmpId) && (
                  <div className="rounded-[6px] bg-[color:var(--warning-bg)] px-3 py-2 text-[12px] text-[color:var(--warning)]">
                    No structure configured — showing the default split of the current salary. Save to configure it.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Basic salary (₹)', key: 'basicSalary' },
                    { label: 'HRA %', key: 'hraPercent' },
                    { label: 'TA amount (₹)', key: 'taAmount' },
                    { label: 'DA %', key: 'daPercent' },
                    { label: 'Special allowance (₹)', key: 'specialAllowance' },
                    { label: 'PF %', key: 'pfPercent' },
                    { label: 'ESIC %', key: 'esicPercent' },
                    { label: 'Professional tax (₹)', key: 'professionalTax' },
                  ].map(f => (
                    <Field key={f.key} label={f.label}>
                      <input type="number" className={inp} value={salForm[f.key]}
                        onChange={e => setSalForm(s => ({ ...s, [f.key]: e.target.value }))} />
                    </Field>
                  ))}
                  <Field label="Effective from" className="col-span-2">
                    <input type="date" className={inp} value={salForm.effectiveFrom}
                      onChange={e => setSalForm(s => ({ ...s, effectiveFrom: e.target.value }))} />
                  </Field>
                </div>
                {/* Live preview */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-3 text-[13px]">
                  <div className="flex justify-between"><span className="text-[color:var(--text-muted)]">Gross</span><span className="font-bold text-[color:var(--accent-strong)]">{salPreview ? `₹${Math.round(salPreview.gross).toLocaleString('en-IN')}` : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-[color:var(--text-muted)]">Net take-home</span><span className="font-bold text-[color:var(--success)]">{salPreview ? `₹${Math.round(salPreview.net).toLocaleString('en-IN')}` : '—'}</span></div>
                  <div className="flex justify-between text-[12px]"><span className="text-[color:var(--text-muted)]">PF deduction</span><span>{salPreview ? `₹${Math.round(salPreview.pf).toLocaleString('en-IN')}` : '—'}</span></div>
                  <div className="flex justify-between text-[12px]"><span className="text-[color:var(--text-muted)]">ESIC deduction</span><span>{salPreview ? (salPreview.esicApplicable ? `₹${Math.round(salPreview.esic).toLocaleString('en-IN')}` : 'Exempt') : '—'}</span></div>
                  <div className="flex justify-between text-[12px]"><span className="text-[color:var(--text-muted)]">Professional tax</span><span>{salPreview ? `₹${Math.round(salPreview.pt).toLocaleString('en-IN')}` : '—'}</span></div>
                </div>
                <Button className="w-full" loading={savingSal} onClick={async () => {
                  if (!(+salForm.basicSalary > 0)) { toast.error('Basic salary is required'); return; }
                  setSavingSal(true);
                  try {
                    await dispatch(updateSalaryStructure({
                      empId: +salEmpId,
                      basicSalary: +salForm.basicSalary, hraPercent: +salForm.hraPercent,
                      taAmount: +salForm.taAmount, daPercent: +salForm.daPercent,
                      specialAllowance: +salForm.specialAllowance, pfPercent: +salForm.pfPercent,
                      esicPercent: +salForm.esicPercent, professionalTax: +salForm.professionalTax,
                      effectiveFrom: salForm.effectiveFrom || null,
                    })).unwrap();
                    toast.success('Salary structure saved');
                    dispatch(fetchSalaryStructure(salEmpId));
                    reloadStaff();
                  } catch (err) { toast.error(err || 'Failed'); }
                  finally { setSavingSal(false); }
                }}>Save Salary Structure</Button>
              </>
            ) : (
              <EmptyState icon={Wallet} title="Select an employee">Choose an employee to manage salary.</EmptyState>
            )}
          </Card>

          {/* Increment History */}
          <Card
            title="Increment history"
            className="self-start"
            actions={<Button size="sm" onClick={() => setShowAddInc(true)} disabled={!salEmpId}><Plus className="size-3.5" /> Add Increment</Button>}
          >
            {increments.length === 0 ? (
              <EmptyState icon={TrendingUp} title={salEmpId ? 'No increment history' : 'Select an employee first'} />
            ) : (
              <div className="p-3">
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Date</th>
                        <th className="text-right">Old</th>
                        <th className="text-right">New</th>
                        <th className="text-right">Hike</th>
                        <th className="text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incPg.items.map(inc => (
                        <tr key={inc.id}>
                          <td className="whitespace-nowrap text-[color:var(--text-muted)]">{inc.effectiveDate?.split('T')[0]}</td>
                          <td className="text-right text-[color:var(--text-muted)]">₹{(inc.oldSalary || 0).toLocaleString()}</td>
                          <td className="text-right font-bold">₹{(inc.newSalary || 0).toLocaleString()}</td>
                          <td className="text-right font-bold text-[color:var(--success)]">+{inc.incrementPercent}%</td>
                          <td>
                            <div className="text-[color:var(--text-secondary)]">{inc.reason}</div>
                            <div className="text-[12px] text-[color:var(--text-muted)]">Approved by: {inc.approvedBy}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...incPg} noun="increments" />
              </div>
            )}

            {showAddInc && (
              <AdminModal onClose={() => setShowAddInc(false)}>
                <DialogPanel
                  title="Add Increment"
                  onClose={() => setShowAddInc(false)}
                  width="max-w-md"
                  footer={<>
                    <Button variant="secondary" onClick={() => setShowAddInc(false)}>Cancel</Button>
                    <Button onClick={async () => {
                      if (!incForm.newSalary || !incForm.effectiveDate || !incForm.reason.trim()) { toast.error('All fields required'); return; }
                      try {
                        await dispatch(createIncrement({ empId: +salEmpId, newSalary: +incForm.newSalary, reason: incForm.reason, effectiveDate: incForm.effectiveDate })).unwrap();
                        dispatch(fetchSalaryStructure(salEmpId));
                        dispatch(fetchIncrements(salEmpId));
                        reloadStaff();
                        toast.success('Increment recorded');
                        setShowAddInc(false);
                        setIncForm({ newSalary: '', reason: '', effectiveDate: '' });
                      } catch (err) { toast.error(err || 'Failed'); }
                    }}>Save</Button>
                  </>}
                >
                  <div className="space-y-3">
                    <Field label="New salary (₹)" required>
                      <input type="number" className={inp} value={incForm.newSalary} onChange={e => setIncForm(f => ({ ...f, newSalary: e.target.value }))} />
                    </Field>
                    <Field label="Effective date" required>
                      <input type="date" className={inp} value={incForm.effectiveDate} onChange={e => setIncForm(f => ({ ...f, effectiveDate: e.target.value }))} />
                    </Field>
                    <Field label="Reason" required>
                      <input className={inp} value={incForm.reason} onChange={e => setIncForm(f => ({ ...f, reason: e.target.value }))} placeholder="Annual appraisal, promotion, etc." />
                    </Field>
                  </div>
                </DialogPanel>
              </AdminModal>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 4: Transfers ─────────────────────────────────────────────────── */}
      {tab === 4 && (
        <Card
          title="Employee transfers"
          actions={<Button size="sm" onClick={() => setShowAddTransfer(true)}><Plus className="size-3.5" /> New Transfer</Button>}
        >
          {transfers.length === 0 ? (
            <EmptyState icon={ArrowRightLeft} title="No transfers recorded">Department, branch and designation moves will appear here.</EmptyState>
          ) : (
            <div className="p-3">
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Employee</th>
                      <th className="text-left">From Dept</th>
                      <th className="text-left">To Dept</th>
                      <th className="text-left">From Branch</th>
                      <th className="text-left">To Branch</th>
                      <th className="text-left">Designation Change</th>
                      <th className="text-left">Date</th>
                      <th className="text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trfPg.items.map(t => (
                      <tr key={t.id}>
                        <td>
                          <div className="font-bold">{t.employeeName}</div>
                          <div className="text-[12px] text-[color:var(--text-muted)]">{t.employeeCode}</div>
                        </td>
                        <td className="text-[color:var(--text-secondary)]">{t.fromDepartment}</td>
                        <td className="font-bold text-[color:var(--primary)]">{t.toDepartment}</td>
                        <td className="text-[color:var(--text-muted)]">{t.fromBranch || '—'}</td>
                        <td>{t.toBranch || '—'}</td>
                        <td className="text-[color:var(--text-secondary)]">
                          {t.fromDesignation && t.toDesignation ? `${t.fromDesignation} → ${t.toDesignation}` : '—'}
                        </td>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">{t.transferDate?.split('T')[0]}</td>
                        <td className="max-w-[180px] truncate text-[color:var(--text-secondary)]" title={t.reason}>{t.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...trfPg} noun="transfers" />
            </div>
          )}

          {showAddTransfer && (
            <AdminModal onClose={() => setShowAddTransfer(false)}>
              <DialogPanel
                title="New Transfer"
                onClose={() => setShowAddTransfer(false)}
                width="max-w-lg"
                footer={<>
                  <Button variant="secondary" onClick={() => setShowAddTransfer(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    const { empId, toDepartment, transferDate, reason } = transferForm;
                    if (!empId || !toDepartment || !transferDate || !reason.trim()) { toast.error('Required fields missing'); return; }
                    try {
                      await dispatch(transferEmployee({ empId: +empId, toDepartment, toBranch: transferForm.toBranch || null, toDesignation: transferForm.toDesignation || null, transferDate, reason })).unwrap();
                      reloadStaff();
                      dispatch(fetchTransfers());
                      dispatch(fetchDepartments());
                      toast.success('Transfer recorded');
                      setShowAddTransfer(false);
                      setTransferForm({ empId: '', toDepartment: '', toBranch: '', toDesignation: '', transferDate: '', reason: '' });
                    } catch (err) { toast.error(err || 'Failed'); }
                  }}>Save Transfer</Button>
                </>}
              >
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Employee" required className="col-span-2">
                    <select className={inp} value={transferForm.empId} onChange={e => setTransferForm(f => ({ ...f, empId: e.target.value }))}>
                      <option value="">— Select —</option>
                      {employees.filter(e => e.status === 'Active').map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.empId}) — {e.dept}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="To department" required>
                    <select className={inp} value={transferForm.toDepartment} onChange={e => setTransferForm(f => ({ ...f, toDepartment: e.target.value }))}>
                      <option value="">— Select —</option>
                      {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </Field>
                  <Field label="To branch">
                    <input className={inp} value={transferForm.toBranch} onChange={e => setTransferForm(f => ({ ...f, toBranch: e.target.value }))} placeholder="Branch name" />
                  </Field>
                  <Field label="New designation">
                    <input className={inp} value={transferForm.toDesignation}
                      onChange={e => setTransferForm(f => ({ ...f, toDesignation: e.target.value }))}
                      list="desg-transfer" />
                    <datalist id="desg-transfer">{designations.map(d => <option key={d.id} value={d.name} />)}</datalist>
                  </Field>
                  <Field label="Transfer date" required>
                    <input type="date" className={inp} value={transferForm.transferDate} onChange={e => setTransferForm(f => ({ ...f, transferDate: e.target.value }))} />
                  </Field>
                  <Field label="Reason" required className="col-span-2">
                    <input className={inp} value={transferForm.reason} onChange={e => setTransferForm(f => ({ ...f, reason: e.target.value }))} placeholder="Transfer reason" />
                  </Field>
                </div>
              </DialogPanel>
            </AdminModal>
          )}
        </Card>
      )}

      {/* Employee modals */}
      {showAddEmp && (
        <EmployeeModal departments={departments} designations={designations} employees={employees}
          onClose={() => setShowAddEmp(false)} onSave={handleAddEmployee} />
      )}
      {editEmp && (
        <EmployeeModal emp={editEmp} departments={departments} designations={designations} employees={employees}
          onClose={() => setEditEmp(null)} onSave={handleEditEmployee} />
      )}
    </div>
  );
}
