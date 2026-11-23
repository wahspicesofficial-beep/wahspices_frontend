import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { sendOtp, verifyOtp } from '@/store/slices/authSlice';
import toast from 'react-hot-toast';

export default function OtpPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, otpSent } = useAppSelector((s) => s.auth);

  const handleSendOtp = async () => {
    if (phone.length !== 10) { toast.error('Please enter a valid 10-digit phone number'); return; }
    const res = await dispatch(sendOtp({ phone }));
    if (sendOtp.fulfilled.match(res)) {
      toast.success(`OTP sent to +91 ${phone}`, { icon: '📱', style: { borderRadius: '12px' } });
    } else {
      toast.error(res.payload || 'Failed to send OTP');
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length < 6) { toast.error('Please enter the complete 6-digit OTP'); return; }
    const res = await dispatch(verifyOtp({ phone, otp: otpString }));
    if (verifyOtp.fulfilled.match(res)) {
      toast.success('Verified! Welcome to Wah Spices!', { icon: '✅', style: { borderRadius: '12px' } });
      navigate('/');
    } else {
      toast.error(res.payload || 'Invalid OTP');
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-6">
            <img src="/wah_logo.jpg" alt="Wah Spices" className="h-20 w-auto object-contain mx-auto" />
          </Link>
          <h1 className="text-3xl font-heading font-bold text-brand-green-dark mb-2">
            {otpSent ? 'Verify OTP' : 'Login with OTP'}
          </h1>
          <p className="text-gray-500 text-sm">
            {otpSent ? `OTP sent to +91 ${phone}. Enter the 6-digit code.` : 'Enter your mobile number to receive an OTP'}
          </p>
        </div>

        <div className="card p-8">
          {!otpSent ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile Number</label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3 bg-gray-50">
                    <span className="text-lg">🇮🇳</span>
                    <span className="text-gray-600 font-medium text-sm">+91</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="input-field flex-1"
                    maxLength={10}
                  />
                </div>
              </div>
              <button onClick={handleSendOtp} disabled={loading || phone.length !== 10} className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Send OTP'}
              </button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-brand-green hover:underline flex items-center justify-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4 text-center">Enter 6-digit OTP</label>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (inputRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className={`w-11 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none transition-all ${digit ? 'border-brand-green bg-brand-green/5 text-brand-green' : 'border-gray-200 focus:border-brand-green'}`}
                    />
                  ))}
                </div>
              </div>
              <button onClick={handleVerify} disabled={loading || otp.join('').length < 6} className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Verify OTP'}
              </button>
              <div className="text-center space-y-2">
                <button onClick={() => { setOtp(['', '', '', '', '', '']); }} className="text-sm text-gray-500 hover:text-brand-green">
                  Change Number
                </button>
                <div className="text-sm text-gray-500">
                  Didn't receive?{' '}
                  <button onClick={handleSendOtp} className="text-brand-green hover:underline font-medium">Resend OTP</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-400">
          <span>🔒</span>
          <span>100% Secure Login</span>
        </div>
      </motion.div>
    </div>
  );
}
