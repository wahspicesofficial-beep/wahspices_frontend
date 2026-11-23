import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/services/api';

/** Profile → "Marketing emails" switch (offers, sales, launches). Order / account emails are always sent. */
export default function MarketingEmailToggle() {
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/notifications/preferences').then((r) => setOn(!!r.data.data.marketingEmails)).catch(() => setOn(null));
  }, []);

  if (on === null) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const r = await api.put('/notifications/preferences', { marketingEmails: !on });
      setOn(!!r.data.data.marketingEmails);
      toast.success(r.data.message);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not save your preference');
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-gray-800" id="marketing-emails-label">Marketing emails</div>
        <div className="text-xs text-gray-500">Offers, sales and new product launches. Order emails are always sent.</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="marketing-emails-label"
        disabled={busy}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-brand-green' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
