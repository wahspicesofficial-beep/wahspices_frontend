import { useState, useEffect } from 'react';
import { Save, ShieldCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppDispatch } from '@/store/hooks';
import { fetchSecuritySettings, saveSecuritySettings } from '@/store/slices/adminSlice';
import { Card, Button, Field, Badge, cn } from '@/admin/ui';

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={onChange}
      className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--border-strong)]')}
    >
      <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

/** Settings → Security: admin 2FA enforcement, idle timeout, max sessions, IP allow-list (enforced by the backend). */
export default function SecuritySettingsCard() {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState(null);
  const [allowText, setAllowText] = useState('');
  const [meta, setMeta] = useState({ yourIp: '', adminsWithout2FA: 0 });
  const [state, setState] = useState('loading');   // loading | ready | error
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setState('loading');
    const res = await dispatch(fetchSecuritySettings());
    if (fetchSecuritySettings.fulfilled.match(res)) {
      const d = res.payload || {};
      setForm({
        enforce2FA: !!d.enforce2FA,
        idleTimeoutMinutes: d.idleTimeoutMinutes ?? 0,
        maxConcurrentSessions: d.maxConcurrentSessions ?? 0,
        ipAllowlistEnabled: !!d.ipAllowlistEnabled,
      });
      setAllowText((d.ipAllowlist || []).join('\n'));
      setMeta({ yourIp: d.yourIp || '', adminsWithout2FA: d.adminsWithout2FA ?? 0 });
      setState('ready');
    } else {
      setState('error');
      toast.error(res.payload || 'Failed to load security settings');
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const ipAllowlist = allowText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    const res = await dispatch(saveSecuritySettings({
      enforce2FA: form.enforce2FA,
      idleTimeoutMinutes: Number(form.idleTimeoutMinutes) || 0,
      maxConcurrentSessions: Number(form.maxConcurrentSessions) || 0,
      ipAllowlistEnabled: form.ipAllowlistEnabled,
      ipAllowlist,
    }));
    setSaving(false);
    if (saveSecuritySettings.fulfilled.match(res)) toast.success('Security settings saved');
    else toast.error(res.payload || 'Failed to save security settings');
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const disabled = state !== 'ready' || saving;

  return (
    <Card
      title="Security"
      actions={<Badge tone={form?.enforce2FA ? 'success' : 'neutral'}>{form?.enforce2FA ? '2FA required' : '2FA optional'}</Badge>}
      bodyClassName="p-4"
    >
      {state === 'error' ? (
        <div className="flex items-center justify-between gap-3 text-[13px] text-[color:var(--text-secondary)]">
          Couldn't load the security settings. <Button variant="secondary" onClick={load}>Retry</Button>
        </div>
      ) : !form ? (
        <div className="h-24 animate-pulse rounded-[8px] bg-[color:var(--border)]" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[13px] font-bold">Require two-factor authentication for all admins</div>
              <p className="text-[12px] text-[color:var(--text-secondary)]">
                Admins without 2FA are asked to set it up (authenticator app) the next time they sign in.
                {meta.adminsWithout2FA > 0 && <> Currently <b>{meta.adminsWithout2FA}</b> active admin(s) have no 2FA.</>}
              </p>
            </div>
            <Toggle label="Require 2FA" checked={form.enforce2FA} disabled={disabled} onChange={() => set('enforce2FA', !form.enforce2FA)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Idle timeout (minutes, 0 = off)">
              <input type="number" min={0} max={1440} className="input-field" disabled={disabled}
                value={form.idleTimeoutMinutes} onChange={(e) => set('idleTimeoutMinutes', e.target.value)} />
            </Field>
            <Field label="Max sessions per admin (0 = unlimited)">
              <input type="number" min={0} max={100} className="input-field" disabled={disabled}
                value={form.maxConcurrentSessions} onChange={(e) => set('maxConcurrentSessions', e.target.value)} />
            </Field>
          </div>

          <div className="space-y-2 border-t border-[color:var(--border)] pt-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13px] font-bold">Admin IP allow-list</div>
                <p className="text-[12px] text-[color:var(--text-secondary)]">
                  When on, the admin panel only works from these IPs / ranges (one per line, e.g. 203.0.113.7 or 203.0.113.0/24).
                  Your current IP: <span className="font-mono font-bold">{meta.yourIp || '—'}</span>
                </p>
              </div>
              <Toggle label="IP allow-list" checked={form.ipAllowlistEnabled} disabled={disabled}
                onChange={() => set('ipAllowlistEnabled', !form.ipAllowlistEnabled)} />
            </div>
            <textarea rows={3} className="input-field !h-auto font-mono text-[12px]" disabled={disabled}
              placeholder={meta.yourIp ? `${meta.yourIp}\n10.0.0.0/8` : '203.0.113.0/24'}
              value={allowText} onChange={(e) => setAllowText(e.target.value)} />
            {form.ipAllowlistEnabled && (
              <p className="inline-flex items-center gap-1 text-[12px] font-bold text-[color:var(--danger)]">
                <AlertTriangle className="size-3.5" /> Make sure your own IP is listed — saving is refused otherwise.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[color:var(--border)] pt-3">
            <p className="inline-flex items-center gap-1 text-[12px] text-[color:var(--text-muted)]">
              <ShieldCheck className="size-3.5" /> Only a Super Admin can change these.
            </p>
            <Button onClick={save} disabled={disabled} loading={saving}>
              <Save className="size-4" /> Save security settings
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
