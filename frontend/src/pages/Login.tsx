import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { Shield, Lock, User, Key, Eye, EyeOff, AlertCircle, Mail, RefreshCw, ArrowLeft, CheckCircle2, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, verifyMfa, resendMfa } = useAuth();

  // Login form state
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('NetGuard@2026!');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // MFA state
  const [isMfaStep, setIsMfaStep] = useState<boolean>(false);
  const [challengeId, setChallengeId] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Admin Email Setup Modal state
  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(false);
  const [setupPassword, setSetupPassword] = useState<string>('NetGuard@2026!');
  const [setupRealEmail, setSetupRealEmail] = useState<string>('');
  const [isSettingUpEmail, setIsSettingUpEmail] = useState<boolean>(false);

  // Expiration countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isMfaStep && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMfaStep, timeLeft]);

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

  const handleInitialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await login(username, password);
    setIsLoading(false);

    if (res.success) {
      if (res.mfaRequired && res.challengeId) {
        setChallengeId(res.challengeId);
        setMaskedEmail(res.maskedEmail || 'registered email');
        setTimeLeft(res.expiresIn || 300);
        setIsMfaStep(true);
        setResendCooldown(30);
      } else {
        navigate('/');
      }
    } else {
      setErrorMessage(res.error || 'Invalid username or password. Please verify credentials.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await verifyMfa(challengeId, otpCode.trim());
    setIsLoading(false);

    if (res.success) {
      navigate('/');
    } else {
      setErrorMessage(res.error || 'Invalid verification code. Please check your email and try again.');
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await resendMfa(challengeId);
    setIsResending(false);

    if (res.success && res.challengeId) {
      setChallengeId(res.challengeId);
      setTimeLeft(res.expiresIn || 300);
      setResendCooldown(30);
      setOtpCode('');
      setSuccessMessage('A new verification code has been dispatched to your registered email.');
    } else {
      setErrorMessage(res.error || 'Failed to resend verification code. Please try again.');
    }
  };

  const handleSetupAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupRealEmail || !setupRealEmail.includes('@')) {
      setErrorMessage('Please enter a valid real email address.');
      return;
    }

    setIsSettingUpEmail(true);
    try {
      const res = await apiClient.post('/auth/setup-admin-email', {
        username: 'admin',
        password: setupPassword,
        real_email: setupRealEmail.trim(),
      });
      setIsSetupModalOpen(false);
      setSuccessMessage(res.data.message || 'Administrator real email registered successfully! You can now log in.');
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to configure administrator email.');
    } finally {
      setIsSettingUpEmail(false);
    }
  };

  const setDemoAccount = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Cyber Glow Effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0f1422] border border-[#1e293b] rounded-2xl shadow-2xl p-8 backdrop-blur-xl relative z-10">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3.5 bg-gradient-to-tr from-cyan-950 to-slate-900 border border-cyan-500/40 rounded-xl shadow-xl shadow-cyan-950/60 mb-4">
            {isMfaStep ? (
              <Mail className="w-8 h-8 text-cyan-400 animate-pulse" />
            ) : (
              <Shield className="w-8 h-8 text-cyan-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-wider bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
            SHALX NETGUARD
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            {isMfaStep ? 'Two-Factor Email Verification' : 'Secure Network Security Operations Center'}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-3 bg-rose-950/70 border border-rose-800 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <div>{errorMessage}</div>
              {errorMessage.includes('verified real email') && (
                <button
                  type="button"
                  onClick={() => setIsSetupModalOpen(true)}
                  className="text-cyan-400 underline font-mono text-[11px] block mt-1 hover:text-cyan-300"
                >
                  Click here to configure Administrator Real Email
                </button>
              )}
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-6 p-3 bg-emerald-950/70 border border-emerald-800 rounded-lg flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {!isMfaStep ? (
          /* Step 1: Initial Login Form */
          <form onSubmit={handleInitialLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wide">
                Username or Registered Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 font-mono placeholder-slate-500 transition outline-none"
                  placeholder="e.g. admin"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Key size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-9 pr-10 py-2 text-sm text-slate-100 font-mono placeholder-slate-500 transition outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-2"
              size="lg"
            >
              Verify Credentials
            </Button>
          </form>
        ) : (
          /* Step 2: MFA Verification Form */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-950/60 border border-cyan-700/50 rounded-full text-xs font-mono text-cyan-300 mb-2">
                <Mail size={13} />
                <span>{maskedEmail}</span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Enter the 6-digit authentication code sent to your registered email address.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-mono text-slate-300 uppercase tracking-wide">
                  6-Digit Verification Code
                </label>
                <span className={`text-xs font-mono ${timeLeft < 60 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
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
                  className="w-full bg-[#0a0d14] border border-cyan-600/50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40 rounded-lg px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-cyan-300 placeholder-slate-600 transition outline-none"
                  placeholder="••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              disabled={timeLeft === 0}
              className="w-full mt-2"
              size="lg"
            >
              Authenticate to SOC
            </Button>

            {/* Resend & Back Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsMfaStep(false);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setOtpCode('');
                }}
                className="flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-slate-200 transition"
              >
                <ArrowLeft size={14} />
                <span>Back to Login</span>
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isResending}
                className="flex items-center gap-1 text-xs font-mono text-cyan-400 hover:text-cyan-300 disabled:text-slate-600 transition"
              >
                <RefreshCw size={13} className={isResending ? 'animate-spin' : ''} />
                <span>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* Demo Accounts Preset for Local Lab Evaluation */}
        {!isMfaStep && (
          <div className="mt-8 pt-6 border-t border-[#1e293b]">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Operator Accounts
              </span>
              <button
                type="button"
                onClick={() => setIsSetupModalOpen(true)}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <SettingsIcon size={12} />
                <span>Set Admin Email</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoAccount('admin', 'NetGuard@2026!')}
                className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/70 border border-slate-800 hover:border-cyan-700/60 text-xs font-mono text-slate-300 transition text-center"
              >
                <div className="font-semibold text-cyan-400">ADMIN</div>
                <div className="text-[10px] text-slate-400">Full Access</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount('analyst', 'Analyst@2026!')}
                className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/70 border border-slate-800 hover:border-cyan-700/60 text-xs font-mono text-slate-300 transition text-center"
              >
                <div className="font-semibold text-amber-400">ANALYST</div>
                <div className="text-[10px] text-slate-400">Triage & Block</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount('viewer', 'Viewer@2026!')}
                className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/70 border border-slate-800 hover:border-cyan-700/60 text-xs font-mono text-slate-300 transition text-center"
              >
                <div className="font-semibold text-slate-300">VIEWER</div>
                <div className="text-[10px] text-slate-400">Read-Only</div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Admin Real Email Registration Modal */}
      <Modal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        title="Configure Administrator Real Email Address"
      >
        <form onSubmit={handleSetupAdminEmail} className="space-y-4">
          <div className="p-3 bg-cyan-950/50 border border-cyan-800/60 rounded-lg text-xs font-sans text-cyan-200">
            Configure the real destination email for the administrator account. All future login MFA verification codes will be delivered directly to this address.
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Admin Account Password
            </label>
            <input
              type="password"
              value={setupPassword}
              onChange={(e) => setSetupPassword(e.target.value)}
              required
              className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono outline-none"
              placeholder="Enter current admin password"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Real Registered Email Address (e.g. Gmail / Outlook / Corporate)
            </label>
            <input
              type="email"
              value={setupRealEmail}
              onChange={(e) => setSetupRealEmail(e.target.value)}
              required
              className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono outline-none"
              placeholder="e.g. your-name@gmail.com"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSetupModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSettingUpEmail}
            >
              Save Registered Email
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
