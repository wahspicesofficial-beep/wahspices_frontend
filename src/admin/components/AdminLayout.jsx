import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingBag, Users, FileText, Settings, LogOut, X, PanelLeft,
  BarChart2, ShieldCheck, Factory, ShoppingCart, QrCode, Receipt, Percent, UserCheck,
  Umbrella, Banknote, TrendingUp, Wallet, ClipboardList, ChefHat, FolderTree, ExternalLink, Contact,
  Undo2, CreditCard, UserRound, Handshake, Globe, Star, MessageSquareHeart, Inbox, Lock, PackageCheck,
} from 'lucide-react';
import { Building2, Split, HandCoins, Boxes, FileBadge, PieChart } from 'lucide-react';   // Company group
import { Megaphone, BellRing } from 'lucide-react';   // Marketing group
import { Map as MapIcon, Truck } from 'lucide-react';         // Website → Regions
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { adminLogout, fetchAdminMe } from '@/store/slices/adminSlice';
import toast from 'react-hot-toast';
import '@/admin/admin.css';

// Every admin route, grouped the way the sidebar shows them.
const ALL_NAV_GROUPS = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true, module: 'Dashboard' }],
  },
  {
    title: 'Sales & Billing',
    items: [
      { label: 'Orders', path: '/admin/orders', icon: ShoppingBag, module: 'Orders' },
      { label: 'Shipping', path: '/admin/shipping', icon: Truck, module: 'Orders' },
      { label: 'Returns', path: '/admin/returns', icon: Undo2, module: 'Returns' },
      { label: 'Payments', path: '/admin/payments', icon: CreditCard, module: 'Payments' },
      { label: 'Website Users', path: '/admin/website-users', icon: UserRound, module: 'WebsiteUsers' },
      { label: 'Billing & Invoice', path: '/admin/billing', icon: Receipt, module: 'Billing' },
      { label: 'GST & Tax', path: '/admin/gst', icon: Percent, module: 'GST' },
      { label: 'Customers', path: '/admin/customers', icon: Contact, module: 'Customers' },
      { label: 'CRM', path: '/admin/crm', icon: Handshake, module: 'Customers' },
      { label: 'Field Sales', path: '/admin/sales-orders', icon: ClipboardList, module: 'FieldSales' },
    ],
  },
  {
    title: 'Inventory & Production',
    items: [
      { label: 'Inventory', path: '/admin/inventory', icon: Package, module: 'Inventory' },
      { label: 'Raw & Packing', path: '/admin/packing', icon: PackageCheck, module: 'Inventory' },
      { label: 'Production', path: '/admin/production', icon: Factory, module: 'Production' },
      { label: 'Purchase', path: '/admin/purchase', icon: ShoppingCart, module: 'Purchase' },
      { label: 'Barcode', path: '/admin/barcode', icon: QrCode, module: 'Barcode' },
    ],
  },
  {
    title: 'HR Management',
    items: [
      { label: 'Staff', path: '/admin/staff', icon: Users, module: 'Staff' },
      { label: 'Attendance', path: '/admin/attendance', icon: UserCheck, module: 'Attendance' },
      { label: 'Leave', path: '/admin/leave', icon: Umbrella, module: 'Leave' },
      { label: 'Payroll', path: '/admin/payroll', icon: Banknote, module: 'Payroll' },
      { label: 'Expenses', path: '/admin/expense', icon: Wallet, module: 'Expenses' },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'Overview & alerts', path: '/admin/company', icon: Building2, end: true, module: 'Company' },
      { label: 'Expenses & split', path: '/admin/company/expenses', icon: Split, module: 'Company' },
      { label: 'Partners & ledger', path: '/admin/company/partners', icon: HandCoins, module: 'Company' },
      { label: 'Assets', path: '/admin/company/assets', icon: Boxes, module: 'Company' },
      { label: 'Licences', path: '/admin/company/licences', icon: FileBadge, module: 'Company' },
      { label: 'Company reports', path: '/admin/company/reports', icon: PieChart, module: 'Company' },
    ],
  },
  {
    title: 'Products & Content',
    items: [
      { label: 'Products', path: '/admin/products', icon: Package, module: 'Products' },
      { label: 'Categories', path: '/admin/categories', icon: FolderTree, module: 'Categories' },
      { label: 'Blog', path: '/admin/blog', icon: FileText, module: 'Blog' },
      { label: 'Recipes', path: '/admin/recipes', icon: ChefHat, module: 'Recipes' },
      { label: 'Reviews', path: '/admin/reviews', icon: Star, module: 'Reviews' },
    ],
  },
  {
    title: 'Website',
    items: [
      { label: 'Website Content', path: '/admin/content', icon: Globe, module: 'Website' },
      { label: 'Regions', path: '/admin/regions', icon: MapIcon, module: 'Website' },
      { label: 'Feedback', path: '/admin/feedback', icon: MessageSquareHeart, module: 'Feedback' },
      { label: 'Contact Messages', path: '/admin/messages', icon: Inbox, module: 'Messages' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { label: 'Campaigns', path: '/admin/marketing/campaigns', icon: Megaphone, module: 'Marketing' },
      { label: 'Broadcasts', path: '/admin/marketing/broadcasts', icon: BellRing, module: 'Marketing' },
    ],
  },
  {
    title: 'Reports & System',
    items: [
      { label: 'Analytics', path: '/admin/analytics', icon: TrendingUp, module: 'Analytics' },
      { label: 'Reports', path: '/admin/reports', icon: BarChart2, module: 'Reports' },
      { label: 'Access Control', path: '/admin/access-control', icon: ShieldCheck, module: 'AccessControl' },
      { label: 'Settings', path: '/admin/settings', icon: Settings, module: 'Settings' },
    ],
  },
];

