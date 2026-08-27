import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { 
  Shield, Mail, Key, Eye, EyeOff, AlertCircle, RefreshCw, 
  ArrowLeft, CheckCircle2, Lock, ArrowRight 
} from 'lucide-react';
import { Button } from '../components/common/Button';

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
      setErrorMessage(err.response?.data?.detail || 'Failed to request password reset code. Please try again.');
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
      setErrorMessage(err.response?.data?.detail || 'Invalid or expired verification code. Please try again.');
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
      setErrorMessage(err.response?.data?.detail || 'Failed to resend code. Please request a new session.');
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
      setErrorMessage(err.response?.data?.detail || 'Failed to reset password. Please restart the recovery flow.');
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
    <div className="min-h-screen bg-[#07090e] bg-gradient-to-b from-[#0a0d14] via-[#07090e] to-[#040609] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Background Cyber Grid Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(2,132,199,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Recovery Card */}
      <div className="w-full max-w-[450px] bg-[#0c101b]/95 backdrop-blur-xl border border-slate-800/90 hover:border-cyan-500/30 rounded-2xl p-7 sm:p-9 shadow-[0_0_60px_-15px_rgba(2,132,199,0.18)] transition-all duration-300 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="inline-flex p-3.5 bg-gradient-to-br from-cyan-950/80 to-slate-900 border border-cyan-500/30 rounded-2xl mb-3 shadow-[0_0_25px_rgba(2,132,199,0.25)]">
            <Shield className="w-7 h-7 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
          </div>
          <h1 className="text-xl font-black font-mono tracking-wider text-slate-100 uppercase">
            SHALX <span className="text-cyan-400">NETGUARD</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono tracking-wide mt-1">
            Account Password Recovery &amp; Identity Verification
          </p>
        </div>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="flex items-center justify-between mb-6 px-2">
            {[
              { num: 1, label: 'Email' },
              { num: 2, label: 'Verify' },
              { num: 3, label: 'Reset' }
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                    step === s.num
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(0,240,255,0.6)]'
                      : step > s.num
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-500'
                  }`}>
                    {step > s.num ? '✓' : s.num}
                  </div>
                  <span className={`text-[11px] font-mono ${step === s.num ? 'text-cyan-300 font-semibold' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < 2 && (
                  <div className={`flex-1 h-[1px] mx-2 ${step > s.num ? 'bg-emerald-600' : 'bg-slate-800'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl flex items-start gap-3 text-xs text-rose-200 animate-in fade-in duration-200">
            <AlertCircle size={17} className="shrink-0 text-rose-400 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-5 p-3.5 bg-emerald-950/70 border border-emerald-800/80 rounded-xl flex items-start gap-3 text-xs text-emerald-200 animate-in fade-in duration-200">
            <CheckCircle2 size={17} className="shrink-0 text-emerald-400 mt-0.5" />
            <div className="leading-relaxed">{successMessage}</div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 1: ENTER REGISTERED EMAIL                                   */}
        {/* ================================================================ */}
        {step === 1 && (
          <form onSubmit={handleRequestCode} className="space-y-4 animate-in fade-in duration-300">
            <div>
              <h2 className="text-base font-bold font-mono text-slate-100 mb-1">Forgot Password</h2>
              <p className="text-xs text-slate-400 mb-4">
                Enter your registered email address. We will dispatch a dynamic 6-digit verification code to confirm your identity.
              </p>

              <label className="block text-[11px] font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                  className="w-full bg-[#070a12] border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 transition-all outline-none"
                  placeholder="e.g. operator@company.com"
                />
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-2 font-mono tracking-wider font-bold shadow-[0_0_20px_rgba(2,132,199,0.25)] hover:shadow-[0_0_25px_rgba(2,132,199,0.4)] transition-all"
              size="lg"
            >
              SEND VERIFICATION CODE
            </Button>

            <div className="pt-3 text-center border-t border-slate-800/90 mt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft size={13} />
                <span>Back to Login</span>
              </Link>
            </div>
          </form>
        )}

        {/* ================================================================ */}
        {/* STEP 2: ENTER & VERIFY 6-DIGIT CODE                             */}
        {/* ================================================================ */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-4 animate-in fade-in duration-300">
            <div className="text-center mb-4">
              <h2 className="text-base font-bold font-mono text-slate-100 mb-1">Verify Your Email</h2>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-950/60 border border-cyan-700/60 rounded-full text-xs font-mono text-cyan-300 my-2">
                <Mail size={13} />
                <span>{maskedEmail}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                A verification code has been sent to your registered email address.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-mono font-semibold text-slate-300 uppercase tracking-wider">
                  6-Digit Verification Code
                </label>
                <span className={`text-xs font-mono font-semibold ${timeLeft < 60 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
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
                  className="w-full bg-[#070a12] border border-cyan-500/50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40 rounded-xl px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.45em] text-cyan-300 placeholder-slate-700 transition-all outline-none shadow-inner"
                  placeholder="••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              disabled={timeLeft === 0}
              className="w-full mt-2 font-mono tracking-wider font-bold shadow-[0_0_20px_rgba(2,132,199,0.3)] hover:shadow-[0_0_25px_rgba(2,132,199,0.45)] transition-all"
              size="lg"
            >
              VERIFY CODE
            </Button>

            {/* Resend & Back Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setOtpCode('');
                }}
                className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft size={14} />
                <span>Back to Login</span>
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isResending}
                className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 disabled:text-slate-600 transition-colors"
              >
                <RefreshCw size={13} className={isResending ? 'animate-spin' : ''} />
                <span>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'RESEND CODE'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* ================================================================ */}
        {/* STEP 3: CREATE NEW PASSWORD                                      */}
        {/* ================================================================ */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in duration-300">
            <div>
              <h2 className="text-base font-bold font-mono text-slate-100 mb-1">Create New Password</h2>
              <p className="text-xs text-slate-400 mb-4">
                Choose a strong password containing at least 8 characters.
              </p>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                    <Key size={16} />
                  </span>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    className="w-full bg-[#070a12] border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 rounded-xl pl-10 pr-11 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 transition-all outline-none"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-[11px] font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full bg-[#070a12] border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 rounded-xl pl-10 pr-11 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 transition-all outline-none"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-2 font-mono tracking-wider font-bold shadow-[0_0_20px_rgba(2,132,199,0.3)] hover:shadow-[0_0_25px_rgba(2,132,199,0.45)] transition-all"
              size="lg"
            >
              RESET PASSWORD
            </Button>
          </form>
        )}

        {/* ================================================================ */}
        {/* STEP 4: SUCCESS CONFIRMATION                                     */}
        {/* ================================================================ */}
        {step === 4 && (
          <div className="text-center py-4 space-y-5 animate-in zoom-in-95 duration-400">
            <div className="inline-flex p-4 bg-emerald-950/80 border border-emerald-500/40 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.35)] animate-pulse">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>

            <div>
              <h2 className="text-lg font-bold font-mono text-slate-100">Password Reset Successful</h2>
              <p className="text-xs text-slate-400 font-mono mt-1.5">
                Your password has been updated successfully. You can now sign in with your new credentials.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full font-mono tracking-wider font-bold shadow-[0_0_20px_rgba(2,132,199,0.3)] hover:shadow-[0_0_25px_rgba(2,132,199,0.45)]"
              size="lg"
            >
              BACK TO LOGIN
            </Button>
          </div>
        )}
      </div>

      {/* Footer Security Watermark */}
      <div className="absolute bottom-4 text-center w-full text-[11px] font-mono text-slate-600 pointer-events-none">
        SHALX NETGUARD SOC PLATFORM &bull; SECURE PASSWORD RECOVERY
      </div>
    </div>
  );
};
