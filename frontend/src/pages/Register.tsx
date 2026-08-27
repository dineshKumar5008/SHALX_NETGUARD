import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { 
  Shield, User, Mail, Key, Eye, EyeOff, Building2, FileText, 
  AlertCircle, CheckCircle2, ArrowLeft, Send
} from 'lucide-react';
import { Button } from '../components/common/Button';

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
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMessage(detail);
      } else if (Array.isArray(detail)) {
        setErrorMessage(detail[0]?.msg || 'Validation failed. Please check form fields.');
      } else {
        setErrorMessage('Failed to submit registration request. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center p-4 relative overflow-hidden py-12">
      {/* Cyber Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-[#0f1422] border border-[#1e293b] rounded-2xl shadow-2xl p-8 backdrop-blur-xl relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3.5 bg-gradient-to-tr from-cyan-950 to-slate-900 border border-cyan-500/40 rounded-xl shadow-xl shadow-cyan-950/60 mb-4">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-wider bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
            SHALX NETGUARD
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            SOC Operator Access Self-Registration Request
          </p>
        </div>

        {/* Informational Banner */}
        <div className="mb-6 p-3.5 bg-cyan-950/40 border border-cyan-800/60 rounded-xl text-xs font-mono text-cyan-200/90 leading-relaxed">
          🔒 <b>Access Control Policy:</b> New accounts require authorization by an Administrator or Senior Analyst. Once approved, you will receive an activation email and two-factor OTP verification for your inbox.
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-3.5 bg-rose-950/70 border border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          {/* Full Name & Username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1.5 uppercase font-semibold">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <User size={15} />
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-9 pr-3 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 uppercase font-semibold">
                Username <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <User size={15} />
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. arivera"
                  className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-9 pr-3 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Email Address & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1.5 uppercase font-semibold">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Mail size={15} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@company.com"
                  className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-9 pr-3 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Approval notices &amp; login MFA OTPs route here.</p>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 uppercase font-semibold">
                Department / Team <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Building2 size={15} />
                </span>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Incident Response"
                  className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-9 pr-3 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1.5 uppercase font-semibold">
                Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Key size={15} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-9 pr-10 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 uppercase font-semibold">
                Confirm Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Key size={15} />
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-9 pr-10 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Reason for Access */}
          <div>
            <label className="block text-slate-300 mb-1.5 uppercase font-semibold">
              Reason for Access / Business Need <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe your role, responsibilities, or reasons for accessing the SHALX NETGUARD SOC console..."
                className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg p-3 text-slate-100 placeholder-slate-600 outline-none transition resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition"
            >
              <ArrowLeft size={14} />
              <span>Back to Login</span>
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              icon={<Send size={14} />}
            >
              Submit Registration Request
            </Button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#1e293b] text-center">
          <p className="text-[11px] font-mono text-slate-400">
            Already have an active account?{' '}
            <Link to="/login" className="text-cyan-400 hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
