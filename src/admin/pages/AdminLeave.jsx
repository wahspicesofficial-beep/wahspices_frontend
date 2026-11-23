import { useState, useEffect } from 'react';
import { Plus, Check, X, Trash2, Hourglass, CheckCircle2, CalendarDays, ClipboardList, Users } from 'lucide-react';
import { SkPageHeader, SkTabs } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import AdminModal from '@/admin/components/AdminModal';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchLeaveApplications, approveLeave, rejectLeave,
  fetchHolidays, addHoliday, deleteHoliday,
  fetchLeaveBalances, submitLeaveApplication,
  fetchAdminStaff,
} from '@/store/slices/adminSlice';
import {
  PageHeader, Stat, Card, Badge, statusTone, Button, IconButton, Tabs, Segmented,
  Toolbar, EmptyState, DialogPanel, Field, usePagination, Pagination,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';

// Purely visual: badge tone per leave type (labels/values come from the LeaveType enum via lookups)
const LEAVE_TONES = ['info', 'success', 'danger', 'accent', 'primary', 'warning', 'neutral'];
// Short code from the label: "Casual Leave" → "CL"
const leaveCode = (label = '') => label.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 3);
const STATUS_TONE = {
  Pending:  'warning',
  Approved: 'success',
  Rejected: 'danger',
  Cancelled:'neutral',
};
const HOLIDAY_TYPE_TONE = {
  National: 'info',
  Optional: 'neutral',
  Festival: 'accent',
};
const EMPTY_APPLY   = { employeeId: '', leaveType: '', fromDate: '', toDate: '', reason: '' };
const EMPTY_HOLIDAY = { name: '', date: '', type: '' };
const sameMonth = (iso, ref) => { if (!iso) return false; const d = new Date(iso); return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth(); };

