import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, User, Key, Eye, EyeOff, AlertCircle, Mail, 
  RefreshCw, ArrowLeft, CheckCircle2 
} from 'lucide-react';
import { Button } from '../components/common/Button';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, verifyMfa, resendMfa } = useAuth();

  // Login form state - strictly empty initially
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
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
    if (!username.trim() || !password) {
      setErrorMessage('Please enter your username/email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await login(username.trim(), password);
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
      setErrorMessage(res.error || 'Invalid username or password. Please verify your credentials.');
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

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-[#07090e] bg-gradient-to-b from-[#0a0d14] via-[#07090e] to-[#040609] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Subtle Background Cyber Grid Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(2,132,199,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-[440px] bg-[#0c101b]/95 backdrop-blur-xl border border-slate-800/90 hover:border-cyan-500/30 rounded-2xl p-7 sm:p-9 shadow-[0_0_60px_-15px_rgba(2,132,199,0.18)] transition-all duration-300 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3.5 bg-gradient-to-br from-cyan-950/80 to-slate-900 border border-cyan-500/30 rounded-2xl mb-3.5 shadow-[0_0_25px_rgba(2,132,199,0.25)] group transition-transform duration-300 hover:scale-105">
            <Shield className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
          </div>
          <h1 className="text-2xl font-black font-mono tracking-wider text-slate-100 uppercase">
            SHALX <span className="text-cyan-400">NETGUARD</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono tracking-wide mt-1">
            Secure Network Security Operations Center
          </p>
        </div>

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

        {!isMfaStep ? (
          /* STEP 1: INITIAL LOGIN CREDENTIALS FORM */
          <form onSubmit={handleInitialLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Username or Registered Email
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className="w-full bg-[#070a12] border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 transition-all outline-none"
                  placeholder="Enter username or email"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                  <Key size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full bg-[#070a12] border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 rounded-xl pl-10 pr-11 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 transition-all outline-none"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end mt-2">
                <Link
                  to="/forgot-password"
                  className="text-xs font-mono text-cyan-400/90 hover:text-cyan-300 hover:underline transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-2 font-mono tracking-wider font-bold shadow-[0_0_20px_rgba(2,132,199,0.25)] hover:shadow-[0_0_25px_rgba(2,132,199,0.4)] transition-all"
              size="lg"
            >
              SIGN IN
            </Button>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800/90" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#0c101b] px-3 text-[11px] font-mono text-slate-500 uppercase tracking-widest">
                  OR
                </span>
              </div>
            </div>

            {/* Register Option */}
            <div className="text-center pt-1">
              <span className="text-xs text-slate-400">Don't have an account? </span>
              <Link
                to="/register"
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-semibold hover:underline transition-colors ml-1"
              >
                Register
              </Link>
            </div>
          </form>
        ) : (
          /* STEP 2: MFA OTP VERIFICATION FORM */
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in duration-300">
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-950/60 border border-cyan-700/60 rounded-full text-xs font-mono text-cyan-300 mb-2.5 shadow-sm">
                <Mail size={13} />
                <span>{maskedEmail}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter the 6-digit authentication code dispatched to your verified registered email address.
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
              AUTHENTICATE TO SOC
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
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer Security Watermark */}
      <div className="absolute bottom-4 text-center w-full text-[11px] font-mono text-slate-600 pointer-events-none">
        SHALX NETGUARD SOC PLATFORM &bull; ENTERPRISE THREAT MONITORING
      </div>
    </div>
  );
};

