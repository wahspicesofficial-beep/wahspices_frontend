import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';

// /forgot-password  → ask for the account email (the API answers the same whether or not it exists)
// /reset-password?token=… → choose a new password (token is single-use, 30-minute expiry)
const errMsg = (err, fallback) => err.response?.data?.error?.message || fallback;
const strongEnough = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const requestLink = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { toast.error('Please enter a valid email address'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      toast.error(errMsg(err, 'Could not send the reset link. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (!strongEnough(password)) { toast.error('Use at least 8 characters with letters and numbers'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      toast.success('Password updated — please sign in', { icon: '✅', style: { borderRadius: '12px' } });
      navigate('/login');
    } catch (err) {
      toast.error(errMsg(err, 'This reset link is invalid or has expired.'));
    } finally {
      setLoading(false);
    }
  };

  const title = token ? 'Set a new password' : 'Forgot password';
  const subtitle = token
    ? 'Choose a strong password you have not used before.'
    : sent
      ? 'If an account exists for that email, a reset link is on its way. It expires in 30 minutes.'
      : 'Enter your account email and we will send you a reset link.';

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-brand-green-dark mb-2">{title}</h1>
          <p className="text-gray-500 text-sm">{subtitle}</p>
        </div>

        <div className="card p-8">
          {token ? (
            <form onSubmit={resetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                <div className="relative">
                  <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-10" placeholder="At least 8 characters, letters + numbers" autoComplete="new-password" maxLength={128} />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="input-field" placeholder="Repeat the new password" autoComplete="new-password" maxLength={128} />
              </div>
              <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Update password'}
              </button>
            </form>
          ) : sent ? (
            <div className="space-y-4 text-center">
              <div className="text-5xl">📧</div>
              <p className="text-sm text-gray-600">Check your inbox (and spam folder) for an email from WAH! Spices.</p>
              <button onClick={() => setSent(false)} className="text-sm text-brand-green hover:underline">Use a different email</button>
            </div>
          ) : (
            <form onSubmit={requestLink} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field"
                  placeholder="you@example.com" autoComplete="email" maxLength={256} />
              </div>
              <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Send reset link'}
              </button>
              {/* OTP login disabled for now
              <div className="text-center">
                <Link to="/otp" className="text-sm text-gray-500 hover:text-brand-green">Prefer a one-time code? Login with OTP</Link>
              </div>
              */}
            </form>
          )}
          <div className="text-center mt-4">
            <Link to="/login" className="text-sm text-brand-green hover:underline flex items-center justify-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-400">
          <span>🔒</span>
          <span>100% Secure Login</span>
        </div>
      </motion.div>
    </div>
  );
}
