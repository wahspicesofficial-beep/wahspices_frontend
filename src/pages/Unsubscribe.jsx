import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailX, MailCheck, Loader2 } from 'lucide-react';
import api from '@/services/api';

/**
 * /unsubscribe?token=… — linked from every campaign email. Shows who the link belongs to (masked) and
 * unsubscribes with one click; "Subscribe again" undoes it. Order / account emails are not affected.
 */
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState({ loading: true, error: '', email: '', optedOut: false, message: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState({ loading: false, error: 'This unsubscribe link is incomplete.', email: '', optedOut: false, message: '' }); return; }
    api.get('/marketing/unsubscribe', { params: { token } })
      .then((res) => setState({ loading: false, error: '', email: res.data.data.email, optedOut: res.data.data.optedOut, message: '' }))
      .catch((err) => setState({ loading: false, error: err.response?.data?.error?.message || 'This link could not be checked. Please try again.', email: '', optedOut: false, message: '' }));
  }, [token]);

  const submit = async (unsubscribe) => {
    setBusy(true);
    try {
      const res = unsubscribe
        ? await api.post('/marketing/unsubscribe', { token })
        : await api.post('/marketing/resubscribe', { token });
      setState((s) => ({ ...s, optedOut: res.data.data.optedOut, message: res.data.message }));
    } catch (err) {
      setState((s) => ({ ...s, message: err.response?.data?.error?.message || 'Something went wrong. Please try again.' }));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-[70vh] bg-brand-cream flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md card p-8 text-center font-body">
        {state.loading ? (
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-brand-green" aria-label="Loading" />
        ) : state.error ? (
          <>
            <MailX className="w-10 h-10 mx-auto text-brand-red" />
            <h1 className="mt-3 text-2xl font-heading font-bold text-brand-green-dark">Link not valid</h1>
            <p className="mt-2 text-sm text-gray-500">{state.error}</p>
            <Link to="/profile" className="btn-primary mt-6 inline-flex">Email preferences</Link>
          </>
        ) : (
          <>
            {state.optedOut ? <MailX className="w-10 h-10 mx-auto text-brand-green" /> : <MailCheck className="w-10 h-10 mx-auto text-brand-green" />}
            <h1 className="mt-3 text-2xl font-heading font-bold text-brand-green-dark">
              {state.optedOut ? "You're unsubscribed" : 'Unsubscribe from offers?'}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {state.optedOut
                ? <>We won&apos;t send offers and product news to <strong>{state.email}</strong> any more. Order and account emails will still reach you.</>
                : <>Stop offers, sales and new-product emails to <strong>{state.email}</strong>. Order and account emails will still reach you.</>}
            </p>
            {state.message && <p className="mt-3 text-sm text-brand-green" role="status">{state.message}</p>}
            <div className="mt-6 flex justify-center gap-3">
              {state.optedOut
                ? <button type="button" className="btn-outline" disabled={busy} onClick={() => submit(false)}>Subscribe again</button>
                : <button type="button" className="btn-primary" disabled={busy} onClick={() => submit(true)}>Unsubscribe</button>}
              <Link to="/" className="btn-ghost">Back to shop</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
