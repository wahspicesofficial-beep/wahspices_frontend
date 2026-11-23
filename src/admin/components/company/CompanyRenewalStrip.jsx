// Dashboard strip: licences in their reminder window / expired and asset warranties ending within 30 days.
// Renders nothing for admins without the Company module or when nothing needs attention.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { canAccess } from '@/admin/components/AdminLayout';
import { apiGet, daysText } from '@/admin/components/company/companyUtils';

export default function CompanyRenewalStrip() {
  const admin = useAppSelector((s) => s.admin.admin);
  const allowed = canAccess(admin, 'Company');
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    apiGet('/admin/company/alerts').then((d) => { if (live) setAlerts(d.alerts || []); }).catch(() => {});
    return () => { live = false; };
  }, [allowed]);

  if (!allowed || alerts.length === 0) return null;
  const urgent = alerts.some((a) => a.daysLeft <= 7);
  const first = alerts[0];
  return (
    <div className={`flex items-center gap-2.5 rounded-[8px] border px-3 py-2 text-[13px] ${urgent
      ? 'border-[rgba(176,56,47,0.25)] bg-[color:var(--danger-bg)] text-[color:var(--danger)]'
      : 'border-[rgba(180,83,15,0.25)] bg-[color:var(--warning-bg)] text-[color:var(--warning)]'}`}>
      <BellRing className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate text-[color:var(--text-primary)]">
        <b>{alerts.length} renewal{alerts.length > 1 ? 's' : ''} due</b> · {first.title} ({daysText(first.daysLeft).toLowerCase()})
        {alerts.length > 1 && ` and ${alerts.length - 1} more`}
      </span>
      <Link to="/admin/company" className="shrink-0 text-[12px] font-bold hover:underline">Review →</Link>
    </div>
  );
}
