import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Mail, RotateCcw } from 'lucide-react';
// import { GoogleLogin } from '@react-oauth/google';   // Google sign-in disabled for now
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  loginUser, registerUser, googleLogin, verifyEmailOtp, resendEmailOtp, clearPendingEmail,
} from '@/store/slices/authSlice';
import toast from 'react-hot-toast';

const loginSchema = yup.object({
  email: yup.string().email('Invalid email address').required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

const registerSchema = yup.object({
  name: yup.string().min(2, 'Name must be at least 2 characters').required('Name is required'),
  email: yup.string().email('Invalid email address').required('Email is required'),
  phone: yup.string()
    .matches(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
    .required('Phone number is required'),
  password: yup.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .matches(/[A-Za-z]/, 'Password must contain a letter')
    .matches(/\d/, 'Password must contain a number')
    .required('Password is required'),
});

export default function Login() {
  const [mode, setMode] = useState('login');
  const [showPass, setShowPass] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  // where to go after signing in (e.g. /profile/orders?order=12 from an order email) — internal paths only
  const from = location.state?.from;
  const returnTo = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
  const dispatch = useAppDispatch();
  const { loading, error, pendingEmail, maskedEmail } = useAppSelector((s) => s.auth);

  const { register: regL, handleSubmit: hsL, formState: { errors: le } } = useForm({ resolver: yupResolver(loginSchema) });
  const { register: regR, handleSubmit: hsR, formState: { errors: re } } = useForm({ resolver: yupResolver(registerSchema) });

  useEffect(() => {
    if (pendingEmail) { setMode('verify-email'); startResendTimer(); }
  }, [pendingEmail]);

  const startResendTimer = () => setResendTimer(60);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const onLoginSubmit = async (data) => {
    const res = await dispatch(loginUser({ email: data.email, password: data.password }));
    if (loginUser.fulfilled.match(res)) {
      toast.success('Welcome back!', { icon: '👋', style: { borderRadius: '12px' } });
      navigate(returnTo);
    } else {
      toast.error(res.payload || 'Login failed');
    }
  };

  const onRegisterSubmit = async (data) => {
    const res = await dispatch(registerUser({ name: data.name, email: data.email, phone: data.phone, password: data.password }));
    if (registerUser.fulfilled.match(res)) {
      toast.success('OTP sent to your email!', { icon: '📧', style: { borderRadius: '12px' } });
    } else {
      toast.error(res.payload || 'Registration failed');
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value.slice(-1);
    setOtpDigits(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { setOtpDigits(pasted.split('')); otpRefs.current[5]?.focus(); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length < 6) { toast.error('Please enter the complete 6-digit OTP'); return; }
    const res = await dispatch(verifyEmailOtp({ email: pendingEmail, otp }));
    if (verifyEmailOtp.fulfilled.match(res)) {
      toast.success('Email verified! Welcome to Wah Spices!', { icon: '🎉', style: { borderRadius: '12px' } });
      navigate(returnTo);
    } else {
      toast.error(res.payload || 'Invalid OTP');
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    const res = await dispatch(resendEmailOtp({ email: pendingEmail }));
    if (resendEmailOtp.fulfilled.match(res)) {
      toast.success('OTP resent!', { icon: '📧' });
      startResendTimer();
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } else {
      toast.error(res.payload || 'Failed to resend OTP');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const res = await dispatch(googleLogin(credentialResponse.credential));
    if (googleLogin.fulfilled.match(res)) {
      toast.success('Logged in with Google!', { icon: '🎉', style: { borderRadius: '12px' } });
      navigate(returnTo);
    } else {
      toast.error(res.payload || 'Google login failed');
    }
  };

  const switchMode = (m) => {
    if (m !== 'verify-email') dispatch(clearPendingEmail());
    setMode(m);
  };

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-brand-green-dark mb-2">
            {mode === 'login' ? 'Welcome Back!' : mode === 'register' ? 'Create Account' : 'Verify Email'}
          </h1>
          <p className="text-gray-500 text-sm">
            {mode === 'login'
              ? 'Sign in to your Wah Spices account'
              : mode === 'register'
              ? 'Join the Wah Spices family today'
              : `OTP sent to: ${maskedEmail}`}
          </p>
        </div>

        <div className="card p-8">
          <AnimatePresence mode="wait">

            {/* OTP Verify Step */}
            {mode === 'verify-email' && (
              <motion.div key="verify-email" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <div className="flex items-center justify-center mb-6">
                  <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center">
                    <Mail className="w-8 h-8 text-brand-green" />
                  </div>
                </div>
                <p className="text-center text-sm text-gray-600 mb-6">
                  <span className="font-medium text-gray-800">{maskedEmail}</span> pe 6-digit OTP bheja gaya hai. Apna email inbox check karo.
                </p>
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3 text-center">Enter OTP</label>
                    <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                      {otpDigits.map((d, i) => (
                        <input
                          key={i}
                          ref={(el) => (otpRefs.current[i] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={d}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl focus:outline-none focus:border-brand-green transition-colors"
                          style={{ borderColor: d ? '#2d6a4f' : '#e5e7eb' }}
                        />
                      ))}
                    </div>
                  </div>
                  {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                  <button type="submit" disabled={loading || otpDigits.join('').length < 6}
                    className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><ArrowRight className="w-4 h-4" />Verify &amp; Continue</>}
                  </button>
                </form>
                <div className="text-center mt-4">
                  <button onClick={handleResend} disabled={resendTimer > 0 || loading}
                    className="text-sm flex items-center gap-1.5 mx-auto text-brand-green hover:underline disabled:text-gray-400 disabled:no-underline">
                    <RotateCcw className="w-3.5 h-3.5" />
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                </div>
                <div className="text-center mt-3">
                  <button onClick={() => switchMode('register')} className="text-xs text-gray-400 hover:text-gray-600">
                    ← Go back
                  </button>
                </div>
              </motion.div>
            )}

            {/* Login / Register Step */}
            {mode !== 'verify-email' && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                  {['login', 'register'].map((m) => (
                    <button key={m} onClick={() => switchMode(m)}
                      className={`flex-1 py-2 text-sm font-medium rounded-xl capitalize transition-all ${mode === m ? 'bg-white text-brand-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {m === 'login' ? 'Sign In' : 'Register'}
                    </button>
                  ))}
                </div>

                {/* LOGIN FORM */}
                {mode === 'login' && (
                  <form onSubmit={hsL(onLoginSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                      <input type="email" {...regL('email')} placeholder="your@email.com" className="input-field" />
                      {le.email && <p className="text-red-500 text-xs mt-1">{le.email.message}</p>}
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <Link to="/forgot-password" className="text-xs text-brand-green hover:underline">Forgot Password?</Link>
                      </div>
                      <div className="relative">
                        <input type={showPass ? 'text' : 'password'} {...regL('password')} placeholder="Enter password" className="input-field pr-10" />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {le.password && <p className="text-red-500 text-xs mt-1">{le.password.message}</p>}
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                      {loading
                        ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>
                )}

                {/* REGISTER FORM */}
                {mode === 'register' && (
                  <form onSubmit={hsR(onRegisterSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                      <input type="text" {...regR('name')} placeholder="Your full name" className="input-field" />
                      {re.name && <p className="text-red-500 text-xs mt-1">{re.name.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                      <input type="email" {...regR('email')} placeholder="your@email.com" className="input-field" />
                      {re.email && <p className="text-red-500 text-xs mt-1">{re.email.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                      <input type="tel" {...regR('phone')} placeholder="10-digit mobile number" className="input-field" />
                      {re.phone && <p className="text-red-500 text-xs mt-1">{re.phone.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                      <div className="relative">
                        <input type={showPass ? 'text' : 'password'} {...regR('password')} placeholder="Enter password" className="input-field pr-10" />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {re.password && <p className="text-red-500 text-xs mt-1">{re.password.message}</p>}
                    </div>
                    <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" className="mt-0.5 accent-brand-green" required />
                      <span>
                        I agree to the{' '}
                        <Link to="/terms-conditions" className="text-brand-green hover:underline">Terms &amp; Conditions</Link>{' '}
                        and{' '}
                        <Link to="/privacy-policy" className="text-brand-green hover:underline">Privacy Policy</Link>
                      </span>
                    </label>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                      {loading
                        ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <>Create Account <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>
                )}

                {/* Google sign-in and OTP login are disabled for now — uncomment to bring them back.
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">or continue with</div>
                </div>

                <div className="flex justify-center mb-3">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => toast.error('Google login failed. Please try again.')}
                    theme="outline" size="large" text="continue_with" shape="rectangular" width="368"
                  />
                </div>

                <Link to="/otp" className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:border-brand-green hover:text-brand-green transition-all mb-3">
                  📱 Login with OTP
                </Link>
                */}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
