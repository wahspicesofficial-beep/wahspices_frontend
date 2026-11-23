// Company finance & compliance: expenses & split, partners & ledger, assets register, licences & alerts, reports.
import { useNavigate, useParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { Tabs, EmptyState } from '@/admin/ui';
import CompanyOverview from '@/admin/pages/company/CompanyOverview';
import CompanyExpenses from '@/admin/pages/company/CompanyExpenses';
import CompanyPartners from '@/admin/pages/company/CompanyPartners';
import CompanyAssets from '@/admin/pages/company/CompanyAssets';
import CompanyLicences from '@/admin/pages/company/CompanyLicences';
import CompanyReports from '@/admin/pages/company/CompanyReports';

const SECTIONS = [
  { value: 'overview', label: 'Overview & alerts', Component: CompanyOverview },
  { value: 'expenses', label: 'Expenses & split', Component: CompanyExpenses },
  { value: 'partners', label: 'Partners & ledger', Component: CompanyPartners },
  { value: 'assets', label: 'Assets', Component: CompanyAssets },
  { value: 'licences', label: 'Licences', Component: CompanyLicences },
  { value: 'reports', label: 'Reports', Component: CompanyReports },
];

export default function AdminCompany() {
  const { section = 'overview' } = useParams();
  const navigate = useNavigate();
  const current = SECTIONS.find((s) => s.value === section);
  const go = (v) => navigate(v === 'overview' ? '/admin/company' : `/admin/company/${v}`);

  return (
    <div className="space-y-4">
      <Tabs items={SECTIONS} value={current?.value} onChange={go} />
      {current ? <current.Component /> : (
        <EmptyState icon={Building2} title="Page not found">Pick a section above.</EmptyState>
      )}
    </div>
  );
}
