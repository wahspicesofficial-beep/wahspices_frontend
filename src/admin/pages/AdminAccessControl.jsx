import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/services/api';
import { useDispatch, useSelector } from 'react-redux';
import { SkPageHeader, SkTabs } from '@/components/ui/Skeleton';
import {
  fetchRoles, createRole, updateRole, deleteRole, seedRoles,
  fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser,
  resetAdminPassword, saveUserPermissions, unlockAdminUser,
  fetchAuditLog, fetchSessions, revokeSession, revokeOtherSessions,
  setup2FA, enable2FA, disable2FA, fetchAdminMe,
} from '@/store/slices/adminSlice';
import { isSuperAdmin } from '@/admin/components/AdminLayout';
import toast from 'react-hot-toast';
import {
  Shield, Users, BookOpen, Laptop, KeyRound,
  Plus, Edit2, Trash2, RefreshCw, Unlock, Eye, EyeOff,
  CheckCircle, XCircle, QrCode, Copy, Settings, Search, AlertTriangle, Info, Lock, RotateCcw,
} from 'lucide-react';
import AdminModal from '@/admin/components/AdminModal';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, Toolbar, EmptyState,
  DialogPanel, Field, usePagination, Pagination, Skeleton, cn,
} from '@/admin/ui';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'users',    label: 'Users',              icon: Users    },
  { key: 'roles',    label: 'Roles & Permissions', icon: Shield   },
  { key: 'audit',    label: 'Audit Log',           icon: BookOpen },
  { key: 'sessions', label: 'Sessions',            icon: Laptop   },
  { key: '2fa',      label: '2FA Settings',        icon: KeyRound },
];

// Permission modules, grouped exactly like the admin sidebar, come from GET /admin/roles/module-groups
// (backend DefaultRoles = one source of truth). This fallback is only used until that loads.
const FALLBACK_GROUPS = [
  { title: 'Overview', modules: [['Dashboard', 'Dashboard']] },
  { title: 'Sales & Billing', modules: [['Orders', 'Orders'], ['Returns', 'Returns'], ['Payments', 'Payments'], ['WebsiteUsers', 'Website Users'], ['Billing', 'Billing & Invoice'], ['GST', 'GST & Tax'], ['Customers', 'Customers & CRM'], ['FieldSales', 'Field Sales']] },
  { title: 'Inventory & Production', modules: [['Inventory', 'Inventory'], ['Production', 'Production'], ['Purchase', 'Purchase'], ['Barcode', 'Barcode']] },
  { title: 'HR Management', modules: [['Staff', 'Staff'], ['Attendance', 'Attendance'], ['Leave', 'Leave'], ['Payroll', 'Payroll'], ['Expenses', 'Expenses']] },
  { title: 'Products & Content', modules: [['Products', 'Products'], ['Categories', 'Categories'], ['Blog', 'Blog'], ['Recipes', 'Recipes'], ['Reviews', 'Reviews']] },
  { title: 'Website', modules: [['Website', 'Website Content'], ['Feedback', 'Feedback'], ['Messages', 'Contact Messages']] },
  { title: 'Reports & System', modules: [['Analytics', 'Analytics'], ['Reports', 'Reports'], ['AccessControl', 'Access Control'], ['Settings', 'Settings']] },
].map(g => ({ title: g.title, modules: g.modules.map(([key, label]) => ({ key, label })) }));

// Stored role names that mean "Super Admin" (the bootstrap account uses the legacy name "Admin").
const isSuperRole = (name) => name === 'Super Admin' || name === 'Admin';

// Stored on the role record — values are persisted, keep them unchanged.
const ROLE_COLOR_OPTIONS = [
  { label: 'Red',    value: 'bg-red-50 text-red-700'       },
  { label: 'Blue',   value: 'bg-blue-50 text-blue-700'     },
  { label: 'Green',  value: 'bg-green-50 text-green-700'   },
  { label: 'Orange', value: 'bg-orange-50 text-orange-700' },
  { label: 'Purple', value: 'bg-purple-50 text-purple-700' },
  { label: 'Pink',   value: 'bg-pink-50 text-pink-700'     },
  { label: 'Yellow', value: 'bg-yellow-50 text-yellow-700' },
  { label: 'Gray',   value: 'bg-gray-100 text-gray-700'    },
];

const inp = 'input-field';
const AUDIT_PAGE_SIZE = 25;

const fmtShort = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const fmtFull  = (d) => (d ? new Date(d).toLocaleString('en-IN') : '—');

// ── Sub-components ────────────────────────────────────────────────────────────

/** Modal = AdminModal backdrop + DialogPanel (title bar, scroll body, footer) */
const Modal = ({ title, onClose, children, wide, footer }) => (
  <AdminModal onClose={onClose}>
    <DialogPanel title={title} onClose={onClose} width={wide ? 'max-w-2xl' : 'max-w-lg'} footer={footer}>
      {children}
    </DialogPanel>
  </AdminModal>
);

const RoleBadge = ({ roleName, color }) => (
  <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-bold leading-[1.3]', color || 'bg-gray-100 text-gray-600')}>
    {roleName}
  </span>
);

