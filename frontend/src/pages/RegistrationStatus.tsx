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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Subtle Grid Canvas */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      <div className="w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/50 p-7 sm:p-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl mb-3 shadow-xs">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-slate-900 uppercase">
            SHALX <span className="text-blue-600">NETGUARD</span>
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Access Registration Request Tracking
          </p>
        </div>

        {errorMessage ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 mb-6 flex items-start gap-2.5 font-sans shadow-xs">
            <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Card Banner */}
            <div className={`p-4 rounded-xl border flex flex-col items-center text-center gap-2.5 shadow-xs ${
              isPending 
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : isApproved
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {isPending && <Clock className="w-8 h-8 text-amber-600" />}
              {isApproved && <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
              {isRejected && <XCircle className="w-8 h-8 text-rose-600" />}

              <div>
                <div className="text-xs font-mono font-bold tracking-wider uppercase">
                  {isPending && 'STATUS: PENDING AUTHORIZATION'}
                  {isApproved && 'STATUS: APPROVED & ACTIVE'}
                  {isRejected && 'STATUS: REGISTRATION REJECTED'}
                </div>
                <p className="text-xs text-slate-600 mt-1 font-sans leading-relaxed">
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
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Request Tracking ID</span>
                <span className="text-blue-600 font-bold">REQ-#{statusData?.id || id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <User size={13} />
                  <span>Username</span>
                </span>
                <span className="text-slate-800 font-semibold">{statusData?.username || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Mail size={13} />
                  <span>Registered Email</span>
                </span>
                <span className="text-slate-700 font-mono">{statusData?.masked_email || '—'}</span>
              </div>
              {statusData?.rejection_reason && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-rose-700 font-bold block mb-1">Reason for Rejection:</span>
                  <span className="text-slate-700 font-sans text-xs leading-relaxed block bg-white p-2.5 rounded-lg border border-rose-200">
                    {statusData.rejection_reason}
                  </span>
                </div>
              )}
            </div>

            {/* Next Steps Hint */}
            <div className="text-[11px] text-slate-500 text-center font-sans leading-relaxed">
              {isPending && (
                <span>
                  💡 You will receive an automated email notification as soon as an operator processes your application.
                </span>
              )}
              {isApproved && (
                <span className="text-emerald-700 font-medium">
                  Dynamic email OTP verification will be required on your first login.
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
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition font-sans"
                >
                  <ArrowLeft size={13} />
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
