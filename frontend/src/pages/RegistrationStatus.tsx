import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { 
  Shield, Clock, CheckCircle2, XCircle, RefreshCw, ArrowLeft, Mail, User, ShieldAlert 
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const RegistrationStatus: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const stateData = location.state as any;

  const [statusData, setStatusData] = useState<{
    id: number;
    username: string;
    masked_email: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    created_at: string;
    reviewed_at?: string;
    rejection_reason?: string;
    message: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.get(`/auth/registration-status/${id}`);
      setStatusData(res.data);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Unable to retrieve registration status.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (stateData && stateData.status) {
      setStatusData({
        id: Number(id),
        username: stateData.username || '',
        masked_email: stateData.maskedEmail || '',
        status: stateData.status,
        created_at: new Date().toISOString(),
        message: stateData.message || ''
      });
      setIsLoading(false);
    } else {
      fetchStatus();
    }
  }, [id]);

  const isPending = statusData?.status === 'PENDING';
  const isApproved = statusData?.status === 'APPROVED';
  const isRejected = statusData?.status === 'REJECTED';

  return (
    <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-[#0f1422] border border-[#1e293b] rounded-2xl shadow-2xl p-8 backdrop-blur-xl relative z-10 font-mono">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3.5 bg-gradient-to-tr from-cyan-950 to-slate-900 border border-cyan-500/40 rounded-xl shadow-xl shadow-cyan-950/60 mb-4">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
            SHALX NETGUARD
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access Registration Request Tracking
          </p>
        </div>

        {errorMessage ? (
          <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 mb-6 flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Card Banner */}
            <div className={`p-5 rounded-xl border flex flex-col items-center text-center gap-3 ${
              isPending 
                ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                : isApproved
                ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
            }`}>
              {isPending && <Clock className="w-10 h-10 text-amber-400 animate-pulse" />}
              {isApproved && <CheckCircle2 className="w-10 h-10 text-emerald-400" />}
              {isRejected && <XCircle className="w-10 h-10 text-rose-400" />}

              <div>
                <div className="text-sm font-bold tracking-wider uppercase">
                  {isPending && 'Status: PENDING APPROVAL'}
                  {isApproved && 'Status: APPROVED & ACTIVE'}
                  {isRejected && 'Status: REGISTRATION REJECTED'}
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-sans">
                  {statusData?.message || (
                    isPending
                      ? 'Your registration request has been submitted and is awaiting authorization by an Administrator or Senior Analyst.'
                      : isApproved
                      ? 'Your account has been approved. You may now log in to the SHALX NETGUARD console using your registered credentials.'
                      : 'Your registration request could not be approved at this time.'
                  )}
                </p>
              </div>
            </div>

            {/* Request Summary Box */}
            <div className="bg-[#0a0d14] border border-[#1e293b] rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Request Tracking ID</span>
                <span className="text-cyan-400 font-bold">REQ-#{statusData?.id || id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <User size={13} />
                  <span>Username</span>
                </span>
                <span className="text-slate-200 font-semibold">{statusData?.username || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail size={13} />
                  <span>Registered Email</span>
                </span>
                <span className="text-sky-300 font-mono">{statusData?.masked_email || '—'}</span>
              </div>
              {statusData?.rejection_reason && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-rose-400 font-bold block mb-1">Reason for Rejection:</span>
                  <span className="text-slate-300 font-sans text-[11px] leading-relaxed block bg-rose-950/40 p-2.5 rounded border border-rose-900/60">
                    {statusData.rejection_reason}
                  </span>
                </div>
              )}
            </div>

            {/* Next Steps Hint */}
            <div className="text-[11px] text-slate-400 text-center leading-relaxed">
              {isPending && (
                <span>
                  💡 You will receive an automated email notification as soon as a reviewer processes your application.
                </span>
              )}
              {isApproved && (
                <span className="text-emerald-400 font-semibold">
                  You will be prompted for email OTP verification upon your first login.
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchStatus}
                isLoading={isLoading}
                icon={<RefreshCw size={13} />}
              >
                Refresh Status
              </Button>

              {isApproved ? (
                <Link to="/login" className="w-full sm:w-auto">
                  <Button variant="primary" size="sm" className="w-full sm:w-auto">
                    Proceed to Login
                  </Button>
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition"
                >
                  <ArrowLeft size={14} />
                  <span>Return to Login</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
