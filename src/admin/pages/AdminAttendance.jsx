import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Save, ChevronLeft, ChevronRight, Check, XCircle, UserCheck, UserX, Clock, Home, Users, Pencil, Trash2, FileClock, CalendarClock } from 'lucide-react';
import { SkPageHeader, SkTable } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import AdminModal from '@/admin/components/AdminModal';
import api from '@/services/api';
import {
  fetchAdminStaff, fetchAttendance, markAttendance,
  fetchShifts, createShift, updateShift, deleteShift,
  fetchShiftAssignments, assignShift,
  fetchRegularizations, submitRegularization, approveRegularization, rejectRegularization,
} from '@/store/slices/adminSlice';
import {
  PageHeader, Stat, Card, Badge, Button, IconButton, Tabs, Segmented, SearchInput,
  Toolbar, EmptyState, DialogPanel, Field, usePagination, Pagination, cn,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';

const inp = 'input-field w-full';
// Compact inline inputs for editable grid rows
const cellInp = 'h-7 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-2 text-[12px]';

const TABS = ['Daily', 'Monthly Sheet', 'Shifts', 'Regularization'];
const TAB_ICONS = [UserCheck, CalendarClock, Clock, FileClock];
// Status values/labels come from the AttendanceStatus enum (lookups); the maps below are visual only
const STATUS_SHORT = { Present: 'P', Absent: 'A', HalfDay: 'H', Late: 'L', WorkFromHome: 'WFH', Overtime: 'OT', FieldVisit: 'FV' };
const shortOf = (s) => STATUS_SHORT[s] || (s || '').replace(/[^A-Z]/g, '') || (s || '?')[0];
const PRESENT_LIKE = ['Present', 'WorkFromHome', 'FieldVisit', 'Overtime', 'Late'];
// Local (not UTC) yyyy-mm-dd so "today" is correct before 05:30 IST
const localISO = (d = new Date()) => d.toLocaleDateString('en-CA');
const ymd = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return { y, m, d }; };
function useStatusList() {
  const lk = useLookups();
  const list = lk.enumList('AttendanceStatus');
  return { statuses: list.map(s => s.value), statusOptions: list, label: (v) => lk.label('AttendanceStatus', v) };
}
// Status chip colours (WAH tokens)
const STATUS_COLOR = {
  Present:      'bg-[color:var(--success-bg)] text-[color:var(--success)]',
  Absent:       'bg-[color:var(--danger-bg)] text-[color:var(--danger)]',
  HalfDay:      'bg-[color:var(--warning-bg)] text-[color:var(--warning)]',
  Late:         'bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]',
  WorkFromHome: 'bg-[color:var(--info-bg)] text-[color:var(--info)]',
  Overtime:     'bg-[color:var(--primary-soft)] text-[color:var(--primary)]',
  FieldVisit:   'bg-[rgba(13,148,136,0.12)] text-[#0f766e]',
};
const STATUS_TONE = { Present: 'success', Absent: 'danger', HalfDay: 'warning', Late: 'accent', WorkFromHome: 'info', Overtime: 'primary', FieldVisit: 'neutral' };
const REG_TONE = { Pending: 'warning', Approved: 'success', Rejected: 'danger' };

function Avatar({ name }) {
  return (
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[11px] font-bold text-white">{(name || '?')[0]}</div>
  );
}

function padDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ── Daily Tab ─────────────────────────────────────────────────────────────────
function DailyTab({ employees, attendanceRecords }) {
  const dispatch = useDispatch();
  const { statusOptions } = useStatusList();
  const [date, setDate]     = useState(localISO());
  const [rows, setRows]     = useState({});
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!date) return;
    const { y, m } = ymd(date);
    dispatch(fetchAttendance({ month: m, year: y }));
  }, [date, dispatch]);

  useEffect(() => {
    const map = {};
    employees.forEach(e => { map[e.id] = { status: 'Present', inTime: '', outTime: '', overtimeHours: '0', remark: '' }; });
    attendanceRecords.forEach(r => {
      const d = r.date?.split('T')[0] || r.date;
      if (d === date) {
        map[r.employeeId] = { status: r.status || 'Present', inTime: r.inTime || '', outTime: r.outTime || '', overtimeHours: String(r.overtimeHours || 0), remark: r.remark || '' };
      }
    });
    setRows(map);
  }, [date, attendanceRecords, employees]);

  const setRow   = (id, k, v) => setRows(r => ({ ...r, [id]: { ...r[id], [k]: v } }));
  const markAll  = (status) => setRows(r => { const n = { ...r }; employees.forEach(e => { n[e.id] = { ...n[e.id], status }; }); return n; });

  const save = async () => {
    const entries = employees.map(e => ({
      employeeId: e.id, date,
      status: rows[e.id]?.status || 'Present',
      inTime: rows[e.id]?.inTime || null,
      outTime: rows[e.id]?.outTime || null,
      overtimeHours: parseFloat(rows[e.id]?.overtimeHours || 0),
      remark: rows[e.id]?.remark || null,
    }));
    if (!entries.length) { toast.error('No employees to save'); return; }
    setSaving(true);
    try {
      const res = await dispatch(markAttendance(entries)).unwrap();
      toast.success(`Attendance saved for ${res?.marked ?? entries.length} employee(s)`);
      const { y, m } = ymd(date);
      dispatch(fetchAttendance({ month: m, year: y }));
    }
    catch (err) { toast.error(err || 'Failed to save attendance'); }
    finally { setSaving(false); }
  };

  const filtered = employees.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.department?.toLowerCase().includes(search.toLowerCase()));
  const presentCount = employees.filter(e => PRESENT_LIKE.includes(rows[e.id]?.status)).length;
  const absentCount  = employees.filter(e => rows[e.id]?.status === 'Absent').length;
  const pg = usePagination(filtered, 50);

  return (
    <Card>
      <div className="space-y-3 p-3">
        <Toolbar>
          <Field className="w-44">
            <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} aria-label="Date" />
          </Field>
          <SearchInput value={search} onChange={setSearch} placeholder="Name or department…" className="max-w-sm" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => markAll('Present')}><UserCheck className="size-3.5 text-[color:var(--success)]" /> All Present</Button>
            <Button size="sm" variant="secondary" onClick={() => markAll('Absent')}><UserX className="size-3.5 text-[color:var(--danger)]" /> All Absent</Button>
            <Button size="sm" onClick={save} loading={saving}><Save className="size-3.5" /> Save</Button>
          </div>
        </Toolbar>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="success">Present: {presentCount}</Badge>
          <Badge tone="danger">Absent: {absentCount}</Badge>
          <Badge>Total: {employees.length}</Badge>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No employees found">{employees.length ? 'Try a different search.' : 'Add staff to start marking attendance.'}</EmptyState>
        ) : (
          <>
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Employee</th>
                    <th className="text-left">Status</th>
                    <th className="text-left">In Time</th>
                    <th className="text-left">Out Time</th>
                    <th className="text-right">OT Hrs</th>
                    <th className="text-left">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.items.map(emp => {
                    const row = rows[emp.id] || { status: 'Present', inTime: '', outTime: '', overtimeHours: '0', remark: '' };
                    return (
                      <tr key={emp.id}>
                        <td className="!py-1.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={emp.name} />
                            <div className="min-w-0">
                              <div className="font-bold">{emp.name}</div>
                              <div className="text-[12px] text-[color:var(--text-muted)]">{emp.department}</div>
                            </div>
                          </div>
                        </td>
                        <td className="!py-1.5">
                          <select value={row.status} onChange={e => setRow(emp.id, 'status', e.target.value)}
                            className={cn('h-7 cursor-pointer rounded-[4px] border-0 px-2 text-[12px] font-bold', STATUS_COLOR[row.status] || 'bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)]')}>
                            {lookupOptions(statusOptions, row.status).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="!py-1.5">
                          <input type="time" className={cellInp + ' w-28'}
                            value={row.inTime} onChange={e => setRow(emp.id, 'inTime', e.target.value)} />
                        </td>
                        <td className="!py-1.5">
                          <input type="time" className={cellInp + ' w-28'}
                            value={row.outTime} onChange={e => setRow(emp.id, 'outTime', e.target.value)} />
                        </td>
                        <td className="!py-1.5 text-right">
                          <input type="number" step="0.5" min="0" max="12"
                            className={cellInp + ' w-16 text-right'}
                            value={row.overtimeHours} onChange={e => setRow(emp.id, 'overtimeHours', e.target.value)} />
                        </td>
                        <td className="!py-1.5">
                          <input className={cellInp + ' w-40'}
                            value={row.remark} onChange={e => setRow(emp.id, 'remark', e.target.value)} placeholder="Remarks…" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} noun="employees" />
          </>
        )}
      </div>
    </Card>
  );
}

