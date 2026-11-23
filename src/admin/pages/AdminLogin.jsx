import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { QRCodeSVG } from 'qrcode.react';
import { adminLogin, adminVerify2FALogin, adminSetup2FALogin, adminEnable2FALogin, cancelAdmin2FA } from '@/store/slices/adminSlice';
import toast from 'react-hot-toast';
import '@/admin/admin.css';

const loginSchema = yup.object({
  email:    yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().min(6, 'Min 6 characters').required('Password is required'),
});

export default function AdminLogin() {
  const [showPass, setShowPass] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error, requires2FA, tempToken, requires2FASetup, setupToken } = useAppSelector(s => s.admin);
  const [setupInfo, setSetupInfo] = useState(null);   // { secret, qrUri, backupCodes } for forced 2FA setup

  // Security policy requires 2FA and this admin hasn't set it up yet → fetch a secret + QR to scan.
  useEffect(() => {
    if (!requires2FASetup || !setupToken || setupInfo) return;
    dispatch(adminSetup2FALogin(setupToken)).then((res) => {
      if (adminSetup2FALogin.fulfilled.match(res)) setSetupInfo(res.payload);
      else toast.error(res.payload || 'Could not start 2FA setup');
    });
  }, [requires2FASetup, setupToken, setupInfo, dispatch]);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    const res = await dispatch(adminLogin({ email: data.email, password: data.password }));
    if (adminLogin.fulfilled.match(res)) {
      if (res.payload?.requires2FA || res.payload?.requires2FASetup) { setTwoFACode(''); setSetupInfo(null); return; } // show 2FA step
      toast.success(`Welcome back${res.payload?.admin?.name ? `, ${res.payload.admin.name}` : ''}!`, { icon: '🛡️', style: { borderRadius: '12px' } });
      navigate('/admin');
    } else {
      toast.error(res.payload || 'Invalid credentials.', { style: { borderRadius: '12px' } });
    }
  };

  const onVerify2FA = async () => {
    if (twoFACode.length < 6) { toast.error('Enter your 6-digit code'); return; }
    const res = await dispatch(adminVerify2FALogin({ tempToken, code: twoFACode }));
    if (adminVerify2FALogin.fulfilled.match(res)) {
      setTwoFACode('');
      toast.success(`Welcome back${res.payload?.admin?.name ? `, ${res.payload.admin.name}` : ''}!`, { icon: '🛡️', style: { borderRadius: '12px' } });
      navigate('/admin');
    } else {
      toast.error(res.payload || 'Invalid 2FA code', { style: { borderRadius: '12px' } });
    }
  };

  const onEnable2FA = async () => {
    if (twoFACode.length !== 6) { toast.error('Enter the 6-digit code from your app'); return; }
    const res = await dispatch(adminEnable2FALogin({ setupToken, code: twoFACode }));
    if (adminEnable2FALogin.fulfilled.match(res)) {
      setTwoFACode(''); setSetupInfo(null);
      toast.success('Two-factor authentication is on. Welcome!', { icon: '🛡️', style: { borderRadius: '12px' } });
      navigate('/admin');
    } else {
      toast.error(res.payload || 'Invalid code', { style: { borderRadius: '12px' } });
    }
  };

  const step = requires2FASetup ? 'setup' : requires2FA ? '2fa' : 'login';

  return (
    <div className="admin-ui flex min-h-screen items-center justify-center bg-[color:var(--backdrop)] p-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        className="w-full max-w-[400px] overflow-hidden rounded-[10px] bg-[color:var(--surface)] shadow-[var(--window-shadow)]">
        <div className="h-1 bg-[linear-gradient(90deg,#1a5c2e_0%,#1a5c2e_65%,#f5a623_65%)]" aria-hidden />
        <div className="p-7">
        <div className="mb-6 flex items-center gap-3">
          <img src="/wah_logo.jpg" alt="WAH! Spices" className="size-11 rounded-[8px] border border-[color:var(--border)] bg-white object-contain" />
          <div className="leading-tight">
            <div className="text-[16px] font-bold">WAH! Spices</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent-strong)]">Admin · ERP</div>
          </div>
        </div>
        <div className="mb-5">
          <h1 className="flex items-center gap-2 text-[22px] font-bold">
            {step !== 'login' ? <KeyRound className="size-5 text-[color:var(--primary)]" /> : <ShieldCheck className="size-5 text-[color:var(--primary)]" />}
            {step === 'setup' ? 'Set up two-factor sign-in' : step === '2fa' ? 'Two-factor verification' : 'Sign in'}
          </h1>
          <p className="mt-1 text-[13px] text-[color:var(--text-muted)]">
            {step === 'setup'
              ? 'Your organisation requires 2FA. Scan the QR code with Google Authenticator, Microsoft Authenticator or similar, then enter the 6-digit code.'
              : step === '2fa' ? 'Enter the 6-digit code from your authenticator app.' : 'Use your admin account to open the control panel.'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'setup' ? (
            <motion.div key="setup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="space-y-4">
              {!setupInfo ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[color:var(--primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex justify-center rounded-[8px] border border-[color:var(--border)] bg-white p-3">
                    <QRCodeSVG value={setupInfo.qrUri} size={168} aria-label="2FA QR code" />
                  </div>
                  <p className="text-center text-[11px] text-[color:var(--text-muted)] break-all">
                    Can't scan? Enter this key: <span className="font-mono font-bold">{setupInfo.secret}</span>
                  </p>
                  {setupInfo.backupCodes?.length > 0 && (
                    <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-2,#f7f7f5)] p-3">
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-muted)]">Backup codes — save them now</div>
                      <div className="grid grid-cols-2 gap-1 font-mono text-[12px]">
                        {setupInfo.backupCodes.map(c => <span key={c}>{c}</span>)}
                      </div>
                    </div>
                  )}
                  <input
                    value={twoFACode}
                    onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => { if (e.key === 'Enter') onEnable2FA(); }}
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    className="input-field !h-11 text-center !text-[22px] tracking-[0.4em] font-mono"
                    autoFocus
                  />
                  {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                  <button onClick={onEnable2FA} disabled={loading || twoFACode.length !== 6} className="btn-primary w-full !h-10">
                    {loading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><KeyRound className="w-4 h-4" /> Turn on 2FA & sign in</>}
                  </button>
                </>
              )}
              <button type="button" onClick={() => { setTwoFACode(''); setSetupInfo(null); dispatch(cancelAdmin2FA()); }}
                className="w-full text-center text-[12px] font-bold text-[color:var(--primary)] hover:underline">
                ← Back to sign in
              </button>
            </motion.div>
          ) : step === 'login' ? (
            <motion.form key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-body font-semibold text-gray-700 mb-1.5">Admin Email</label>
                <input type="email" {...register('email')} className="input-field" placeholder="admin@wahspices.in" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-body font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} {...register('password')} placeholder="Enter password" className="input-field pr-10" />
                  <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full !h-10">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><ShieldCheck className="w-4 h-4" /> Sign in</>}
              </button>
            </motion.form>
          ) : (
            <motion.div key="2fa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="space-y-4">
              <div>
                <label className="block text-sm font-body font-semibold text-gray-700 mb-1.5">Authenticator Code</label>
                <input
                  value={twoFACode}
                  // 6-digit TOTP, or an 8-character backup code (letters + digits)
                  onChange={e => setTwoFACode(e.target.value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 8))}
                  onKeyDown={e => { if (e.key === 'Enter') onVerify2FA(); }}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={8}
                  className="input-field !h-11 text-center !text-[22px] tracking-[0.4em] font-mono"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1 text-center">Enter a 6-digit code or 8-character backup code</p>
              </div>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button onClick={onVerify2FA} disabled={loading || twoFACode.length < 6}
                className="btn-primary w-full !h-10">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><KeyRound className="w-4 h-4" /> Verify & sign in</>}
              </button>
              <button type="button" onClick={() => { setTwoFACode(''); dispatch(cancelAdmin2FA()); }}
                className="w-full text-center text-[12px] font-bold text-[color:var(--primary)] hover:underline">
                ← Back to sign in
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-6 border-t border-[color:var(--border)] pt-4 text-center text-xs text-gray-400">
          Not an admin? <a href="/" className="font-bold text-[color:var(--primary)] hover:underline">Go to website</a>
        </p>
        </div>
      </motion.div>
    </div>
  );
}