// Super Admin sees everything. Everyone else sees ONLY the modules their role (plus any
// per-user overrides) explicitly grants — a module missing from the permission map is hidden.
// The backend enforces the same rule on every admin API.
export function isSuperAdmin(admin) {
  if (!admin) return false;
  if (typeof admin.isSuperAdmin === 'boolean') return admin.isSuperAdmin;   // explicit flag from login / me
  return !admin.permissions || ['Super Admin', 'Admin', 'SuperAdmin'].includes(admin.roleName || admin.role);
}
export function canAccess(admin, module) {
  if (!module) return true;
  if (isSuperAdmin(admin)) return true;
  return admin?.permissions?.[module] === true;
}
function filterNavByPermissions(admin) {
  return ALL_NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => canAccess(admin, i.module)) }))
    .filter((g) => g.items.length > 0);
}

const ALL_ITEMS = ALL_NAV_GROUPS.flatMap((g) => g.items);
const itemFor = (pathname) =>
  ALL_ITEMS.find((i) => (i.end ? pathname === i.path : pathname === i.path || pathname.startsWith(`${i.path}/`)));
const pageTitleFor = (pathname) => itemFor(pathname)?.label ?? 'Admin';

const readCollapsed = () => {
  try { return localStorage.getItem('wah_admin_sidebar') === 'collapsed'; } catch { return false; }
};

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { admin, isLoggedIn } = useAppSelector((s) => s.admin);

  useEffect(() => {
    try { localStorage.setItem('wah_admin_sidebar', collapsed ? 'collapsed' : 'expanded'); } catch { /* private mode */ }
  }, [collapsed]);

  // Close the phone drawer after navigating
  useEffect(() => setMobileOpen(false), [pathname]);

  // Keep role permissions fresh: a Super Admin's change to this user's role shows in the
  // sidebar on the next navigation, without logging out (the backend already enforces it).
  useEffect(() => { if (isLoggedIn) dispatch(fetchAdminMe()); }, [isLoggedIn, pathname, dispatch]);

  // Ctrl/Cmd + B toggles the sidebar; Esc closes the drawer
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (window.matchMedia('(min-width: 1024px)').matches) setCollapsed((c) => !c);
        else setMobileOpen((o) => !o);
      } else if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Document title per page
  const title = pageTitleFor(pathname);
  useEffect(() => { document.title = `${title} · WAH! Admin`; }, [title]);

  if (!isLoggedIn) return <Navigate to="/admin/login" replace />;

  const handleLogout = async () => {
    await dispatch(adminLogout());
    toast.success('Logged out');
    navigate('/admin/login');
  };

  const navGroups = filterNavByPermissions(admin);
  const currentItem = itemFor(pathname);
  const allowed = canAccess(admin, currentItem?.module);
  const firstAllowed = navGroups[0]?.items[0]?.path;
  // Landing on the dashboard without Dashboard access → go to the first module this role can use
  if (!allowed && pathname === '/admin' && firstAllowed && firstAllowed !== '/admin') {
    return <Navigate to={firstAllowed} replace />;
  }
  const toggleSidebar = () =>
    window.matchMedia('(min-width: 1024px)').matches ? setCollapsed((c) => !c) : setMobileOpen(true);

  return (
    <div className="admin-ui flex h-screen overflow-hidden bg-[color:var(--backdrop)]">
      {/* Desktop sidebar: sits on the backdrop; the content window is inset beside it */}
      <aside
        aria-label="Sidebar"
        className={`hidden h-full shrink-0 flex-col overflow-hidden whitespace-nowrap transition-[width] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none lg:flex ${collapsed ? 'w-14' : 'w-60'}`}
      >
        <SidebarBody collapsed={collapsed} groups={navGroups} admin={admin} onLogout={handleLogout} />
      </aside>

      {/* Below lg: drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside aria-label="Sidebar" className="relative flex h-dvh w-[17rem] max-w-[85vw] flex-col rounded-r-[10px] border-r border-[color:var(--border)] bg-[color:var(--surface-elevated)] shadow-2xl">
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu"
              className="absolute right-2 top-3 rounded-[4px] p-1 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]">
              <X className="size-4" />
            </button>
            <SidebarBody collapsed={false} groups={navGroups} admin={admin} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      {/* Content window */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden bg-[color:var(--background)] lg:border-l lg:border-[color:var(--border)]">
        <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3">
          <button type="button" onClick={toggleSidebar} aria-label="Toggle sidebar" title="Toggle sidebar (Ctrl+B)"
            className="flex size-7 items-center justify-center rounded-[6px] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]">
            <PanelLeft className="size-4" />
          </button>
          <img src="/wah_logo.jpg" alt="" className="h-6 w-auto rounded-[4px] lg:hidden" />
          <h1 className="truncate text-[14px] font-bold">{title}</h1>

          <div className="ml-auto flex items-center gap-1">
            <Link to="/" target="_blank" rel="noreferrer" title="Open the website in a new tab"
              className="mr-1 hidden h-8 items-center gap-1.5 rounded-[6px] border border-[color:var(--border)] px-2.5 text-[13px] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)] sm:inline-flex">
              <ExternalLink className="size-3.5" /> Website
            </Link>
            <div className="ml-1 flex items-center gap-2 border-l border-[color:var(--border)] pl-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-[color:var(--primary-soft)] text-[13px] font-bold text-[color:var(--primary)]">
                {initials(admin?.name)}
              </div>
              <div className="hidden leading-tight md:block">
                <div className="text-[13px] font-bold">{admin?.name || 'Admin'}</div>
                <div className="text-[12px] text-[color:var(--text-muted)]">{admin?.role || 'Administrator'}</div>
              </div>
              <button type="button" onClick={handleLogout} aria-label="Sign out" title="Sign out"
                className="flex size-8 items-center justify-center rounded-[6px] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--danger)]">
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="w-full p-3 md:p-4">
            {allowed ? <Outlet /> : <NoAccess title={title} home={firstAllowed} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function NoAccess({ title, home }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center">
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-[8px] bg-[color:var(--surface-secondary)] text-[color:var(--text-muted)]">
        <Lock className="size-5" />
      </div>
      <h2 className="text-[18px] font-bold">No access to {title}</h2>
      <p className="mt-1 text-[13px] text-[color:var(--text-muted)]">Your role doesn&apos;t include this module. Ask a Super Admin to grant it in Access Control.</p>
      {home && <Link to={home} className="btn-primary mt-4">Go to my workspace</Link>}
    </div>
  );
}

const initials = (name) =>
  (name || 'Admin').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

function SidebarBody({ collapsed, groups, admin, onLogout }) {
  return (
    <>
      {/* Brand */}
      <div className={`shrink-0 px-4 pb-2 pt-4 ${collapsed ? 'flex justify-center px-0 pt-3' : ''}`}>
        <Link to="/admin" title={collapsed ? 'WAH! Spices Admin — Dashboard' : undefined}
          className={`flex min-w-0 items-center rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(26,92,46,0.4)] ${collapsed ? 'size-9 justify-center' : '-mx-1 gap-2.5 px-1 py-0.5'}`}>
          <img src="/wah_logo.jpg" alt="WAH! Spices" className={`shrink-0 rounded-[6px] bg-white object-contain ${collapsed ? 'size-8' : 'size-9'}`} />
          {!collapsed && (
            <div className="leading-none">
              <div className="text-[15px] font-bold tracking-wide text-[color:var(--text-primary)]">WAH! Spices</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent-strong)]">Admin · ERP</div>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation — the only scroller; the fade hints at items below the fold */}
      <nav aria-label="Admin"
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-5 [mask-image:linear-gradient(to_bottom,black_calc(100%-1rem),transparent)] ${collapsed ? 'flex flex-col items-center px-0 [scrollbar-width:none]' : 'px-2.5'}`}>
        {groups.map((group, i) => (
          <div key={group.title} className={collapsed ? 'flex flex-col items-center' : i > 0 ? 'mt-2.5' : ''}>
            {collapsed
              ? i > 0 && <div className="my-1.5 h-px w-6 bg-[color:var(--border-strong)]" aria-hidden />
              : <div className="flex h-7 items-end px-2 pb-1 text-[11px] font-bold text-[color:var(--text-muted)]">{group.title}</div>}
            <ul className={`flex flex-col ${collapsed ? 'items-center gap-1' : 'gap-px'}`}>
              {group.items.map((item) => (
                <li key={item.path} className={collapsed ? '' : 'w-full'}>
                  <NavLink
                    to={item.path}
                    end={!!item.end}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={({ isActive }) => [
                      'group relative flex items-center gap-2 rounded-[6px] text-[14px] outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[rgba(26,92,46,0.4)]',
                      collapsed ? 'size-9 justify-center' : 'h-8 w-full px-2',
                      isActive
                        ? 'bg-[color:var(--selection)] font-bold text-[color:var(--text-primary)]'
                        : 'text-[color:var(--text-secondary)] hover:bg-[rgba(26,92,46,0.05)]',
                    ].join(' ')}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !collapsed && <span className="absolute -left-2.5 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[color:var(--accent)]" aria-hidden />}
                        <item.icon className="size-4 shrink-0 text-[color:var(--primary)]" strokeWidth={1.75} aria-hidden />
                        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: account + shortcut hint */}
      <div className={`flex shrink-0 flex-col gap-2 border-t border-[color:var(--border-strong)] px-2.5 py-2.5 ${collapsed ? 'items-center px-0' : ''}`}>
        {collapsed ? (
          <button type="button" onClick={onLogout} title="Sign out" aria-label="Sign out"
            className="flex size-9 items-center justify-center rounded-[6px] text-[color:var(--text-secondary)] hover:bg-[color:var(--selection)] hover:text-[color:var(--danger)]">
            <LogOut className="size-4" strokeWidth={1.75} />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-[6px] px-1 py-1">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[12px] font-bold text-white">
                {initials(admin?.name)}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[13px] font-bold text-[color:var(--text-primary)]">{admin?.name || 'Admin'}</div>
                <div className="truncate text-[11px] text-[color:var(--text-muted)]">{admin?.email || admin?.role || 'Administrator'}</div>
              </div>
              <button type="button" onClick={onLogout} title="Sign out" aria-label="Sign out"
                className="flex size-7 items-center justify-center rounded-[6px] text-[color:var(--text-muted)] hover:bg-[color:var(--selection)] hover:text-[color:var(--danger)]">
                <LogOut className="size-4" strokeWidth={1.75} />
              </button>
            </div>
            <p className="hidden px-1 text-[11px] text-[color:var(--text-muted)] lg:block">
              <kbd className="rounded-[4px] bg-[color:var(--surface-secondary)] px-1">Ctrl</kbd>{' '}
              <kbd className="rounded-[4px] bg-[color:var(--surface-secondary)] px-1">B</kbd> to collapse the sidebar
            </p>
          </>
        )}
      </div>
    </>
  );
}