/** Callout strip used inside the 2FA card */
const Callout = ({ tone = 'info', icon: Icon = Info, children }) => {
  const tones = {
    info:    'border-[rgba(30,95,168,0.22)] bg-[color:var(--info-bg)] [&>svg]:text-[color:var(--info)]',
    warning: 'border-[rgba(180,83,15,0.25)] bg-[color:var(--warning-bg)] [&>svg]:text-[color:var(--warning)]',
    success: 'border-[rgba(31,122,80,0.25)] bg-[color:var(--success-bg)] [&>svg]:text-[color:var(--success)]',
  };
  return (
    <div className={cn('flex items-start gap-2 rounded-[6px] border px-3 py-2.5 text-[13px] text-[color:var(--text-primary)]', tones[tone])}>
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

/** Group checkbox that shows the indeterminate state when only some modules are on */
const GroupCheckbox = ({ checked, indeterminate, disabled, onChange, label }) => (
  <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={onChange}
    ref={el => { if (el) el.indeterminate = indeterminate; }}
    className="size-4 accent-[#1a5c2e]" />
);

/**
 * Permission matrix grouped like the sidebar, with select-all per group.
 * `baseline` (optional) = the role's values: modules that differ are marked as per-user overrides.
 * `onChange(patch)` receives { moduleKey: bool, … }.
 */
const PermissionMatrix = ({ groups, values, disabled, onChange, baseline }) => (
  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
    {groups.map(g => {
      const keys = g.modules.map(m => m.key);
      const on = keys.filter(k => values[k]).length;
      const all = on === keys.length;
      return (
        <div key={g.title} className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)]">
          <label className={cn('flex items-center gap-2 border-b border-[color:var(--border)] px-2.5 py-2', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
            <GroupCheckbox label={`Select all in ${g.title}`} checked={all} indeterminate={on > 0 && !all} disabled={disabled}
              onChange={() => !disabled && onChange(Object.fromEntries(keys.map(k => [k, !all])))} />
            <span className="flex-1 text-[12px] font-bold uppercase tracking-wide text-[color:var(--text-secondary)]">{g.title}</span>
            <span className="text-[11px] text-[color:var(--text-muted)]">{on}/{keys.length}</span>
          </label>
          <div className="space-y-0.5 p-1.5">
            {g.modules.map(m => {
              const checked = !!values[m.key];
              const overridden = baseline && checked !== !!baseline[m.key];
              return (
                <label key={m.key}
                  className={cn(
                    'flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] transition-colors',
                    checked ? 'bg-[color:var(--primary-soft)] text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]',
                    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-[color:var(--surface-hover)]',
                  )}>
                  <input type="checkbox" checked={checked} disabled={disabled}
                    onChange={() => !disabled && onChange({ [m.key]: !checked })}
                    className="size-4 accent-[#1a5c2e]" />
                  <span className="flex-1 font-bold">{m.label}</span>
                  {overridden && <Badge tone="accent" className="!px-1.5 !text-[10px]">{checked ? 'granted' : 'removed'}</Badge>}
                </label>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
);

/** "This user will see: …" — the sidebar modules a permission map unlocks, by sidebar group */
const AccessPreview = ({ groups, values, superAdmin, title = 'This user will see' }) => {
  const visible = groups
    .map(g => ({ title: g.title, items: g.modules.filter(m => superAdmin || values?.[m.key]).map(m => m.label) }))
    .filter(g => g.items.length > 0);
  return (
    <div className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3 py-2.5 text-[12px]">
      <p className="mb-1 flex items-center gap-1.5 font-bold text-[color:var(--text-primary)]"><Eye size={13} /> {title}:</p>
      {superAdmin ? (
        <p className="text-[color:var(--text-secondary)]">Everything — Super Admin has every module.</p>
      ) : visible.length === 0 ? (
        <p className="font-bold text-[color:var(--danger)]">Nothing — the sidebar will be empty and every admin page will show “No access”.</p>
      ) : (
        <ul className="space-y-0.5">
          {visible.map(g => (
            <li key={g.title}><span className="text-[color:var(--text-muted)]">{g.title}:</span> <span className="text-[color:var(--text-secondary)]">{g.items.join(', ')}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Password input with show/hide toggle */
const PasswordInput = ({ value, onChange, show, onToggleShow, placeholder }) => (
  <div className="relative">
    <input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} className={`${inp} pr-9`} />
    <button type="button" onClick={onToggleShow} aria-label={show ? 'Hide password' : 'Show password'}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
      {show ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  </div>
);

// ── Skeleton variants per tab ─────────────────────────────────────────────────

function SkRows({ rows = 6 }) {
  return (
    <Card bodyClassName="space-y-2 p-3">
      <Skeleton className="block h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="block h-7 w-full" />)}
    </Card>
  );
}
const SkUsers = () => <SkRows rows={6} />;
const SkAudit = () => <SkRows rows={8} />;
const SkSessions = () => <SkRows rows={4} />;

function SkRoles() {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <div className="space-y-2 xl:col-span-1">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="block h-[74px] w-full" />)}
      </div>
      <Card className="xl:col-span-2" bodyClassName="p-4">
        <Skeleton className="mb-4 block h-5 w-48" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="block h-9" />)}
        </div>
      </Card>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminAccessControl() {
  const dispatch = useDispatch();
  const { users, roles, auditLog, total: auditTotal, sessions, twoFA } = useSelector(s => s.admin.accessControl);
  const loading = useSelector(s => s.admin.loading);
  const currentAdmin = useSelector(s => s.admin.admin);
  // privilege changes (roles, user roles, overrides, new users) are Super Admin only — the backend enforces it too
  const iAmSuper = isSuperAdmin(currentAdmin);
  const [GROUPS, setGroups] = useState(FALLBACK_GROUPS);
  const MODULES = GROUPS.flatMap(g => g.modules.map(m => m.key));
  const [auditModules, setAuditModules] = useState([]);
  // live profile (the stored login payload goes stale once 2FA is toggled)
  const [me, setMe] = useState(null);

  const [tab, setTab]           = useState('users');
  const [tabLoaded, setTabLoaded] = useState({ users: false, roles: false, audit: false, sessions: false });
  const [tabLoading, setTabLoading] = useState(false);

  // ── User modal state ──────────────────────────────────────────────────────
  const [modal, setModal]     = useState(null);
  const [selUser, setSelUser] = useState(null);
  const [form, setForm]       = useState({ name: '', email: '', password: '', roleId: 0 });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving]   = useState(false);

  // ── User permissions state ────────────────────────────────────────────────
  const [userPermsLocal, setUserPermsLocal] = useState({});
  const [permsSaving, setPermsSaving]       = useState(false);

  // ── Role CRUD state ───────────────────────────────────────────────────────
  const [roleModal, setRoleModal]         = useState(null); // 'create' | 'edit' | 'delete'
  const [selRole, setSelRole]             = useState(null);
  const [selRoleForPerms, setSelRoleForPerms] = useState(null);
  const [rolePermsLocal, setRolePermsLocal]   = useState({});
  const [roleForm, setRoleForm]           = useState({ name: '', description: '', color: ROLE_COLOR_OPTIONS[0].value, isActive: true });
  const [roleSaving, setRoleSaving]       = useState(false);
  const [rolePermsSaving, setRolePermsSaving] = useState(false);

  // ── Audit filters ─────────────────────────────────────────────────────────
  const [auditFilter, setAuditFilter] = useState({ module: '', action: '', dateFrom: '', dateTo: '' });
  const [auditPage, setAuditPage]     = useState(1);

  // ── 2FA state ─────────────────────────────────────────────────────────────
  const [step2FA, setStep2FA]         = useState('loading'); // loading | idle | setup | done
  const [code2FA, setCode2FA]         = useState('');
  const [pwdDisable, setPwdDisable]   = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [tempPwd, setTempPwd]         = useState(null);

  const loadMe = async () => {
    try {
      const res = await api.get('/admin/auth/me');
      setMe(res.data.data);
      return res.data.data;
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not load your profile');
      return null;
    }
  };

  // derive the 2FA card state from the live profile (never overwrite an in-progress setup)
  useEffect(() => {
    if (!me) return;
    setStep2FA(prev => (prev === 'setup' ? prev : me.isTwoFactorEnabled ? 'done' : 'idle'));
  }, [me]);

  // ── Initial data load ─────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      dispatch(fetchAdminUsers()),
      dispatch(fetchRoles()),
    ]).then(([u, r]) => {
      if (!fetchAdminUsers.fulfilled.match(u)) toast.error(u.payload || 'Failed to load users');
      if (!fetchRoles.fulfilled.match(r)) toast.error(r.payload || 'Failed to load roles');
      setTabLoaded(p => ({ ...p, users: true, roles: true }));
    });
    api.get('/admin/roles/module-groups')
      .then(res => {
        const g = res.data?.data;
        if (Array.isArray(g) && g.length && g.every(x => Array.isArray(x.modules))) setGroups(g);
      })
      .catch(() => { /* keep fallback groups */ });
    api.get('/admin/audit-log/modules')
      .then(res => setAuditModules(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => { /* filter still works without the list */ });
    loadMe();
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTab = (t) => {
    setTab(t);
    if (t === 'roles' && !tabLoaded.roles) {
      setTabLoading(true);
      dispatch(fetchRoles()).then(() => {
        setTabLoaded(p => ({ ...p, roles: true }));
        setTabLoading(false);
      });
    } else if (t === 'audit' && !tabLoaded.audit) {
      setTabLoading(true);
      dispatch(fetchAuditLog({ page: 1 })).then((r) => {
        if (!fetchAuditLog.fulfilled.match(r)) toast.error(r.payload || 'Failed to load audit log');
        setTabLoaded(p => ({ ...p, audit: true }));
        setTabLoading(false);
      });
    } else if (t === 'sessions' && !tabLoaded.sessions) {
      setTabLoading(true);
      dispatch(fetchSessions()).then((r) => {
        if (!fetchSessions.fulfilled.match(r)) toast.error(r.payload || 'Failed to load sessions');
        setTabLoaded(p => ({ ...p, sessions: true }));
        setTabLoading(false);
      });
    } else {
      setTabLoading(false);
    }
  };

  const reloadAudit = (page = auditPage) => {
    setTabLoading(true);
    const params = Object.fromEntries(Object.entries({ page, ...auditFilter }).filter(([, v]) => v !== '' && v != null));
    dispatch(fetchAuditLog(params)).then((r) => {
      setTabLoading(false);
      if (!fetchAuditLog.fulfilled.match(r)) toast.error(r.payload || 'Failed to load audit log');
    });
  };

  // ── Role helpers ──────────────────────────────────────────────────────────

  const getRoleById = (id) => roles.find(r => r.id === id);
  const getRoleColor = (u) => {
    const role = getRoleById(u.roleId) || roles.find(r => r.name === u.role);
    return role?.color || 'bg-gray-100 text-gray-600';
  };

  const fullMap = (src) => Object.fromEntries(MODULES.map(m => [m, !!src?.[m]]));
  // what a role grants (a deactivated role grants nothing — same rule as the backend)
  const rolePermsOf = (role) => (role && role.isActive !== false ? fullMap(role.permissions) : fullMap({}));
  const activeSuperCount = users.filter(u => isSuperRole(u.role) && u.isActive).length;
  // permission changes may affect the signed-in admin → refresh the sidebar's permission map
  const refreshMe = () => dispatch(fetchAdminMe());

  const handleSelectRole = (role) => {
    setSelRoleForPerms(role);
    const perms = {};
    MODULES.forEach(m => { perms[m] = role.permissions?.[m] ?? false; });
    setRolePermsLocal(perms);
  };

  const handleSaveRolePerms = async () => {
    if (!selRoleForPerms) return;
    setRolePermsSaving(true);
    const r = await dispatch(updateRole({
      id: selRoleForPerms.id,
      name: selRoleForPerms.name,
      description: selRoleForPerms.description,
      color: selRoleForPerms.color,
      permissions: rolePermsLocal,
      isActive: selRoleForPerms.isActive,
    }));
    setRolePermsSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Permissions saved for role!', { style: { borderRadius: '12px' } });
      setSelRoleForPerms(r.payload);
      dispatch(fetchAdminUsers());
      refreshMe();
    } else {
      toast.error(r.payload || 'Failed to save');
    }
  };

  const handleCreateRole = async () => {
    if (!roleForm.name.trim()) { toast.error('Role name is required'); return; }
    setRoleSaving(true);
    const perms = {};
    MODULES.forEach(m => { perms[m] = rolePermsLocal[m] ?? false; });
    const r = await dispatch(createRole({ name: roleForm.name.trim(), description: roleForm.description.trim(), color: roleForm.color, permissions: perms }));
    setRoleSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Role created!', { style: { borderRadius: '12px' } });
      setRoleModal(null);
      if (r.payload) handleSelectRole(r.payload);
    } else {
      toast.error(r.payload || 'Failed to create role');
    }
  };

  const handleUpdateRole = async () => {
    if (!roleForm.name.trim()) { toast.error('Role name is required'); return; }
    setRoleSaving(true);
    const r = await dispatch(updateRole({
      id: selRole.id,
      name: roleForm.name.trim(),
      description: roleForm.description.trim(),
      color: roleForm.color,
      permissions: isSuperRole(selRole.name) ? (selRole.permissions || {}) : fullMap(rolePermsLocal),
      isActive: roleForm.isActive,
    }));
    setRoleSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Role updated!', { style: { borderRadius: '12px' } });
      setRoleModal(null);
      if (r.payload) handleSelectRole(r.payload);
      dispatch(fetchAdminUsers());
      refreshMe();
    } else {
      toast.error(r.payload || 'Failed to update role');
    }
  };

  const handleDeleteRole = async () => {
    setRoleSaving(true);
    const r = await dispatch(deleteRole(selRole.id));
    setRoleSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Role deleted', { style: { borderRadius: '12px' } });
      setRoleModal(null);
      if (selRoleForPerms?.id === selRole.id) setSelRoleForPerms(null);
    } else {
      toast.error(r.payload || 'Failed to delete role');
    }
  };

  const handleSeedRoles = async () => {
    const r = await dispatch(seedRoles());
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success(`${r.payload?.created || 0} default role(s) created!`, { style: { borderRadius: '12px' } });
      dispatch(fetchRoles());
    } else {
      toast.error(r.payload || 'Failed to seed roles');
    }
  };

  // ── User CRUD ─────────────────────────────────────────────────────────────

  const openAdd = () => {
    const defaultRole = roles.find(r => !isSuperRole(r.name) && r.isActive);
    setForm({ name: '', email: '', password: '', roleId: defaultRole?.id || 0 });
    setShowPwd(false);
    setModal('add');
  };

  const openEdit = (u) => {
    setSelUser(u);
    setForm({ name: u.name, email: u.email, password: '', roleId: u.roleId || 0 });
    setModal('edit');
  };

  const openPerms = (u) => {
    setSelUser(u);
    // start from what the user can do today (role + their overrides); saving stores only the differences
    const role = getRoleById(u.roleId);
    setUserPermsLocal(fullMap(u.effectivePermissions || { ...rolePermsOf(role), ...(u.permissions || {}) }));
    setModal('perms');
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('Name, email and password are required');
      return;
    }
    if (!form.roleId) { toast.error('Select a role'); return; }
    setSaving(true);
    const r = await dispatch(createAdminUser({ name: form.name.trim(), email: form.email.trim(), password: form.password, roleId: Number(form.roleId) }));
    setSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('User created!', { icon: '👤', style: { borderRadius: '12px' } });
      setModal(null);
    } else {
      toast.error(r.payload || 'Failed to create user');
    }
  };

  const handleUpdate = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.roleId && selUser.roleId) { toast.error('Select a role'); return; }
    setSaving(true);
    const r = await dispatch(updateAdminUser({ id: selUser.id, name: form.name.trim(), roleId: Number(form.roleId), isActive: selUser.isActive }));
    setSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('User updated!', { style: { borderRadius: '12px' } });
      setModal(null);
      if (selUser.id === currentAdmin?.id) refreshMe();
    } else {
      toast.error(r.payload || 'Failed to update');
    }
  };

  const handleToggleActive = async (u) => {
    const r = await dispatch(updateAdminUser({ id: u.id, name: u.name, roleId: u.roleId || 0, isActive: !u.isActive }));
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success(u.isActive ? 'User deactivated' : 'User activated', { style: { borderRadius: '12px' } });
    } else {
      toast.error(r.payload || 'Failed to update user');
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const r = await dispatch(deleteAdminUser(selUser.id));
    setSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('User deleted', { style: { borderRadius: '12px' } });
      setModal(null);
    } else {
      toast.error(r.payload || 'Failed to delete');
    }
  };

  const handleResetPwd = async () => {
    setSaving(true);
    const r = await dispatch(resetAdminPassword(selUser.id));
    setSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      // show it in a dialog (once) so it can be copied — never only in a disappearing toast
      setTempPwd(r.payload?.tempPassword || '');
      setModal('tempPwd');
    } else {
      toast.error(r.payload || 'Failed to reset');
    }
  };

  const handleUnlock = async (u) => {
    const r = await dispatch(unlockAdminUser(u.id));
    if (unlockAdminUser.fulfilled.match(r)) {
      toast.success(`${u.name}'s account unlocked`, { style: { borderRadius: '12px' } });
      dispatch(fetchAdminUsers());
    } else {
      toast.error(r.payload || 'Failed to unlock user');
    }
  };

  // ── User permissions ──────────────────────────────────────────────────────

  const handleSaveUserPerms = async () => {
    if (!selUser) return;
    setPermsSaving(true);
    const r = await dispatch(saveUserPermissions({ id: selUser.id, permissions: userPermsLocal }));
    setPermsSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Permissions saved!', { style: { borderRadius: '12px' } });
      setModal(null);
      dispatch(fetchAdminUsers());   // reload stored overrides + effective permissions
      if (selUser.id === currentAdmin?.id) refreshMe();
    } else {
      toast.error(r.payload || 'Failed to save');
    }
  };

  // ── Sessions ──────────────────────────────────────────────────────────────

  const handleRevokeSession = async (id) => {
    const r = await dispatch(revokeSession(id));
    if (r.meta.requestStatus === 'fulfilled') toast.success('Session revoked', { style: { borderRadius: '12px' } });
    else toast.error(r.payload || 'Failed to revoke session');
  };

  const handleRevokeOthers = async () => {
    const r = await dispatch(revokeOtherSessions());
    if (r.meta.requestStatus === 'fulfilled')
      toast.success(`Revoked ${r.payload?.revoked ?? 0} session(s)`, { style: { borderRadius: '12px' } });
    else toast.error(r.payload || 'Failed to revoke sessions');
  };

  // ── 2FA ───────────────────────────────────────────────────────────────────

  const handleSetup2FA = async () => {
    const r = await dispatch(setup2FA());
    if (r.meta.requestStatus === 'fulfilled') {
      setBackupCodes(r.payload?.backupCodes || []);
      setStep2FA('setup');
    } else {
      toast.error(r.payload || 'Failed to setup 2FA');
    }
  };

  const handleEnable2FA = async () => {
    if (code2FA.length !== 6) { toast.error('Enter a 6-digit code'); return; }
    setSaving(true);
    const r = await dispatch(enable2FA(code2FA));
    setSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('2FA enabled!', { icon: '🔒', style: { borderRadius: '12px' } });
      setStep2FA('done');
      setCode2FA('');
      setBackupCodes([]);
      loadMe();
      dispatch(fetchAdminUsers());
    } else {
      toast.error(r.payload || 'Invalid code');
    }
  };

  const handleDisable2FA = async () => {
    if (!pwdDisable) { toast.error('Enter your password'); return; }
    setSaving(true);
    const r = await dispatch(disable2FA({ currentPassword: pwdDisable }));
    setSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('2FA disabled', { style: { borderRadius: '12px' } });
      setStep2FA('idle');
      setPwdDisable('');
      loadMe();
      dispatch(fetchAdminUsers());
    } else {
      toast.error(r.payload || 'Incorrect password');
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(twoFA?.secret || '');
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      toast.error('Could not copy — select the secret and copy it manually');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const activeCount  = users.filter(u => u.isActive).length;
  const initialLoad  = loading && !tabLoaded.users;

  // Client-side paging (hooks must run before any early return)
  const usersPg    = usePagination(users, 20);
  const sessionsPg = usePagination(sessions, 20);

  // Audit log is paged on the server (25 per page) — drive the shared Pagination bar with it
  const auditPages = Math.max(1, Math.ceil((auditTotal || 0) / AUDIT_PAGE_SIZE));
  const goAuditPage = (p) => { setAuditPage(p); reloadAudit(p); };

  const closeModal = () => setModal(null);
  const closeRoleModal = () => setRoleModal(null);

  if (initialLoad) return (
    <div className="space-y-4">
      <SkPageHeader />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Stat key={i} label="" value="" loading />)}
      </div>
      <SkTabs tabCount={5} contentRows={6} />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Header */}
      <PageHeader
        title="User & Access Control"
        description="Roles, permissions, audit log, 2FA and session management"
        actions={iAmSuper && <Button onClick={openAdd}><Plus size={15} /> Invite user</Button>}
      />

      {!iAmSuper && (
        <Callout tone="info" icon={Lock}>
          You can view users, roles and the audit log. Creating users and changing roles or permissions is reserved for a Super Admin.
        </Callout>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Users}       label="Total users" value={users.length} />
        <Stat icon={CheckCircle} label="Active"      value={activeCount}  tone="success" />
        <Stat icon={Shield}      label="Roles"       value={roles.length} tone="primary" />
        <Stat icon={BookOpen}    label="Audit logs"  value={auditTotal || auditLog.length} tone="accent" />
      </div>

      {/* Tab bar */}
      <Tabs
        items={TABS.map(t => ({ value: t.key, label: t.label, icon: t.icon }))}
        value={tab}
        onChange={loadTab}
      />

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <>
          {!tabLoaded.users ? <SkUsers /> : (
            <Card
              title={`Admin users (${users.length})`}
              actions={(
                <Button size="sm" variant="tertiary" onClick={() => dispatch(fetchAdminUsers())}>
                  <RefreshCw size={13} /> Refresh
                </Button>
              )}
              bodyClassName="p-3"
            >
              {users.length === 0 ? (
                <EmptyState icon={Users} title="No users yet">Click “Invite user” to add one.</EmptyState>
              ) : (
                <>
                  <div className="grid-box">
                    <table>
                      <thead>
                        <tr>
                          <th className="text-left">User</th>
                          <th className="text-left">Role</th>
                          <th className="text-left">Email</th>
                          <th className="text-left">Last login</th>
                          <th className="text-left">Status</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersPg.items.map(u => (
                          <tr key={u.id}>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[12px] font-bold text-white">
                                  {(u.name || '?')[0].toUpperCase()}
                                </div>
                                <span className="font-bold">{u.name}</span>
                                {u.isTwoFactorEnabled && (
                                  <Badge tone="success" className="!px-1.5 !text-[11px]"><KeyRound size={10} /> 2FA</Badge>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-wrap items-center gap-1">
                                <RoleBadge roleName={u.role} color={getRoleColor(u)} />
                                {u.permissions && Object.keys(u.permissions).length > 0 && (
                                  <Badge tone="accent" className="!px-1.5 !text-[11px]" title={Object.entries(u.permissions).map(([k, v]) => `${v ? '+' : '−'} ${k}`).join(', ')}>
                                    {Object.keys(u.permissions).length} override{Object.keys(u.permissions).length === 1 ? '' : 's'}
                                  </Badge>
                                )}
                                {isSuperRole(u.role) && u.isActive && activeSuperCount <= 1 && (
                                  <Badge tone="neutral" className="!px-1.5 !text-[11px]"><Lock size={10} /> Last Super Admin</Badge>
                                )}
                              </div>
                            </td>
                            <td className="text-[color:var(--text-muted)]">{u.email}</td>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">
                              {u.lastLoginAt ? fmtShort(u.lastLoginAt) : 'Never'}
                            </td>
                            <td>
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                                {u.isLocked && <Badge tone="danger">Locked</Badge>}
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center justify-center gap-0.5">
                                {iAmSuper && (!isSuperRole(u.role) || u.id === currentAdmin?.id) && (
                                  <IconButton label="Edit" tone="primary" onClick={() => openEdit(u)}><Edit2 size={14} /></IconButton>
                                )}
                                {iAmSuper && !isSuperRole(u.role) && (
                                  <IconButton label="Permissions" tone="primary" onClick={() => openPerms(u)}><Shield size={14} /></IconButton>
                                )}
                                {iAmSuper && (
                                  <IconButton label="Reset password" onClick={() => { setSelUser(u); setModal('reset'); }}><RefreshCw size={14} /></IconButton>
                                )}
                                {u.isLocked && (
                                  <IconButton label="Unlock" onClick={() => handleUnlock(u)}><Unlock size={14} /></IconButton>
                                )}
                                {/* Super Admin accounts can't be deactivated or deleted here (protects the last Super Admin) */}
                                {iAmSuper && !isSuperRole(u.role) && (
                                  <>
                                    <IconButton label={u.isActive ? 'Deactivate' : 'Activate'} tone={u.isActive ? 'danger' : 'primary'} onClick={() => handleToggleActive(u)}>
                                      {u.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                                    </IconButton>
                                    <IconButton label="Delete" tone="danger" onClick={() => { setSelUser(u); setModal('delete'); }}><Trash2 size={14} /></IconButton>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination {...usersPg} noun="users" />
                </>
              )}
            </Card>
          )}
        </>
      )}

      {/* ── ROLES & PERMISSIONS TAB ── */}
      {tab === 'roles' && (
        <>
          {tabLoading && !tabLoaded.roles ? <SkRoles /> : (
            <div className="space-y-3">
              {/* Header row */}
              <Toolbar className="justify-between">
                <h3 className="text-[13px] font-bold text-[color:var(--text-primary)]">Roles ({roles.length})</h3>
                {iAmSuper && <div className="flex gap-2">
                  {roles.length === 0 && (
                    <Button variant="secondary" onClick={handleSeedRoles}>
                      <Settings size={15} /> Initialize default roles
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      const perms = {};
                      MODULES.forEach(m => { perms[m] = false; });
                      setRolePermsLocal(perms);
                      setRoleForm({ name: '', description: '', color: ROLE_COLOR_OPTIONS[0].value, isActive: true });
                      setRoleModal('create');
                    }}>
                    <Plus size={15} /> Create role
                  </Button>
                </div>}
              </Toolbar>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {/* Role cards */}
                <div className="space-y-2 xl:col-span-1">
                  {roles.length === 0 && (
                    <Card>
                      <EmptyState icon={Shield} title="No roles yet">Click “Initialize default roles” to get started.</EmptyState>
                    </Card>
                  )}
                  {roles.map(role => {
                    const granted = Object.entries(role.permissions || {}).filter(([, v]) => v);
                    const selected = selRoleForPerms?.id === role.id;
                    return (
                      <div key={role.id}
                        onClick={() => handleSelectRole(role)}
                        className={cn(
                          'cursor-pointer rounded-[8px] border bg-[color:var(--surface)] px-3 py-2.5 transition-colors',
                          selected ? 'border-[color:var(--primary)] bg-[color:var(--selection)] shadow-[inset_3px_0_0_var(--primary)]' : 'border-[color:var(--border)] hover:border-[color:var(--border-strong)]',
                        )}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Shield size={14} className="shrink-0 text-[color:var(--primary)]" />
                            <span className="truncate text-[13px] font-bold">{role.name}</span>
                            {role.isSystem && <Badge className="!px-1.5 !text-[10px]">SYSTEM</Badge>}
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <RoleBadge roleName={role.name} color={role.color} />
                            {!role.isActive && <Badge tone="neutral" className="!px-1.5 !text-[10px]">Inactive</Badge>}
                            {iAmSuper && <IconButton
                              label="Edit role"
                              tone="primary"
                              onClick={e => {
                                e.stopPropagation();
                                setSelRole(role);
                                // edit a copy — cancelling leaves the role untouched
                                setRoleForm({ name: role.name, description: role.description || '', color: role.color, isActive: role.isActive });
                                setRolePermsLocal(fullMap(role.permissions));
                                setRoleModal('edit');
                              }}>
                              <Edit2 size={12} />
                            </IconButton>}
                            {iAmSuper && !role.isSystem && (
                              <IconButton
                                label="Delete role"
                                tone="danger"
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelRole(role);
                                  setRoleModal('delete');
                                }}>
                                <Trash2 size={12} />
                              </IconButton>
                            )}
                          </div>
                        </div>
                        {role.description && (
                          <p className="mt-1 truncate text-[12px] text-[color:var(--text-muted)]">{role.description}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="text-[11px] text-[color:var(--text-muted)]">{role.userCount ?? 0} user{role.userCount === 1 ? '' : 's'} ·</span>
                          {granted.slice(0, 3).map(([k]) => (
                            <span key={k} className="rounded-[4px] bg-[color:var(--surface-hover)] px-1.5 text-[11px] leading-[18px] text-[color:var(--text-secondary)]">{k}</span>
                          ))}
                          {granted.length > 3 && (
                            <span className="text-[11px] text-[color:var(--text-muted)]">+{granted.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Permission matrix */}
                <Card
                  className="xl:col-span-2"
                  title={selRoleForPerms ? `Permissions — ${selRoleForPerms.name}` : 'Module permissions'}
                  actions={iAmSuper && selRoleForPerms && !isSuperRole(selRoleForPerms.name) && (
                    <Button size="sm" onClick={handleSaveRolePerms} loading={rolePermsSaving}>
                      {rolePermsSaving ? 'Saving…' : 'Save permissions'}
                    </Button>
                  )}
                  bodyClassName="p-3"
                >
                  {selRoleForPerms ? (
                    <div className="space-y-3">
                      {isSuperRole(selRoleForPerms.name) && (
                        <Callout tone="info" icon={Lock}>Super Admin always has every module; its permissions can't be edited.</Callout>
                      )}
                      {!selRoleForPerms.isActive && (
                        <Callout tone="warning" icon={AlertTriangle}>This role is inactive — its users get no modules from it until it is re-activated.</Callout>
                      )}
                      <PermissionMatrix
                        groups={GROUPS}
                        values={isSuperRole(selRoleForPerms.name) ? fullMap(Object.fromEntries(MODULES.map(m => [m, true]))) : rolePermsLocal}
                        disabled={!iAmSuper || isSuperRole(selRoleForPerms.name)}
                        onChange={patch => setRolePermsLocal(p => ({ ...p, ...patch }))}
                      />
                      <AccessPreview groups={GROUPS} values={rolePermsLocal} superAdmin={isSuperRole(selRoleForPerms.name)} title="Users with this role will see" />
                    </div>
                  ) : (
                    <EmptyState icon={Shield} title="No role selected">Click a role card to manage its permissions.</EmptyState>
                  )}
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {tab === 'audit' && (
        <>
          {tabLoading && !tabLoaded.audit ? <SkAudit /> : (
            <Card bodyClassName="space-y-3 p-3">
              <Toolbar>
                <select value={auditFilter.module} aria-label="Module"
                  onChange={e => setAuditFilter(p => ({ ...p, module: e.target.value }))}
                  className={`${inp} !h-9 !w-44`}>
                  <option value="">All modules</option>
                  {(auditFilter.module && !auditModules.includes(auditFilter.module) ? [auditFilter.module, ...auditModules] : auditModules)
                    .map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input placeholder="Filter by action…" value={auditFilter.action}
                  onChange={e => setAuditFilter(p => ({ ...p, action: e.target.value }))}
                  className={`${inp} !h-9 !w-40`} />
                <input type="date" value={auditFilter.dateFrom} aria-label="From date"
                  onChange={e => setAuditFilter(p => ({ ...p, dateFrom: e.target.value }))}
                  className={`${inp} !h-9 !w-40`} />
                <input type="date" value={auditFilter.dateTo} aria-label="To date"
                  onChange={e => setAuditFilter(p => ({ ...p, dateTo: e.target.value }))}
                  className={`${inp} !h-9 !w-40`} />
                <Button onClick={() => { setAuditPage(1); reloadAudit(1); }}>
                  <Search size={14} /> Search
                </Button>
                <span className="ml-auto text-[12px] text-[color:var(--text-muted)]">{auditTotal} total entries</span>
              </Toolbar>

              {tabLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="block h-7 w-full" />)}
                </div>
              ) : auditLog.length === 0 ? (
                <EmptyState icon={BookOpen} title="No audit entries found">Try a different module, action or date range.</EmptyState>
              ) : (
                <>
                  <div className="grid-box">
                    <table>
                      <thead>
                        <tr>
                          <th className="text-left">When</th>
                          <th className="text-left">Action</th>
                          <th className="text-left">Module</th>
                          <th className="text-left">User</th>
                          <th className="text-left">Details</th>
                          <th className="text-left">IP address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLog.map((log, i) => (
                          <tr key={log.id || i}>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtShort(log.createdAt)}</td>
                            <td className="max-w-[360px] truncate font-bold">{log.action}</td>
                            <td>
                              <Badge tone={log.module === 'Auth' ? 'info' : log.module === 'Session' || log.module === 'AccessControl' ? 'accent' : 'primary'}>
                                {log.module}
                              </Badge>
                            </td>
                            <td>{log.userName || log.userId}</td>
                            <td className="max-w-[320px] truncate text-[color:var(--text-muted)]" title={log.details || undefined}>{log.details || '—'}</td>
                            <td className="text-[color:var(--text-muted)]">{log.ipAddress || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={auditPage}
                    pages={auditPages}
                    total={auditTotal || auditLog.length}
                    pageSize={AUDIT_PAGE_SIZE}
                    setPage={goAuditPage}
                    noun="entries"
                  />
                </>
              )}
            </Card>
          )}
        </>
      )}

      {/* ── SESSIONS TAB ── */}
      {tab === 'sessions' && (
        <>
          {tabLoading && !tabLoaded.sessions ? <SkSessions /> : (
            <Card
              title={`Active sessions (${sessions.length})`}
              actions={sessions.filter(s => !s.isCurrentSession).length > 0 && (
                <Button size="sm" variant="danger" onClick={handleRevokeOthers}>Revoke all other sessions</Button>
              )}
              bodyClassName="p-3"
            >
              {sessions.length === 0 ? (
                <EmptyState icon={Laptop} title="No active sessions found" />
              ) : (
                <>
                  <div className="grid-box">
                    <table>
                      <thead>
                        <tr>
                          <th className="text-left">Device</th>
                          <th className="text-left">IP address</th>
                          <th className="text-left">Started</th>
                          <th className="text-left">Last active</th>
                          <th className="text-left">Expires</th>
                          <th className="text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsPg.items.map(s => (
                          <tr key={s.id} className={s.isCurrentSession ? '!bg-[color:var(--selection)]' : undefined}>
                            <td>
                              <div className="flex items-center gap-2">
                                <Laptop size={14} className={s.isCurrentSession ? 'shrink-0 text-[color:var(--success)]' : 'shrink-0 text-[color:var(--text-muted)]'} />
                                <span className="max-w-[260px] truncate font-bold" title={s.userAgent || undefined}>
                                  {s.userAgent ? s.userAgent.split(' ').slice(0, 3).join(' ') : 'Unknown device'}
                                </span>
                                {s.isCurrentSession && <Badge tone="success">Current</Badge>}
                              </div>
                            </td>
                            <td className="text-[color:var(--text-muted)]">{s.ipAddress || '—'}</td>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtFull(s.createdAt)}</td>
                            <td className="whitespace-nowrap">{fmtFull(s.lastActiveAt)}</td>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtFull(s.expiresAt)}</td>
                            <td className="text-center">
                              {!s.isCurrentSession && (
                                <Button size="sm" variant="danger" className="!h-7 !px-2 !text-[12px]" onClick={() => handleRevokeSession(s.id)}>
                                  Revoke
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination {...sessionsPg} noun="sessions" />
                </>
              )}
            </Card>
          )}
        </>
      )}

      {/* ── 2FA TAB ── */}
      {tab === '2fa' && (
        <div className="max-w-xl space-y-3">
          <Card
            title="Two-factor authentication"
            actions={step2FA === 'loading' ? null : <Badge tone={step2FA === 'done' ? 'success' : 'neutral'}>{step2FA === 'done' ? 'Enabled' : 'Disabled'}</Badge>}
            bodyClassName="space-y-4 p-4"
          >
            <p className="text-[13px] text-[color:var(--text-muted)]">Secure your account{me?.email ? ` (${me.email})` : ''} with Google Authenticator or Authy.</p>
            {step2FA === 'loading' && <Skeleton className="block h-16 w-full" />}

            {step2FA === 'idle' && (
              <>
                <Callout tone="warning" icon={AlertTriangle}>
                  <strong>2FA is currently disabled.</strong> Enable it to add an extra layer of security.
                </Callout>
                <Button size="lg" className="w-full" onClick={handleSetup2FA}>
                  <QrCode size={16} /> Set up 2FA
                </Button>
              </>
            )}

            {step2FA === 'setup' && twoFA && (
              <div className="space-y-4">
                <Callout tone="info">
                  <strong>Step 1:</strong> Scan this QR code with Google Authenticator or Authy
                </Callout>
                <div className="flex justify-center">
                  {/* rendered locally — the TOTP secret must never be sent to a third-party QR service */}
                  <div className="rounded-[8px] border border-[color:var(--border)] bg-white p-2">
                    <QRCodeSVG value={twoFA.qrUri} size={176} aria-label="2FA QR code" />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">Or enter this secret manually:</p>
                  <div className="flex items-center gap-2 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3 py-2">
                    <code className="flex-1 break-all font-mono text-[12px] text-[color:var(--text-primary)]">{twoFA.secret}</code>
                    <IconButton label={copiedSecret ? 'Copied' : 'Copy secret'} tone="primary" onClick={copySecret}>
                      {copiedSecret ? <CheckCircle size={15} className="text-[color:var(--success)]" /> : <Copy size={15} />}
                    </IconButton>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] font-bold text-[color:var(--text-secondary)]">Save these backup codes (one-time use each):</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {backupCodes.map((code, i) => (
                      <code key={i} className="rounded-[4px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3 py-1.5 text-center font-mono text-[12px]">{code}</code>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] font-bold text-[color:var(--text-secondary)]">Step 2: Enter the 6-digit code from your app to verify</p>
                  <div className="flex gap-2">
                    <input value={code2FA} onChange={e => setCode2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000" maxLength={6}
                      className={`${inp} flex-1 text-center font-mono text-lg tracking-widest`} />
                    <Button onClick={handleEnable2FA} disabled={saving || code2FA.length !== 6} loading={saving}>
                      {saving ? 'Verifying…' : 'Enable 2FA'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step2FA === 'done' && (
              <div className="space-y-4">
                <Callout tone="success" icon={CheckCircle}>
                  <strong>2FA is enabled!</strong> Your account is now more secure.
                </Callout>
                <Field label="To disable 2FA, confirm your password">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <PasswordInput
                        value={pwdDisable}
                        onChange={e => setPwdDisable(e.target.value)}
                        show={showPwd}
                        onToggleShow={() => setShowPwd(p => !p)}
                        placeholder="Your password"
                      />
                    </div>
                    <Button variant="danger" onClick={handleDisable2FA} disabled={saving || !pwdDisable} loading={saving}>
                      {saving ? 'Disabling…' : 'Disable 2FA'}
                    </Button>
                  </div>
                </Field>
              </div>
            )}
          </Card>

          <Card title="Security tips" bodyClassName="p-4">
            <ul className="space-y-2 text-[13px] text-[color:var(--text-secondary)]">
              {[
                'Use Google Authenticator, Authy or Microsoft Authenticator',
                'Save backup codes in a safe place — you can use them if you lose your phone',
                'Never share your 2FA codes with anyone',
                '2FA codes expire every 30 seconds',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle size={14} className="mt-0.5 shrink-0 text-[color:var(--success)]" />
                  {tip}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* ─────────────────────────── USER MODALS ─────────────────────────── */}

      {/* Add User */}
      {modal === 'add' && (
        <Modal
          title="Invite new user"
          onClose={closeModal}
          footer={<>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>{saving ? 'Creating…' : 'Create user'}</Button>
          </>}
        >
          <div className="space-y-3">
            <Field label="Full Name" required>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Sunita Sharma" className={inp} />
            </Field>
            <Field label="Email" required>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="user@wahspices.in" className={inp} />
            </Field>
            <Field label="Password" required hint="Minimum 8 characters">
              <PasswordInput
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                show={showPwd}
                onToggleShow={() => setShowPwd(p => !p)}
              />
            </Field>
            <Field label="Role" required>
              <select value={form.roleId} onChange={e => setForm(p => ({ ...p, roleId: Number(e.target.value) }))} className={inp}>
                <option value={0}>— Select role —</option>
                {roles.filter(r => !isSuperRole(r.name) && r.isActive).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
            {!!form.roleId && <AccessPreview groups={GROUPS} values={rolePermsOf(getRoleById(Number(form.roleId)))} />}
          </div>
        </Modal>
      )}

      {/* Edit User */}
      {modal === 'edit' && selUser && (
        <Modal
          title={`Edit — ${selUser.name}`}
          onClose={closeModal}
          footer={<>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleUpdate} loading={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </>}
        >
          <div className="space-y-3">
            <Field label="Full Name" required>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} />
            </Field>
            <Field label="Email (read-only)">
              <input value={form.email} disabled className={inp} />
            </Field>
            <Field label="Role">
              <select value={form.roleId}
                onChange={e => setForm(p => ({ ...p, roleId: Number(e.target.value) }))}
                disabled={isSuperRole(selUser.role)}
                className={inp}>
                {!selUser.roleId && <option value={0}>{selUser.role} (current)</option>}
                {roles.filter(r => r.isActive).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
            {(() => {
              const chosen = getRoleById(Number(form.roleId));
              const superAdmin = chosen ? isSuperRole(chosen.name) : isSuperRole(selUser.role);
              return (
                <AccessPreview groups={GROUPS} superAdmin={superAdmin}
                  values={{ ...rolePermsOf(chosen), ...(selUser.permissions || {}) }} />
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Delete User */}
      {modal === 'delete' && selUser && (
        <Modal
          title="Delete user"
          onClose={closeModal}
          footer={<>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={saving}>{saving ? 'Deleting…' : 'Delete user'}</Button>
          </>}
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--danger-bg)] text-[color:var(--danger)]">
              <Trash2 size={16} />
            </div>
            <div className="text-[13px]">
              <p className="text-[color:var(--text-secondary)]">This will permanently delete:</p>
              <p className="font-bold">{selUser.name} ({selUser.email})</p>
              <p className="mt-1 text-[12px] text-[color:var(--text-muted)]">This action cannot be undone.</p>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Password */}
      {modal === 'reset' && selUser && (
        <Modal
          title="Reset password"
          onClose={closeModal}
          footer={<>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="accent" onClick={handleResetPwd} loading={saving}>{saving ? 'Resetting…' : 'Reset password'}</Button>
          </>}
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]">
              <KeyRound size={16} />
            </div>
            <div className="text-[13px]">
              <p className="text-[color:var(--text-secondary)]">Generate a new temporary password for:</p>
              <p className="font-bold">{selUser.name}</p>
              <p className="mt-1 text-[12px] text-[color:var(--text-muted)]">The new temp password will be shown once. Share it securely.</p>
            </div>
          </div>
        </Modal>
      )}

      {/* Temp password result */}
      {modal === 'tempPwd' && selUser && (
        <Modal
          title="Temporary password"
          onClose={() => { setTempPwd(null); closeModal(); }}
          footer={<Button onClick={() => { setTempPwd(null); closeModal(); }}>Done</Button>}
        >
          <div className="space-y-2 text-[13px]">
            <p className="text-[color:var(--text-secondary)]">New temporary password for <b>{selUser.name}</b> — shown only once:</p>
            <div className="flex items-center gap-2 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3 py-2">
              <code className="flex-1 break-all font-mono text-[14px]">{tempPwd}</code>
              <IconButton label="Copy password" tone="primary" onClick={async () => {
                try { await navigator.clipboard.writeText(tempPwd || ''); toast.success('Copied'); }
                catch { toast.error('Copy failed — select it manually'); }
              }}><Copy size={15} /></IconButton>
            </div>
          </div>
        </Modal>
      )}

      {/* User Permissions Modal */}
      {modal === 'perms' && selUser && (
        <Modal
          title={`Permissions — ${selUser.name}`}
          onClose={closeModal}
          wide
          footer={<>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSaveUserPerms} disabled={isSuperRole(selUser.role)} loading={permsSaving}>
              {permsSaving ? 'Saving…' : 'Save permissions'}
            </Button>
          </>}
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-[12px] text-[color:var(--text-secondary)]">
                Role: <RoleBadge roleName={selUser.role} color={getRoleColor(selUser)} />
              </p>
              <p className="text-[12px] text-[color:var(--text-muted)]">
                Overrides on top of the role. Ticks that differ from the role are marked and saved for this user only;
                everything else keeps following the role.
              </p>
            </div>
            <Button size="sm" variant="tertiary" onClick={() => setUserPermsLocal(rolePermsOf(getRoleById(selUser.roleId)))}>
              <RotateCcw size={13} /> Reset to role
            </Button>
          </div>
          <div className="space-y-3">
            <PermissionMatrix
              groups={GROUPS}
              values={userPermsLocal}
              baseline={rolePermsOf(getRoleById(selUser.roleId))}
              disabled={isSuperRole(selUser.role)}
              onChange={patch => setUserPermsLocal(p => ({ ...p, ...patch }))}
            />
            <AccessPreview groups={GROUPS} values={userPermsLocal} superAdmin={isSuperRole(selUser.role)} />
          </div>
        </Modal>
      )}

      {/* ─────────────────────────── ROLE MODALS ─────────────────────────── */}

      {/* Create Role */}
      {roleModal === 'create' && (
        <Modal
          title="Create new role"
          onClose={closeRoleModal}
          wide
          footer={<>
            <Button variant="secondary" onClick={closeRoleModal}>Cancel</Button>
            <Button onClick={handleCreateRole} loading={roleSaving}>{roleSaving ? 'Creating…' : 'Create role'}</Button>
          </>}
        >
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Role Name" required>
              <input value={roleForm.name} onChange={e => setRoleForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Dispatch Manager" className={inp} />
            </Field>
            <Field label="Badge Color">
              <select value={roleForm.color} onChange={e => setRoleForm(p => ({ ...p, color: e.target.value }))} className={inp}>
                {ROLE_COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <input value={roleForm.description} onChange={e => setRoleForm(p => ({ ...p, description: e.target.value }))} placeholder="Short description of this role" className={inp} />
            </Field>
          </div>
          <p className="mb-1.5 text-[12px] font-bold text-[color:var(--text-secondary)]">Module permissions</p>
          <div className="space-y-3">
            <PermissionMatrix
              groups={GROUPS}
              values={rolePermsLocal}
              onChange={patch => setRolePermsLocal(p => ({ ...p, ...patch }))}
            />
            <AccessPreview groups={GROUPS} values={rolePermsLocal} title="Users with this role will see" />
          </div>
        </Modal>
      )}

      {/* Edit Role */}
      {roleModal === 'edit' && selRole && (
        <Modal
          title={`Edit role — ${selRole.name}`}
          onClose={closeRoleModal}
          wide
          footer={<>
            <Button variant="secondary" onClick={closeRoleModal}>Cancel</Button>
            <Button onClick={handleUpdateRole} loading={roleSaving}>{roleSaving ? 'Saving…' : 'Save changes'}</Button>
          </>}
        >
          <div className="space-y-3">
            <Field label="Role Name" required hint={selRole.isSystem ? 'System role names cannot be changed.' : undefined}>
              <input value={roleForm.name}
                onChange={e => setRoleForm(p => ({ ...p, name: e.target.value }))}
                disabled={selRole.isSystem}
                className={inp} />
            </Field>
            <Field label="Description">
              <input value={roleForm.description} onChange={e => setRoleForm(p => ({ ...p, description: e.target.value }))} className={inp} />
            </Field>
            <Field label="Badge Color">
              <select value={roleForm.color} onChange={e => setRoleForm(p => ({ ...p, color: e.target.value }))} className={inp}>
                {ROLE_COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="roleActive" checked={!!roleForm.isActive}
                disabled={isSuperRole(selRole.name)}
                onChange={() => setRoleForm(f => ({ ...f, isActive: !f.isActive }))}
                className="size-4 accent-[#1a5c2e]" />
              <label htmlFor="roleActive" className="text-[13px] font-bold text-[color:var(--text-secondary)]">Active</label>
            </div>
            {!isSuperRole(selRole.name) && (
              <>
                <p className="pt-1 text-[12px] font-bold text-[color:var(--text-secondary)]">Module permissions</p>
                <PermissionMatrix
                  groups={GROUPS}
                  values={rolePermsLocal}
                  onChange={patch => setRolePermsLocal(p => ({ ...p, ...patch }))}
                />
                <AccessPreview groups={GROUPS} values={roleForm.isActive ? rolePermsLocal : {}} title="Users with this role will see" />
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Role */}
      {roleModal === 'delete' && selRole && (
        <Modal
          title="Delete role"
          onClose={closeRoleModal}
          footer={<>
            <Button variant="secondary" onClick={closeRoleModal}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteRole} disabled={selRole.userCount > 0} loading={roleSaving}>
              {roleSaving ? 'Deleting…' : 'Delete role'}
            </Button>
          </>}
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--danger-bg)] text-[color:var(--danger)]">
              <Trash2 size={16} />
            </div>
            <div className="text-[13px]">
              <p className="text-[color:var(--text-secondary)]">Delete role:</p>
              <p className="font-bold">{selRole.name}</p>
              {selRole.userCount > 0 && (
                <p className="mt-1 text-[12px] font-bold text-[color:var(--danger)]">
                  This role has {selRole.userCount} user(s). Reassign them before deleting.
                </p>
              )}
              <p className="mt-1 text-[12px] text-[color:var(--text-muted)]">This action cannot be undone.</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