export default function AdminLeave() {
  const dispatch = useAppDispatch();

  const applications = useAppSelector(s => s.admin.leave.applications);
  const holidays     = useAppSelector(s => s.admin.leave.holidays);
  const balances     = useAppSelector(s => s.admin.leave.balances);
  const loading      = useAppSelector(s => s.admin.loading);
  const staff        = useAppSelector(s => s.admin.staff.items);
  const lk = useLookups();
  const leaveTypes   = lk.enumList('LeaveType').map((t, i) => ({ ...t, code: leaveCode(t.label), tone: LEAVE_TONES[i % LEAVE_TONES.length] }));
  const leaveTypeMap = Object.fromEntries(leaveTypes.map(t => [t.value, t]));
  const holidayTypes = lk.list('HolidayType');
  const activeStaff  = staff.filter(s => s.isActive !== false);

  const [tab, setTab]               = useState('applications');
  const [statusFilter, setStatusFilter] = useState('All');
  const [applyModal, setApplyModal] = useState(false);
  const [applyForm, setApplyForm]   = useState(EMPTY_APPLY);
  const [applying, setApplying]     = useState(false);
  const [newHoliday, setNewHoliday] = useState(EMPTY_HOLIDAY);
  const [addingHoliday, setAddingHoliday] = useState(false);

  useEffect(() => {
    dispatch(fetchLeaveApplications({ limit: 1000 }));
    dispatch(fetchHolidays());
    dispatch(fetchLeaveBalances());
    dispatch(fetchAdminStaff({ limit: 1000 }));
  }, [dispatch]);

  const filteredApps = statusFilter === 'All'
    ? applications
    : applications.filter(a => a.status === statusFilter);

  const today    = new Date();
  const pending  = applications.filter(a => a.status === 'Pending').length;
  // approved during the current month (approval date; falls back to leave start for older rows without one)
  const approved = applications.filter(a => a.status === 'Approved' && sameMonth(a.actionAt || a.fromDate, today)).length;

  const appsPg = usePagination(filteredApps, 20);
  const balPg  = usePagination(balances, 20);
  const holPg  = usePagination(holidays, 20);

  const closeApplyModal = () => { setApplyModal(false); setApplyForm(EMPTY_APPLY); };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!applyForm.employeeId || !applyForm.fromDate || !applyForm.toDate || !applyForm.reason) {
      toast.error('All fields are required');
      return;
    }
    setApplying(true);
    const res = await dispatch(submitLeaveApplication({
      employeeId: Number(applyForm.employeeId),
      leaveType: applyForm.leaveType || leaveTypes[0]?.value,
      fromDate: applyForm.fromDate,
      toDate: applyForm.toDate,
      reason: applyForm.reason,
    }));
    setApplying(false);
    if (submitLeaveApplication.fulfilled.match(res)) {
      toast.success('Leave application submitted!', { icon: '✅', style: { borderRadius: '12px' } });
      setApplyModal(false);
      setApplyForm(EMPTY_APPLY);
      dispatch(fetchLeaveApplications({ limit: 1000 }));
    } else {
      toast.error(res.payload || 'Failed to submit leave');
    }
  };

  const handleApprove = async (id) => {
    const res = await dispatch(approveLeave({ id, remarks: '' }));
    if (approveLeave.fulfilled.match(res)) {
      toast.success('Leave Approved!', { icon: '✅', style: { borderRadius: '12px' } });
      dispatch(fetchLeaveApplications({ limit: 1000 }));
      dispatch(fetchLeaveBalances());
    } else {
      toast.error(res.payload || 'Failed to approve leave');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Reason for rejection (optional)');
    if (reason === null) return;
    const res = await dispatch(rejectLeave({ id, remarks: reason.trim() }));
    if (rejectLeave.fulfilled.match(res)) {
      toast.success('Leave Rejected!', { icon: '❌', style: { borderRadius: '12px' } });
      dispatch(fetchLeaveApplications({ limit: 1000 }));
    } else {
      toast.error(res.payload || 'Failed to reject leave');
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast.error('Please fill in holiday name and date');
      return;
    }
    setAddingHoliday(true);
    const res = await dispatch(addHoliday({ ...newHoliday, type: newHoliday.type || holidayTypes[0]?.value }));
    setAddingHoliday(false);
    if (addHoliday.fulfilled.match(res)) {
      toast.success('Holiday added!', { style: { borderRadius: '12px' } });
      setNewHoliday(EMPTY_HOLIDAY);
      dispatch(fetchHolidays());
    } else {
      toast.error(res.payload || 'Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    const res = await dispatch(deleteHoliday(id));
    if (deleteHoliday.fulfilled.match(res)) {
      toast.success('Holiday deleted!', { style: { borderRadius: '12px' } });
    } else {
      toast.error(res.payload || 'Failed to delete holiday');
    }
  };

  if (loading && applications.length === 0) return <div className="space-y-6"><SkPageHeader /><SkTabs tabCount={3} contentRows={6} /></div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leave & Holidays"
        description="Leave applications, balances, approval workflow and holiday calendar"
        actions={<Button onClick={() => setApplyModal(true)}><Plus className="size-4" /> Apply Leave</Button>}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pending approvals" value={pending} icon={Hourglass} tone="warning" />
        <Stat label="Approved (this month)" value={approved} icon={CheckCircle2} tone="success" />
        <Stat label="Holidays (this year)" value={holidays.length} icon={CalendarDays} tone="info" />
        <Stat label="Leave types" value={leaveTypes.length} icon={ClipboardList} tone="primary" />
      </div>

      {/* Leave type legend */}
      <div className="flex flex-wrap items-center gap-1.5">
        {leaveTypes.map(lt => (
          <Badge key={lt.value} tone={lt.tone}><b>{lt.code}</b> <span className="font-normal">{lt.label}</span></Badge>
        ))}
      </div>

      <Tabs
        items={[
          { value: 'applications', label: 'Leave Applications', count: applications.length },
          { value: 'balances', label: 'Leave Balances', count: balances.length },
          { value: 'holidays', label: 'Holiday Calendar', count: holidays.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Applications Tab */}
      {tab === 'applications' && (
        <Card>
          <div className="space-y-3 p-3">
            <Toolbar>
              <Segmented
                options={['All','Pending','Approved','Rejected'].map(s => ({
                  value: s,
                  label: s === 'All' ? 'All' : `${s} (${applications.filter(a => a.status === s).length})`,
                }))}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              {loading && <span className="text-[12px] text-[color:var(--text-muted)]">Loading…</span>}
            </Toolbar>

            {filteredApps.length === 0 && !loading ? (
              <EmptyState icon={ClipboardList} title="No applications found">
                {applications.length ? 'Try another status filter.' : 'Leave applications will appear here.'}
              </EmptyState>
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Employee</th>
                        <th className="text-left">Type</th>
                        <th className="text-left">From</th>
                        <th className="text-left">To</th>
                        <th className="text-right">Days</th>
                        <th className="text-left">Reason</th>
                        <th className="text-left">Status</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appsPg.items.map(app => {
                        const lt = leaveTypeMap[app.leaveType];
                        const statusLabel = app.status ?? 'Pending';
                        const fromStr = app.fromDate ? new Date(app.fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
                        const toStr   = app.toDate   ? new Date(app.toDate  ).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
                        return (
                          <tr key={app.id}>
                            <td className="font-bold">{app.employeeName}</td>
                            <td><Badge tone={lt?.tone ?? 'neutral'} title={lt?.label}>{lt?.code ?? app.leaveType}</Badge></td>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fromStr}</td>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{toStr}</td>
                            <td className="text-right font-bold">{app.totalDays}</td>
                            <td className="max-w-[180px] truncate text-[color:var(--text-secondary)]" title={app.reason}>{app.reason}</td>
                            <td>
                              <Badge tone={STATUS_TONE[statusLabel] ?? statusTone(statusLabel)}>{statusLabel}</Badge>
                              {app.rejectionReason && <div className="mt-0.5 max-w-[160px] truncate text-[11px] text-[color:var(--text-muted)]" title={app.rejectionReason}>{app.rejectionReason}</div>}
                            </td>
                            <td>
                              {app.status === 'Pending' && (
                                <div className="flex items-center justify-center gap-1">
                                  <IconButton label="Approve" tone="primary" onClick={() => handleApprove(app.id)}><Check className="size-3.5" /></IconButton>
                                  <IconButton label="Reject" tone="danger" onClick={() => handleReject(app.id)}><X className="size-3.5" /></IconButton>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination {...appsPg} noun="applications" />
              </>
            )}
          </div>
        </Card>
      )}

      {/* Balances Tab */}
      {tab === 'balances' && (
        <Card>
          <div className="p-3">
            {loading && balances.length === 0 ? (
              <p className="px-1 py-2 text-[13px] text-[color:var(--text-muted)]">Loading balances…</p>
            ) : balances.length === 0 ? (
              <EmptyState icon={Users} title="No balance data">Employees will appear automatically.</EmptyState>
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Employee</th>
                        <th className="text-left">Department</th>
                        <th className="text-right">Casual Leave</th>
                        <th className="text-right">Earned Leave</th>
                        <th className="text-right">Sick Leave</th>
                        <th className="text-right">Used (YTD)</th>
                        <th className="text-right">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balPg.items.map(b => (
                        <tr key={b.employeeId}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[11px] font-bold text-white">
                                {(b.employeeName || '?')[0]}
                              </div>
                              <span className="font-bold">{b.employeeName}</span>
                            </div>
                          </td>
                          <td className="text-[color:var(--text-muted)]">{b.department}</td>
                          <td className="text-right">
                            <span className="font-bold text-[color:var(--info)]">{b.casualLeave - b.usedCasual}</span>
                            <span className="ml-0.5 text-[color:var(--text-muted)]">/{b.casualLeave}</span>
                          </td>
                          <td className="text-right">
                            <span className="font-bold text-[color:var(--success)]">{b.earnedLeave - b.usedEarned}</span>
                            <span className="ml-0.5 text-[color:var(--text-muted)]">/{b.earnedLeave}</span>
                          </td>
                          <td className="text-right">
                            <span className="font-bold text-[color:var(--danger)]">{b.sickLeave - b.usedSick}</span>
                            <span className="ml-0.5 text-[color:var(--text-muted)]">/{b.sickLeave}</span>
                          </td>
                          <td className="text-right">{b.totalUsed}</td>
                          <td className="text-right font-bold text-[color:var(--primary)]">{b.totalAvailable}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...balPg} noun="employees" />
              </>
            )}
          </div>
        </Card>
      )}

      {/* Holidays Tab */}
      {tab === 'holidays' && (
        <div className="space-y-4">
          {/* Add Holiday Form */}
          <Card title="Add holiday" bodyClassName="p-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Holiday name" className="min-w-[180px] flex-1">
                <input
                  type="text"
                  value={newHoliday.name}
                  onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Diwali"
                  className="input-field"
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={e => setNewHoliday(p => ({ ...p, date: e.target.value }))}
                  className="input-field"
                />
              </Field>
              <Field label="Type">
                <select
                  value={newHoliday.type || holidayTypes[0]?.value || ''}
                  onChange={e => setNewHoliday(p => ({ ...p, type: e.target.value }))}
                  className="input-field"
                >
                  {lookupOptions(holidayTypes, newHoliday.type).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Button onClick={handleAddHoliday} disabled={addingHoliday} loading={addingHoliday}>
                {!addingHoliday && <Plus className="size-4" />} Add Holiday
              </Button>
            </div>
          </Card>

          {/* Holiday List */}
          <Card title="Holiday calendar">
            {holidays.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No holidays added yet">Add national, optional or festival holidays above.</EmptyState>
            ) : (
              <div className="p-3">
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Date</th>
                        <th className="text-left">Holiday Name</th>
                        <th className="text-left">Type</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holPg.items.map(h => (
                        <tr key={h.id ?? h.date}>
                          <td className="whitespace-nowrap font-bold">
                            {h.date ? new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td>{h.name}</td>
                          <td><Badge tone={HOLIDAY_TYPE_TONE[h.type] ?? 'neutral'}>{lk.label('HolidayType', h.type)}</Badge></td>
                          <td>
                            <div className="flex justify-center">
                              <IconButton label="Delete holiday" tone="danger" onClick={() => handleDeleteHoliday(h.id)}><Trash2 className="size-3.5" /></IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...holPg} noun="holidays" />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Apply Leave Modal */}
      {applyModal && (
        <AdminModal onClose={closeApplyModal}>
          <DialogPanel
            title="Apply Leave"
            onClose={closeApplyModal}
            width="max-w-md"
            footer={<>
              <Button variant="secondary" onClick={closeApplyModal}>Cancel</Button>
              <Button type="submit" form="apply-leave-form" disabled={applying} loading={applying}>
                {applying ? 'Submitting…' : 'Submit Application'}
              </Button>
            </>}
          >
            <form id="apply-leave-form" onSubmit={handleApply} className="space-y-3">
              <Field label="Employee" required>
                <select
                  value={applyForm.employeeId}
                  onChange={e => setApplyForm(p => ({ ...p, employeeId: e.target.value }))}
                  className="input-field"
                  required
                >
                  <option value="">Select employee…</option>
                  {activeStaff.map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {s.department}</option>
                  ))}
                </select>
              </Field>
              <Field label="Leave type" required>
                <select
                  value={applyForm.leaveType || leaveTypes[0]?.value || ''}
                  onChange={e => setApplyForm(p => ({ ...p, leaveType: e.target.value }))}
                  className="input-field"
                  required
                >
                  {lookupOptions(leaveTypes, applyForm.leaveType).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From date" required>
                  <input
                    type="date"
                    value={applyForm.fromDate}
                    onChange={e => setApplyForm(p => ({ ...p, fromDate: e.target.value }))}
                    className="input-field"
                    required
                  />
                </Field>
                <Field label="To date" required>
                  <input
                    type="date"
                    value={applyForm.toDate}
                    min={applyForm.fromDate}
                    onChange={e => setApplyForm(p => ({ ...p, toDate: e.target.value }))}
                    className="input-field"
                    required
                  />
                </Field>
              </div>
              {applyForm.fromDate && applyForm.toDate && (
                <div className="rounded-[6px] bg-[color:var(--primary-soft)] px-3 py-2 text-[12px] font-bold text-[color:var(--primary)]">
                  {Math.max(0, Math.floor((new Date(applyForm.toDate) - new Date(applyForm.fromDate)) / 86400000) + 1)} day(s) leave
                </div>
              )}
              <Field label="Reason" required>
                <textarea
                  rows={3}
                  value={applyForm.reason}
                  onChange={e => setApplyForm(p => ({ ...p, reason: e.target.value }))}
                  className="input-field resize-none"
                  placeholder="Reason for leave…"
                  required
                />
              </Field>
            </form>
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}