// ── Monthly Sheet Tab ─────────────────────────────────────────────────────────
function MonthlyTab({ employees, attendanceRecords }) {
  const dispatch = useDispatch();
  const { statuses, statusOptions } = useStatusList();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty]   = useState({});   // empId → { day: true } cells changed since load
  const today = new Date();
  const [month, setMonth]   = useState(today.getMonth());
  const [year, setYear]     = useState(today.getFullYear());
  const [att, setAtt]       = useState({});
  const [search, setSearch] = useState('');

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days        = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName   = new Date(year, month).toLocaleString('default', { month: 'long' });

  useEffect(() => { dispatch(fetchAttendance({ month: month + 1, year })); }, [month, year, dispatch]);

  useEffect(() => {
    const map = {};
    attendanceRecords.forEach(r => {
      const { y, m, d } = ymd(r.date);
      if (m - 1 === month && y === year) {
        if (!map[r.employeeId]) map[r.employeeId] = {};
        map[r.employeeId][d] = r.status || 'Present';
      }
    });
    setAtt(map);
    setDirty({});
  }, [attendanceRecords, month, year]);

  const cycleStatus = (empId, d) => {
    if (!statuses.length) return;
    const cur = att[empId]?.[d];
    const next = cur ? statuses[(statuses.indexOf(cur) + 1) % statuses.length] : statuses[0];
    setAtt(prev => ({ ...prev, [empId]: { ...prev[empId], [d]: next } }));
    setDirty(prev => ({ ...prev, [empId]: { ...prev[empId], [d]: true } }));
  };

  const getSummary = (empId) => {
    const vals = Object.values(att[empId] || {});
    return {
      P:   vals.filter(v => v === 'Present').length,
      A:   vals.filter(v => v === 'Absent').length,
      H:   vals.filter(v => v === 'HalfDay').length,
      L:   vals.filter(v => v === 'Late').length,
      WFH: vals.filter(v => v === 'WorkFromHome').length,
      OT:  vals.filter(v => v === 'Overtime').length,
    };
  };

  const save = async () => {
    const entries = [];
    // Only send the cells that were changed — re-sending loaded days would wipe their in/out times
    const original = {};
    attendanceRecords.forEach(r => { const { y, m, d } = ymd(r.date); if (m - 1 === month && y === year) original[`${r.employeeId}-${d}`] = r; });
    employees.forEach(emp => {
      days.forEach(d => {
        if (dirty[emp.id]?.[d] && att[emp.id]?.[d]) {
          const o = original[`${emp.id}-${d}`];
          entries.push({ employeeId: emp.id, date: padDate(year, month, d), status: att[emp.id][d], inTime: o?.inTime || null, outTime: o?.outTime || null, overtimeHours: o?.overtimeHours || 0, remark: o?.remark ?? null });
        }
      });
    });
    if (!entries.length) { toast('No changes to save.'); return; }
    setSaving(true);
    try {
      await dispatch(markAttendance(entries)).unwrap();
      toast.success(`Saved ${entries.length} change(s)`);
      dispatch(fetchAttendance({ month: month + 1, year }));
    }
    catch (err) { toast.error(err || 'Failed to save attendance'); }
    finally { setSaving(false); }
  };

  const filtered  = employees.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const pg = usePagination(filtered, 50);
  const SUM_COLS = [
    ['P', 'text-[color:var(--success)]'], ['A', 'text-[color:var(--danger)]'], ['H', 'text-[color:var(--warning)]'],
    ['L', 'text-[color:var(--accent-strong)]'], ['WFH', 'text-[color:var(--info)]'], ['OT', 'text-[color:var(--primary)]'],
  ];

  return (
    <Card>
      <div className="space-y-3 p-3">
        <Toolbar>
          <div className="flex items-center gap-1">
            <IconButton label="Previous month" onClick={prevMonth}><ChevronLeft className="size-4" /></IconButton>
            <span className="w-36 text-center text-[14px] font-bold">{monthName} {year}</span>
            <IconButton label="Next month" onClick={nextMonth}><ChevronRight className="size-4" /></IconButton>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search employee…" className="max-w-xs" />
          <Button size="sm" className="ml-auto" onClick={save} loading={saving}><Save className="size-3.5" /> Save</Button>
        </Toolbar>
        <div className="flex flex-wrap items-center gap-1.5">
          {statusOptions.map(o => (
            <span key={o.value} className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${STATUS_COLOR[o.value] || 'bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)]'}`}>{shortOf(o.value)} = {o.label}</span>
          ))}
          <span className="text-[12px] text-[color:var(--text-muted)]">Click a cell to cycle status</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No employees" />
        ) : (
          <>
            <div className="grid-box">
              <table className="text-[12px]">
                <thead>
                  <tr>
                    <th className="left-0 !z-[3] w-32 text-left">Employee</th>
                    {days.map(d => (
                      <th key={d} className={cn('w-8 !px-0.5 text-center', new Date(year, month, d).getDay() === 0 && '!text-[color:var(--danger)]')}>{d}</th>
                    ))}
                    {SUM_COLS.map(([s]) => (
                      <th key={s} className="w-10 !px-1.5 text-center">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pg.items.map(emp => {
                    const sum = getSummary(emp.id);
                    return (
                      <tr key={emp.id}>
                        <td className="sticky left-0 z-[1] !bg-[color:var(--surface)] !py-1.5">
                          <div className="whitespace-nowrap font-bold">{emp.name}</div>
                          <div className="text-[11px] text-[color:var(--text-muted)]">{emp.department}</div>
                        </td>
                        {days.map(d => {
                          const status = att[emp.id]?.[d] || '';
                          return (
                            <td key={d} className="!px-0.5 !py-1 text-center">
                              <button onClick={() => cycleStatus(emp.id, d)}
                                className={cn('h-6 w-8 rounded-[4px] text-[10px] font-bold transition-colors', status ? STATUS_COLOR[status] : 'bg-[color:var(--surface-secondary)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)]')}
                                title={status || 'Not marked'}>
                                {status ? shortOf(status) : '·'}
                              </button>
                            </td>
                          );
                        })}
                        {SUM_COLS.map(([k, c]) => (
                          <td key={k} className={cn('!px-1.5 text-center font-bold', c)}>{sum[k]}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} noun="employees" />
          </>
        )}
      </div>
    </Card>
  );
}

// ── Shifts Tab ────────────────────────────────────────────────────────────────
function ShiftsTab({ employees }) {
  const dispatch    = useDispatch();
  const shifts      = useSelector(s => s.admin.attendance?.shifts || []);
  const assignments = useSelector(s => s.admin.attendance?.shiftAssignments || []);

  const [showAdd, setShowAdd]     = useState(false);
  const [editShift, setEditShift] = useState(null);
  const [form, setForm] = useState({ name: '', startTime: '09:00', endTime: '18:00', lateThresholdMinutes: 15, overtimeThresholdMinutes: 30 });
  const [assignForm, setAssignForm] = useState({ employeeId: '', shiftId: '', effectiveFrom: localISO() });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { dispatch(fetchShifts()); dispatch(fetchShiftAssignments()); }, [dispatch]);

  const openAdd = (shift = null) => {
    if (shift) { setEditShift(shift); setForm({ name: shift.name, startTime: shift.startTime?.slice(0,5) || '09:00', endTime: shift.endTime?.slice(0,5) || '18:00', lateThresholdMinutes: shift.lateThresholdMinutes, overtimeThresholdMinutes: shift.overtimeThresholdMinutes }); }
    else { setEditShift(null); setForm({ name: '', startTime: '09:00', endTime: '18:00', lateThresholdMinutes: 15, overtimeThresholdMinutes: 30 }); }
    setShowAdd(true);
  };

  const saveShift = async () => {
    if (!form.name.trim()) { toast.error('Shift name required'); return; }
    try {
      if (editShift) { await dispatch(updateShift({ id: editShift.id, ...form })).unwrap(); }
      else { await dispatch(createShift(form)).unwrap(); }
      dispatch(fetchShifts());
      toast.success(editShift ? 'Updated' : 'Shift created');
      setShowAdd(false);
    } catch (err) { toast.error(err || 'Failed'); }
  };

  const doAssign = async () => {
    if (!assignForm.employeeId || !assignForm.shiftId) { toast.error('Select employee and shift'); return; }
    try {
      await dispatch(assignShift({ employeeId: parseInt(assignForm.employeeId), shiftId: parseInt(assignForm.shiftId), effectiveFrom: assignForm.effectiveFrom })).unwrap();
      dispatch(fetchShiftAssignments());
      toast.success('Shift assigned');
      setAssignForm(f => ({ ...f, employeeId: '', shiftId: '' }));
    } catch (err) { toast.error(err || 'Failed'); }
  };

  const activeAssignments = assignments.filter(a => !a.effectiveTo);
  const asgPg = usePagination(activeAssignments, 20);

  const removeShift = async (s) => {
    if (!window.confirm(`Delete shift "${s.name}"?`)) return;
    try { await dispatch(deleteShift(s.id)).unwrap(); dispatch(fetchShifts()); toast.success('Shift deleted'); }
    catch (err) { toast.error(err || 'Failed to delete shift'); }
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* Shift master */}
      <Card title="Shift master" actions={<Button size="sm" onClick={() => openAdd()}><Plus className="size-3.5" /> Add Shift</Button>}>
        {shifts.length === 0 ? (
          <EmptyState icon={Clock} title="No shifts created yet">Create a shift to assign it to employees.</EmptyState>
        ) : (
          <div className="p-3">
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Shift</th>
                    <th className="text-left">Timing</th>
                    <th className="text-left">Rules</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(s => (
                    <tr key={s.id}>
                      <td className="font-bold">{s.name}</td>
                      <td className="whitespace-nowrap text-[color:var(--text-secondary)]">{s.startTime?.slice(0,5)} → {s.endTime?.slice(0,5)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <Badge tone="accent">Late after {s.lateThresholdMinutes}min</Badge>
                          <Badge tone="primary">OT after {s.overtimeThresholdMinutes}min</Badge>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <IconButton label="Edit shift" tone="primary" onClick={() => openAdd(s)}><Pencil className="size-3.5" /></IconButton>
                          <IconButton label="Delete shift" tone="danger" onClick={() => removeShift(s)}><Trash2 className="size-3.5" /></IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Assign shifts */}
      <div className="space-y-3">
        <Card title="Assign shifts" bodyClassName="p-3 space-y-3">
          <Field label="Employee">
            <select className={inp} value={assignForm.employeeId} onChange={e => setAssignForm(f => ({ ...f, employeeId: e.target.value }))}>
              <option value="">— Select employee —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shift">
              <select className={inp} value={assignForm.shiftId} onChange={e => setAssignForm(f => ({ ...f, shiftId: e.target.value }))}>
                <option value="">— Select shift —</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime?.slice(0,5)}–{s.endTime?.slice(0,5)})</option>)}
              </select>
            </Field>
            <Field label="Effective from">
              <input type="date" className={inp} value={assignForm.effectiveFrom} onChange={e => setAssignForm(f => ({ ...f, effectiveFrom: e.target.value }))} />
            </Field>
          </div>
          <Button className="w-full" onClick={doAssign}>Assign Shift</Button>
        </Card>

        <Card title="Current assignments">
          {activeAssignments.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No active assignments" />
          ) : (
            <div className="p-3">
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Employee</th>
                      <th className="text-left">Shift</th>
                      <th className="text-left">From</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asgPg.items.map(a => (
                      <tr key={a.id}>
                        <td><div className="font-bold">{a.employeeName}</div><div className="text-[12px] text-[color:var(--text-muted)]">{a.department}</div></td>
                        <td><div>{a.shiftName}</div><div className="text-[12px] text-[color:var(--text-muted)]">{a.startTime?.slice(0,5)}–{a.endTime?.slice(0,5)}</div></td>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">{a.effectiveFrom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...asgPg} noun="assignments" />
            </div>
          )}
        </Card>
      </div>

      {showAdd && (
        <AdminModal onClose={() => setShowAdd(false)}>
          <DialogPanel
            title={editShift ? 'Edit Shift' : 'New Shift'}
            onClose={() => setShowAdd(false)}
            width="max-w-sm"
            footer={<>
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={saveShift}>Save</Button>
            </>}
          >
            <div className="space-y-3">
              <Field label="Name"><input className={inp} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Morning Shift" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start"><input type="time" className={inp} value={form.startTime} onChange={e => setF('startTime', e.target.value)} /></Field>
                <Field label="End"><input type="time" className={inp} value={form.endTime} onChange={e => setF('endTime', e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Late after (min)"><input type="number" className={inp} value={form.lateThresholdMinutes} onChange={e => setF('lateThresholdMinutes', +e.target.value)} /></Field>
                <Field label="OT after (min)"><input type="number" className={inp} value={form.overtimeThresholdMinutes} onChange={e => setF('overtimeThresholdMinutes', +e.target.value)} /></Field>
              </div>
            </div>
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}

// ── Regularization Tab ────────────────────────────────────────────────────────
const regParams = (f) => ({ status: f === 'All' ? undefined : f, limit: 500 });

function RegularizationTab({ employees }) {
  const dispatch = useDispatch();
  const { statusOptions, label: statusLabel } = useStatusList();
  const { regularizations = [] } = useSelector(s => s.admin.attendance || {});

  const [statusFilter, setStatusFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ employeeId: '', attendanceDate: '', requestedStatus: 'Present', requestedInTime: '', requestedOutTime: '', reason: '' });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    dispatch(fetchRegularizations(regParams(statusFilter)));
  }, [statusFilter, dispatch]);

  const approve = async (id) => {
    try {
      await dispatch(approveRegularization({ id, remarks: null })).unwrap();
      dispatch(fetchRegularizations(regParams(statusFilter)));
      dispatch(fetchAttendance({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }));
      toast.success('Approved — attendance updated');
    }
    catch (err) { toast.error(err || 'Failed'); }
  };
  const reject = async (id) => {
    try { await dispatch(rejectRegularization({ id, remarks: null })).unwrap(); dispatch(fetchRegularizations(regParams(statusFilter))); toast.success('Rejected'); }
    catch (err) { toast.error(err || 'Failed'); }
  };
  const submit = async () => {
    if (!form.employeeId || !form.attendanceDate || !form.reason.trim()) { toast.error('Fill required fields'); return; }
    try {
      await dispatch(submitRegularization({ employeeId: parseInt(form.employeeId), attendanceDate: form.attendanceDate, requestedStatus: form.requestedStatus, requestedInTime: form.requestedInTime || null, requestedOutTime: form.requestedOutTime || null, reason: form.reason })).unwrap();
      dispatch(fetchRegularizations(regParams(statusFilter)));
      toast.success('Submitted');
      setShowAdd(false);
    } catch (err) { toast.error(err || 'Failed'); }
  };

  const pg = usePagination(regularizations, 20);

  return (
    <Card>
      <div className="space-y-3 p-3">
        <Toolbar>
          <Segmented options={['All','Pending','Approved','Rejected']} value={statusFilter} onChange={setStatusFilter} />
          <Button size="sm" className="ml-auto" onClick={() => setShowAdd(true)}><Plus className="size-3.5" /> New Request</Button>
        </Toolbar>

        {regularizations.length === 0 ? (
          <EmptyState icon={FileClock} title="No regularization requests">Requests to correct attendance records will appear here.</EmptyState>
        ) : (
          <>
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Employee</th>
                    <th className="text-left">Date</th>
                    <th className="text-left">Requested</th>
                    <th className="text-left">In / Out</th>
                    <th className="text-left">Reason</th>
                    <th className="text-left">Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.items.map(r => (
                    <tr key={r.id}>
                      <td><div className="font-bold">{r.employeeName}</div><div className="text-[12px] text-[color:var(--text-muted)]">{r.department}</div></td>
                      <td className="whitespace-nowrap text-[color:var(--text-secondary)]">{r.attendanceDate}</td>
                      <td><Badge tone={STATUS_TONE[r.requestedStatus] ?? 'neutral'}>{statusLabel(r.requestedStatus)}</Badge></td>
                      <td className="whitespace-nowrap text-[color:var(--text-muted)]">{r.requestedInTime || '—'} / {r.requestedOutTime || '—'}</td>
                      <td className="max-w-40 truncate text-[color:var(--text-secondary)]" title={r.reason}>{r.reason}</td>
                      <td><Badge tone={REG_TONE[r.regStatus] ?? 'neutral'}>{r.regStatus}</Badge></td>
                      <td>
                        {r.regStatus === 'Pending' ? (
                          <div className="flex items-center justify-center gap-1">
                            <IconButton label="Approve" tone="primary" onClick={() => approve(r.id)}><Check className="size-3.5" /></IconButton>
                            <IconButton label="Reject" tone="danger" onClick={() => reject(r.id)}><XCircle className="size-3.5" /></IconButton>
                          </div>
                        ) : <span className="block text-center text-[12px] text-[color:var(--text-muted)]">{r.reviewedBy || '—'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} noun="requests" />
          </>
        )}
      </div>

      {showAdd && (
        <AdminModal onClose={() => setShowAdd(false)}>
          <DialogPanel
            title="Submit Regularization"
            onClose={() => setShowAdd(false)}
            width="max-w-md"
            footer={<>
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={submit}>Submit</Button>
            </>}
          >
            <div className="space-y-3">
              <Field label="Employee" required>
                <select className={inp} value={form.employeeId} onChange={e => setF('employeeId', e.target.value)}>
                  <option value="">— Select —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" required><input type="date" className={inp} value={form.attendanceDate} onChange={e => setF('attendanceDate', e.target.value)} /></Field>
                <Field label="Requested status">
                  <select className={inp} value={form.requestedStatus} onChange={e => setF('requestedStatus', e.target.value)}>
                    {lookupOptions(statusOptions, form.requestedStatus).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="In time"><input type="time" className={inp} value={form.requestedInTime} onChange={e => setF('requestedInTime', e.target.value)} /></Field>
                <Field label="Out time"><input type="time" className={inp} value={form.requestedOutTime} onChange={e => setF('requestedOutTime', e.target.value)} /></Field>
              </div>
              <Field label="Reason" required>
                <textarea className="input-field w-full resize-none" rows={3} value={form.reason} onChange={e => setF('reason', e.target.value)} placeholder="Explain the reason…" />
              </Field>
            </div>
          </DialogPanel>
        </AdminModal>
      )}
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminAttendance() {
  const dispatch         = useDispatch();
  const staffItems       = useSelector(s => s.admin.staff?.items || []);
  const attendanceRecords = useSelector(s => s.admin.attendance?.records || []);
  const [tab, setTab]    = useState(0);

  // Always load the full active roster (other pages may have left a filtered / paged list in the store)
  useEffect(() => { dispatch(fetchAdminStaff({ limit: 1000 })); }, [dispatch]);

  // "Today" KPIs use their own fetch of the current month — the shared records store follows whichever
  // month the Monthly tab is showing. Re-fetched whenever the store changes (i.e. after any marking).
  const [todayRecs, setTodayRecs] = useState([]);
  useEffect(() => {
    let alive = true;
    const now = new Date();
    const todayStr = localISO(now);
    api.get('/admin/attendance', { params: { month: now.getMonth() + 1, year: now.getFullYear() } })
      .then((res) => {
        const p = res.data?.data;
        const list = p?.items || (Array.isArray(p) ? p : []);
        if (alive) setTodayRecs(list.filter((r) => String(r.date).slice(0, 10) === todayStr));
      })
      .catch((err) => { if (alive) toast.error(err.response?.data?.error?.message || "Failed to load today's attendance"); });
    return () => { alive = false; };
  }, [attendanceRecords]);

  const employees = staffItems.filter(e => e.isActive !== false).map(e => ({ id: e.id, name: e.name || '', department: e.department || '' }));

  const loading = useSelector(s => s.admin.loading);

  if (loading && !staffItems.length) return (
    <div className="space-y-6"><SkPageHeader /><SkTable rows={8} cols={6} /></div>
  );

  const presentToday = todayRecs.filter(r => PRESENT_LIKE.includes(r.status)).length;
  const absentToday  = todayRecs.filter(r => r.status === 'Absent').length;
  const lateToday    = todayRecs.filter(r => r.status === 'Late').length;
  const wfhToday     = todayRecs.filter(r => r.status === 'WorkFromHome').length;

  return (
    <div className="space-y-4">
      <PageHeader title="Attendance" description="Daily marking, shifts, overtime & regularization" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Present today" value={presentToday} icon={UserCheck} tone="success" />
        <Stat label="Absent today" value={absentToday} icon={UserX} tone="danger" />
        <Stat label="Late today" value={lateToday} icon={Clock} tone="accent" />
        <Stat label="WFH today" value={wfhToday} icon={Home} tone="info" />
      </div>

      <Tabs
        items={TABS.map((t, i) => ({ value: i, label: t, icon: TAB_ICONS[i] }))}
        value={tab}
        onChange={setTab}
      />

      {tab === 0 && <DailyTab employees={employees} attendanceRecords={attendanceRecords} />}
      {tab === 1 && <MonthlyTab employees={employees} attendanceRecords={attendanceRecords} />}
      {tab === 2 && <ShiftsTab employees={employees} />}
      {tab === 3 && <RegularizationTab employees={employees} />}
    </div>
  );
}
