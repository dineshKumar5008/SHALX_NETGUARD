import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, Mail, Lock, Eye, EyeOff, AlertCircle, 
  RefreshCw, ArrowLeft, CheckCircle2, Network, ShieldCheck, Server
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, verifyMfa, resendMfa } = useAuth();

  // Login form state
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [keepSignedIn, setKeepSignedIn] = useState<boolean>(false);
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
      setErrorMessage('Please enter your email or username and password.');
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
      setErrorMessage(res.error || 'Invalid credentials. Please verify your email and password.');
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
      setSuccessMessage('A new verification code has been dispatched to your email.');
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
    <div className="min-h-screen bg-gradient-to-br from-[#d9f0ec] via-[#e5f5f2] to-[#ddf2ee] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans select-none">
      
      {/* Soft Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-200/25 rounded-full blur-3xl pointer-events-none" />

      {/* Main Dual-Column Container */}
      <div className="w-full max-w-5xl bg-white rounded-[26px] shadow-[0_24px_70px_-15px_rgba(10,40,36,0.15)] border border-white/90 p-3 sm:p-4.5 flex flex-col lg:flex-row relative z-10 transition-all">
        
        {/* =================================================================== */}
        {/* LEFT COLUMN: HERO PANEL                                             */}
        {/* =================================================================== */}
        <div className="w-full lg:w-[47%] bg-gradient-to-b from-[#0c2623] via-[#0d2a27] to-[#071918] rounded-[20px] p-8 sm:p-10 flex flex-col justify-between text-white relative overflow-hidden shadow-inner min-h-[520px] lg:min-h-[580px]">
          
          {/* Subtle Ambient Radial Lighting */}
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
            {/* Headline */}
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.2] text-white mb-8">
              Network Visibility.<br />
              <span className="text-[#2dd4bf]">Security Intelligence.</span><br />
              Total Control.
            </h2>

            {/* Feature Bullets */}
            <div className="space-y-5">
              {/* Feature 1 */}
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

              {/* Feature 2 */}
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

              {/* Feature 3 */}
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

          {/* Bottom Footer Text */}
          <div className="relative z-10 pt-4 text-[11px] text-slate-400 font-normal">
            &copy; 2026 SHALX NETGUARD &middot; Enterprise Network Security Operations Platform
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: LOGIN / MFA FORM                                     */}
        {/* =================================================================== */}
        <div className="w-full lg:w-[53%] px-6 py-8 sm:px-12 sm:py-10 flex flex-col justify-center bg-white">
          
          {/* Header */}
          <div className="mb-7">
            <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
              {isMfaStep ? 'Two-Factor Authentication' : 'Welcome Back'}
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 font-normal">
              {isMfaStep 
                ? 'Enter the 6-digit verification code sent to your registered email' 
                : 'Sign-in to your account to continue'}
            </p>
          </div>

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

          {!isMfaStep ? (
            /* STEP 1: CREDENTIALS SIGN-IN FORM */
            <form onSubmit={handleInitialLogin} className="space-y-4.5">
              
              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Mail size={16} />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    placeholder="name@company.com"
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-800 block">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-[#007a70] hover:text-[#005c54] transition hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Keep me signed in */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  id="keep-signed-in"
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#00665e] focus:ring-[#00665e]/20 cursor-pointer"
                />
                <label htmlFor="keep-signed-in" className="text-xs text-slate-600 cursor-pointer select-none">
                  Keep me signed in
                </label>
              </div>

              {/* Sign In Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#00665e] hover:bg-[#00544d] active:scale-[0.99] text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </div>

              {/* Bottom Register Request Link */}
              <div className="text-center pt-5 text-xs text-slate-500">
                <span>Don't have an account? </span>
                <Link
                  to="/register"
                  className="font-semibold text-[#007a70] hover:text-[#005c54] hover:underline transition"
                >
                  Request an Account
                </Link>
              </div>
            </form>
          ) : (
            /* STEP 2: MFA 6-DIGIT OTP VERIFICATION */
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-teal-50 border border-teal-200/80 rounded-full text-xs font-mono text-teal-800 mb-2">
                  <Mail size={13} className="text-[#007369]" />
                  <span>{maskedEmail}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-sans">
                  Enter the dynamic verification code dispatched to your inbox.
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
                  <span>Verify &amp; Enter Console</span>
                )}
              </button>

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
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Login</span>
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
        </div>
      </div>
    </div>
  );
};
