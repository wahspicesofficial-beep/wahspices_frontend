import { useState, useEffect } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { SkPageHeader, SkForm } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchSettings, updateSettings } from '@/store/slices/adminSlice';
import { PageHeader, Card, Button, Field, Badge, cn } from '@/admin/ui';
import MasterDataManager from '@/admin/components/MasterDataManager';
import SecuritySettingsCard from '@/admin/components/SecuritySettingsCard';

/** Small on/off switch in WAH green (or red for destructive toggles) */
function Switch({ checked, onChange, danger, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? (danger ? 'bg-[color:var(--danger)]' : 'bg-[color:var(--primary)]') : 'bg-[color:var(--border-strong)]',
      )}
    >
      <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

export default function AdminSettings() {
  const dispatch = useAppDispatch();
  const saved    = useAppSelector((s) => s.admin.settings);

  // Every value starts empty and is filled from GET /admin/settings (the backend supplies the defaults).
  const [general, setGeneral] = useState({ siteName: '', tagline: '', email: '', phone: '', address: '', gstin: '', fssai: '', udyamNumber: '' });
  const [shipping, setShipping] = useState({ freeDeliveryAbove: '', deliveryCharge: '', avgDeliveryDays: '', codAvailable: false });
  const [notifications, setNotifications] = useState({ orderEmails: false, lowStockAlerts: false, reviewAlerts: false, weeklyReport: false });
  const [maintenance, setMaintenance] = useState(false);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [savingSection, setSavingSection] = useState(null);

  const load = async () => {
    setLoadState('loading');
    const res = await dispatch(fetchSettings());
    if (fetchSettings.fulfilled.match(res)) setLoadState('ready');
    else { setLoadState('error'); toast.error(res.payload || 'Failed to load settings'); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!saved) return;
    setGeneral({
      siteName: saved.siteName ?? '',
      tagline:  saved.tagline  ?? '',
      email:    saved.email    ?? '',
      phone:    saved.phone    ?? '',
      address:  saved.address  ?? '',
      gstin:    saved.gstin ?? saved.gst ?? '',
      fssai:    saved.fssai    ?? '',
      udyamNumber: saved.udyamNumber ?? '',
    });
    setShipping({
      freeDeliveryAbove: saved.freeDeliveryAbove ?? '',
      deliveryCharge:    saved.deliveryCharge    ?? '',
      avgDeliveryDays:   saved.avgDeliveryDays   ?? '',
      codAvailable:      !!saved.codAvailable,
    });
    setNotifications({
      orderEmails:    !!saved.orderEmails,
      lowStockAlerts: !!saved.lowStockAlerts,
      reviewAlerts:   !!saved.reviewAlerts,
      weeklyReport:   !!saved.weeklyReport,
    });
    setMaintenance(!!saved.maintenanceMode);
  }, [saved]);

  const handleSave = async (section, patch) => {
    setSavingSection(section);
    const result = await dispatch(updateSettings(patch));
    setSavingSection(null);
    if (updateSettings.fulfilled.match(result)) {
      toast.success(`${section} settings saved!`, { icon: '✅', style: { borderRadius: '12px' } });
      return true;
    }
    toast.error(result.payload || 'Failed to save');
    return false;
  };

  const loading = loadState !== 'ready';
  const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

  if (loadState === 'loading' && !saved) return (
    <div className="space-y-6"><SkPageHeader /><SkForm fields={8} /></div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Manage your store configuration"
        actions={loadState === 'error' ? <Button variant="secondary" onClick={load}>Retry loading</Button> : null}
      />

      {/* General Settings */}
      <Card
        title="General"
        bodyClassName="p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Site Name',        key: 'siteName'  },
            { label: 'Tagline',          key: 'tagline'   },
            { label: 'Support Email',    key: 'email'     },
            { label: 'Phone',            key: 'phone'     },
            { label: 'Address',          key: 'address', wide: true },
            { label: 'GSTIN',            key: 'gstin'     },
            { label: 'FSSAI Licence No', key: 'fssai'     },
            { label: 'Udyam Registration No', key: 'udyamNumber' },
          ].map((f) => (
            <Field key={f.key} label={f.label} className={f.wide ? 'sm:col-span-2' : undefined}>
              <input
                type="text"
                value={general[f.key]}
                onChange={(e) => setGeneral((g) => ({ ...g, [f.key]: e.target.value }))}
                className="input-field"
                disabled={loading}
              />
            </Field>
          ))}
        </div>
        <div className="mt-4 flex justify-end border-t border-[color:var(--border)] pt-3">
          <Button
            onClick={() => handleSave('General', {
              siteName: general.siteName,
              tagline:  general.tagline,
              email:    general.email,
              phone:    general.phone,
              address:  general.address,
              gstin:    general.gstin.trim().toUpperCase(),
              fssai:    general.fssai,
              udyamNumber: general.udyamNumber.trim().toUpperCase(),
            })}
            disabled={loading}
            loading={savingSection === 'General'}
          >
            <Save className="size-4" /> Save general settings
          </Button>
        </div>
      </Card>

      {/* Shipping Settings */}
      <Card title="Shipping" bodyClassName="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Free Delivery Above (₹)">
            <input
              type="number"
              value={shipping.freeDeliveryAbove}
              onChange={(e) => setShipping((s) => ({ ...s, freeDeliveryAbove: e.target.value }))}
              min={0}
              className="input-field"
              disabled={loading}
            />
          </Field>
          <Field label="Delivery Charge (₹)">
            <input
              type="number"
              value={shipping.deliveryCharge}
              onChange={(e) => setShipping((s) => ({ ...s, deliveryCharge: e.target.value }))}
              min={0}
              className="input-field"
              disabled={loading}
            />
          </Field>
          <Field label="Avg Delivery Time">
            <input
              type="text"
              value={shipping.avgDeliveryDays}
              onChange={(e) => setShipping((s) => ({ ...s, avgDeliveryDays: e.target.value }))}
              className="input-field"
              placeholder="e.g. 3-5"
              disabled={loading}
            />
          </Field>
          <div className="flex items-center gap-2.5 self-end pb-2">
            <input
              type="checkbox"
              id="cod"
              checked={shipping.codAvailable}
              onChange={(e) => setShipping((s) => ({ ...s, codAvailable: e.target.checked }))}
              className="size-4 accent-[#1a5c2e]"
            />
            <label htmlFor="cod" className="text-[13px] font-bold text-[color:var(--text-secondary)]">
              Cash on Delivery Available
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-end border-t border-[color:var(--border)] pt-3">
          <Button
            onClick={() => handleSave('Shipping', {
              freeDeliveryAbove: numOrNull(shipping.freeDeliveryAbove),
              deliveryCharge:    numOrNull(shipping.deliveryCharge),
              avgDeliveryDays:   shipping.avgDeliveryDays,
              codAvailable:      shipping.codAvailable,
            })}
            disabled={loading}
            loading={savingSection === 'Shipping'}
          >
            <Save className="size-4" /> Save shipping settings
          </Button>
        </div>
      </Card>

      {/* Notifications */}
      <Card title="Notification preferences" bodyClassName="px-4 pb-4 pt-1">
        <div className="divide-y divide-[color:var(--border)]">
          {[
            { key: 'orderEmails',    label: 'New Order Emails',       desc: 'Get an email when a new order is placed'  },
            { key: 'lowStockAlerts', label: 'Low Stock Alerts',       desc: 'Alert when an item falls to its reorder point' },
            { key: 'reviewAlerts',   label: 'Customer Review Alerts', desc: 'Notification for new reviews'             },
            { key: 'weeklyReport',   label: 'Weekly Sales Report',    desc: 'Summary email every Monday morning'       },
          ].map((n) => (
            <div key={n.key} className="flex items-center justify-between gap-4 py-2.5">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[color:var(--text-primary)]">{n.label}</div>
                <div className="text-[12px] text-[color:var(--text-muted)]">{n.desc}</div>
              </div>
              <Switch
                label={n.label}
                checked={!!notifications[n.key]}
                onChange={() => setNotifications((prev) => ({ ...prev, [n.key]: !prev[n.key] }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-end border-t border-[color:var(--border)] pt-3">
          <Button
            onClick={() => handleSave('Notification', {
              orderEmails:    notifications.orderEmails,
              lowStockAlerts: notifications.lowStockAlerts,
              reviewAlerts:   notifications.reviewAlerts,
              weeklyReport:   notifications.weeklyReport,
            })}
            disabled={loading}
            loading={savingSection === 'Notification'}
          >
            <Save className="size-4" /> Save notification settings
          </Button>
        </div>
      </Card>

      {/* Maintenance Mode */}
      <Card
        title="Maintenance mode"
        actions={<Badge tone={maintenance ? 'danger' : 'neutral'}>{maintenance ? 'On' : 'Off'}</Badge>}
        bodyClassName="p-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] text-[color:var(--text-secondary)]">
              When enabled, visitors will see a maintenance page instead of the website.
            </p>
            {maintenance && (
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-[color:var(--danger)]">
                <AlertTriangle className="size-3.5" /> Maintenance mode is ON
              </p>
            )}
          </div>
          <Switch
            danger
            label="Maintenance mode"
            checked={maintenance}
            onChange={async () => {
              if (loading || savingSection) return;
              const next = !maintenance;
              setMaintenance(next);
              const ok = await handleSave('Maintenance', { maintenanceMode: next });
              if (!ok) setMaintenance(!next); // revert the switch when the save failed
            }}
          />
        </div>
      </Card>

      <SecuritySettingsCard />

      <MasterDataManager />
    </div>
  );
}
