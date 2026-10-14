import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { 
  Shield, User, Mail, Lock, Key, Eye, EyeOff, Building2, 
  AlertCircle, ArrowLeft, Send, Network, ShieldCheck, Server, RefreshCw
} from 'lucide-react';

export const Register: React.FC = () => {
  const navigate = useNavigate();

  // Form states
  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client validation
    if (password !== confirmPassword) {
      setErrorMessage('Password confirmation does not match password.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiClient.post('/auth/register', {
        full_name: fullName.trim(),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        confirm_password: confirmPassword,
        department: department.trim(),
        reason: reason.trim(),
      });

      // Redirect to registration status page
      if (res.data && res.data.id) {
        navigate(`/registration-status/${res.data.id}`, {
          state: {
            username: res.data.username,
            maskedEmail: res.data.masked_email,
            status: res.data.status,
            message: res.data.message
          }
        });
      } else {
        navigate('/login');
      }
    } catch (err: any) {
      const data = err.response?.data;
      if (typeof data?.detail === 'string') {
        setErrorMessage(data.detail);
      } else if (Array.isArray(data?.detail)) {
        setErrorMessage(data.detail.map((d: any) => d?.msg || JSON.stringify(d)).join(', '));
      } else if (typeof data?.message === 'string') {
        setErrorMessage(data.message);
      } else if (err.message && !err.response) {
        setErrorMessage(`Network error: ${err.message}. Please verify the backend server is online and reachable.`);
      } else {
        setErrorMessage(err.message || 'Failed to submit registration request. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#d9f0ec] via-[#e5f5f2] to-[#ddf2ee] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans select-none">
      
      {/* Soft Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-200/25 rounded-full blur-3xl pointer-events-none" />

      {/* Main Dual-Column Container */}
      <div className="w-full max-w-5xl bg-white rounded-[26px] shadow-[0_24px_70px_-15px_rgba(10,40,36,0.15)] border border-white/90 p-3 sm:p-4.5 flex flex-col lg:flex-row relative z-10 transition-all">
        
        {/* LEFT COLUMN: HERO PANEL */}
        <div className="w-full lg:w-[45%] bg-gradient-to-b from-[#0c2623] via-[#0d2a27] to-[#071918] rounded-[20px] p-8 sm:p-10 flex flex-col justify-between text-white relative overflow-hidden shadow-inner min-h-[520px] lg:min-h-[640px]">
          
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

        {/* RIGHT COLUMN: REGISTRATION FORM */}
        <div className="w-full lg:w-[55%] px-6 py-8 sm:px-12 sm:py-10 flex flex-col justify-center bg-white font-sans">
          
          <div className="mb-6">
            <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
              Request Operator Access
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-normal">
              Self-registration request for SOC console authorization
            </p>
          </div>

          {/* Access Policy Note */}
          <div className="mb-5 p-3.5 bg-teal-50/70 border border-teal-200/80 rounded-xl text-xs font-sans text-teal-900 leading-relaxed shadow-2xs">
            🔒 <b>Access Authorization Policy:</b> Applications require review by an Administrator. Upon authorization, an activation notice and dynamic two-factor verification OTP will be routed to your email.
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 font-sans shadow-xs">
              <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-1">
                <div>{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {/* Full Name & Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <User size={15} />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <User size={15} />
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. arivera"
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Email Address & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Mail size={15} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@company.com"
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Department / Team <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Building2 size={15} />
                  </span>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Security Operations"
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Lock size={15} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Lock size={15} />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Reason for Access */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Business Need / Reason for Access <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe your role or reason for requesting access..."
                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-[#007369] focus:ring-2 focus:ring-[#007369]/15 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
              >
                <ArrowLeft size={13} />
                <span>Return to Login</span>
              </Link>

              <button
                type="submit"
                disabled={isLoading}
                className="bg-[#00665e] hover:bg-[#00544d] active:scale-[0.99] text-white text-xs font-semibold py-2.5 px-5 rounded-xl shadow-xs transition duration-150 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Submit Application</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-5 pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-normal">
              Already have an authorized operator account?{' '}
              <Link to="/login" className="text-[#007a70] hover:text-[#005c54] hover:underline font-semibold">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
