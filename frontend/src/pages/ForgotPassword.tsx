import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { 
  Shield, Mail, Key, Eye, EyeOff, AlertCircle, RefreshCw, 
  ArrowLeft, CheckCircle2, Lock, Network, ShieldCheck, Server
} from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();

  // Wizard step state: 1 (Email) -> 2 (Verify OTP) -> 3 (New Password) -> 4 (Success)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [email, setEmail] = useState<string>('');
  const [challengeId, setChallengeId] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [resetToken, setResetToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Timers
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Expiration countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (step === 2 && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  // STEP 1: Request Password Recovery Code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid registered email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient.post('/auth/forgot-password/request', {
        email: email.trim()
      });

      setChallengeId(res.data.challenge_id || '');
      setMaskedEmail(res.data.masked_email || email.trim());
      setTimeLeft(res.data.expires_in || 600);
      setResendCooldown(30);
      setStep(2);
      setSuccessMessage(res.data.message || 'If the email is registered, a verification code has been sent.');
    } catch (err: any) {
      const data = err.response?.data;
      if (typeof data?.detail === 'string') {
        setErrorMessage(data.detail);
      } else if (err.message && !err.response) {
        setErrorMessage(`Network error: ${err.message}. Please verify the backend server is reachable.`);
      } else {
        setErrorMessage(data?.message || err.message || 'Failed to request password reset code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: Verify 6-Digit OTP Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    if (!challengeId) {
      setErrorMessage('Invalid recovery session. Please request a new verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient.post('/auth/forgot-password/verify', {
        challenge_id: challengeId,
        otp: otpCode.trim()
      });

      setResetToken(res.data.reset_token);
      setStep(3);
      setSuccessMessage('Identity verified successfully. You may now create your new password.');
    } catch (err: any) {
      const data = err.response?.data;
      setErrorMessage(data?.detail || data?.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2 (Alternate): Resend OTP Code
  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending || !challengeId) return;

    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient.post('/auth/forgot-password/resend', {
        challenge_id: challengeId
      });

      setTimeLeft(res.data.expires_in || 600);
      setResendCooldown(30);
      setOtpCode('');
      setSuccessMessage(res.data.message || 'A new verification code has been dispatched.');
    } catch (err: any) {
      const data = err.response?.data;
      setErrorMessage(data?.detail || data?.message || 'Failed to resend code. Please request a new session.');
    } finally {
      setIsResending(false);
    }
  };

  // STEP 3: Reset to New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setErrorMessage('Please fill in both password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient.post('/auth/forgot-password/reset', {
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword
      });

      setStep(4);
      setSuccessMessage(res.data.message || 'Password has been updated successfully.');
    } catch (err: any) {
      const data = err.response?.data;
      setErrorMessage(data?.detail || data?.message || 'Failed to reset password. Please restart the recovery flow.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#d9f0ec] via-[#e5f5f2] to-[#ddf2ee] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans select-none">
      
      {/* Soft Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-200/25 rounded-full blur-3xl pointer-events-none" />

      {/* Main Dual-Column Container */}
      <div className="w-full max-w-5xl bg-white rounded-[26px] shadow-[0_24px_70px_-15px_rgba(10,40,36,0.15)] border border-white/90 p-3 sm:p-4.5 flex flex-col lg:flex-row relative z-10 transition-all">
        
        {/* LEFT COLUMN: HERO PANEL */}
        <div className="w-full lg:w-[47%] bg-gradient-to-b from-[#0c2623] via-[#0d2a27] to-[#071918] rounded-[20px] p-8 sm:p-10 flex flex-col justify-between text-white relative overflow-hidden shadow-inner min-h-[520px] lg:min-h-[580px]">
          
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-[#14b8a6]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-[#0d9488]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Pill */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00a693]/20 border border-[#00c9b2]/30 flex items-center justify-center shadow-xs">
              <Shield className="w-4 h-4 text-[#2dd4bf]" />
            </div>
            <span className="font-bold font-mono tracking-wider text-sm text-white uppercase">
              SHALX <span className="text-[#2dd4bf]">NETGUARD</span>
            </span>
          </div>

          {/* Middle Content Section */}
          <div className="relative z-10 my-auto py-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.2] text-white mb-8">
              Network Visibility.<br />
              <span className="text-[#2dd4bf]">Security Intelligence.</span><br />
              Total Control.
            </h2>

            <div className="space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-lg bg-[#00a693]/15 border border-[#00c9b2]/25 flex items-center justify-center shrink-0 mt-0.5">
                  <Network className="w-3.5 h-3.5 text-[#2dd4bf]" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white tracking-wide">
                    Real-Time Network Visibility
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                    Discover devices and understand your network environment.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-lg bg-[#00a693]/15 border border-[#00c9b2]/25 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2dd4bf]" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white tracking-wide">
                    Centralized Security Monitoring
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                    Monitor alerts, events, and operational health in one place.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-lg bg-[#00a693]/15 border border-[#00c9b2]/25 flex items-center justify-center shrink-0 mt-0.5">
                  <Server className="w-3.5 h-3.5 text-[#2dd4bf]" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white tracking-wide">
                    Intelligent Device Discovery
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                    View discovered assets and available device identification details.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-4 text-[11px] text-slate-400 font-normal">
            &copy; 2026 SHALX NETGUARD &middot; Enterprise Network Security Operations Platform
          </div>
        </div>

        {/* RIGHT COLUMN: RECOVERY WIZARD */}
        <div className="w-full lg:w-[53%] px-6 py-8 sm:px-12 sm:py-10 flex flex-col justify-center bg-white font-sans">
          
          <div className="mb-6">
            <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
              Account Password Recovery
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 font-normal">
              Identity verification and credential reset workflow
            </p>
          </div>

          {/* Step Indicator */}
          {step < 4 && (
            <div className="flex items-center justify-between mb-6 px-1">
              {[
                { num: 1, label: 'Email' },
                { num: 2, label: 'Verify' },
                { num: 3, label: 'Reset' }
              ].map((s, idx) => (
                <React.Fragment key={s.num}>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                      step === s.num
                        ? 'bg-[#00665e] text-white shadow-xs'
                        : step > s.num
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 border border-slate-200 text-slate-400'
                    }`}>
                      {step > s.num ? '✓' : s.num}
                    </div>
                    <span className={`text-xs ${step === s.num ? 'text-[#00665e] font-semibold' : 'text-slate-500'}`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < 2 && (
                    <div className={`flex-1 h-[2px] mx-2 rounded ${step > s.num ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 font-sans shadow-xs">
              <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 font-sans shadow-xs">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
              <div className="leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* STEP 1: ENTER REGISTERED EMAIL */}
          {step === 1 && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    required
                    placeholder="operator@company.com"
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  We will dispatch a 6-digit dynamic OTP code to verify your identity.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#00665e] hover:bg-[#00544d] active:scale-[0.99] text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <span>Send Verification Code</span>
                  )}
                </button>
              </div>

              <div className="pt-4 text-center border-t border-slate-100">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
                >
                  <ArrowLeft size={13} />
                  <span>Return to Login</span>
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: VERIFY 6-DIGIT CODE */}
          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-teal-50 border border-teal-200/80 rounded-full text-xs font-mono text-teal-800 mb-2">
                  <Mail size={13} className="text-[#007369]" />
                  <span>{maskedEmail}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-sans">
                  Enter the 6-digit verification code dispatched to your inbox.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    6-Digit Verification Code
                  </label>
                  <span className={`text-xs font-mono ${timeLeft < 60 ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                    ⏱️ {formatTimer(timeLeft)}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    autoFocus
                    required
                    className="w-full bg-slate-50/80 border border-slate-300 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.4em] text-slate-900 outline-none transition shadow-2xs"
                    placeholder="••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || timeLeft === 0}
                  className="w-full bg-[#00665e] hover:bg-[#00544d] active:scale-[0.99] text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <span>Verify Code</span>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setOtpCode('');
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Email</span>
                </button>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isResending}
                  className="flex items-center gap-1.5 text-xs text-[#007a70] hover:text-[#005c54] disabled:text-slate-400 font-medium transition"
                >
                  <RefreshCw size={12} className={isResending ? 'animate-spin' : ''} />
                  <span>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: CREATE NEW PASSWORD */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Key size={16} />
                  </span>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#00665e] hover:bg-[#00544d] active:scale-[0.99] text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Reset Password</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {step === 4 && (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex p-3.5 bg-emerald-50 border border-emerald-200 rounded-full">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">Password Updated Successfully</h2>
                <p className="text-xs text-slate-500 font-sans mt-1.5 leading-relaxed">
                  Your credentials have been securely updated. You may now sign in with your new password.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full bg-[#00665e] hover:bg-[#00544d] active:scale-[0.99] text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-xs transition duration-150"
                >
                  Proceed to Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
