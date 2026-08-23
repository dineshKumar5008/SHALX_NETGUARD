import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  ShieldAlert, ArrowLeft, Flame, Ban, CheckCircle, Code, Shield, User, Clock, Terminal 
} from 'lucide-react';

export const AlertDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAnalyst } = useAuth();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEscalating, setIsEscalating] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchAlert = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/alerts/${id}`);
      setAlert(res.data);
    } catch (err) {
      console.error('Error fetching alert details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlert();
  }, [id]);

  const handleEscalate = async () => {
    if (!id) return;
    setIsEscalating(true);
    try {
      const res = await apiClient.post(`/alerts/${id}/escalate-to-incident`);
      setActionSuccess(`Alert successfully escalated to Incident ${res.data.incident_code}`);
      setTimeout(() => {
        navigate(`/incidents/${res.data.incident_id}`);
      }, 1500);
    } catch (err) {
      console.error('Escalation error:', err);
    } finally {
      setIsEscalating(false);
    }
  };

  const handleQuickTriage = async (action: string) => {
    if (!id) return;
    try {
      const res = await apiClient.post(`/alerts/${id}/triage`, {
        action,
        notes: `Quick triage action applied from Alert details inspection view.`,
      });
      setAlert(res.data);
      setActionSuccess(`Status updated to ${res.data.status}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error('Quick triage error:', err);
    }
  };

  if (isLoading || !alert) {
    return <LoadingSpinner message="Parsing IDS Signature & Raw Forensic Payload..." />;
  }

  let parsedRaw = null;
  if (alert.raw_event) {
    try {
      parsedRaw = JSON.parse(alert.raw_event);
    } catch (e) {
      parsedRaw = alert.raw_event;
    }
  }

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div>
        <Link to="/alerts" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:underline mb-3">
          <ArrowLeft size={13} />
          <span>Back to Alerts Queue</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold font-mono text-slate-100">{alert.title}</h1>
                <Badge variant={alert.severity.toLowerCase() as any}>{alert.severity}</Badge>
                <Badge variant={alert.status === 'NEW' ? 'cyan' : 'default'}>{alert.status}</Badge>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                Alert ID: <span className="text-cyan-400">{alert.alert_id}</span> | Source Engine: {alert.source}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isAnalyst && (
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleEscalate}
                isLoading={isEscalating}
                icon={<Flame size={14} />}
              >
                Escalate to Incident
              </Button>
              {alert.source_ip && (
                <Link to={`/blocked-ips?target=${alert.source_ip}`}>
                  <Button variant="danger" size="sm" icon={<Ban size={14} />}>
                    Block Offender IP
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-xs font-mono text-emerald-300 rounded-lg flex items-center gap-2">
          <CheckCircle size={15} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Forensic Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Network Threat Context">
          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Threat Category:</span>
              <span className="text-slate-200 capitalize font-semibold">{alert.category.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Attacker Source IP:</span>
              <span className="text-rose-400 font-bold">{alert.source_ip || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Target Destination IP:</span>
              <span className="text-cyan-400 font-bold">{alert.destination_ip || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Target Port & Protocol:</span>
              <span className="text-slate-200">{alert.destination_port || 'N/A'} ({alert.protocol || 'TCP'})</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">IDS Signature:</span>
              <span className="text-amber-300 truncate max-w-[240px]">{alert.signature || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Detection Timestamp:</span>
              <span className="text-slate-200">{new Date(alert.created_at).toLocaleString()} UTC</span>
            </div>
          </div>
        </Card>

        <Card title="Triage State & Resolution Trail">
          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Acknowledged By:</span>
              <span className="text-slate-200">{alert.acknowledged_by || 'Unacknowledged'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Resolved By:</span>
              <span className="text-slate-200">{alert.resolved_by || 'Pending Investigation'}</span>
            </div>
            <div className="py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400 block mb-1">Resolution Notes:</span>
              <span className="text-slate-300 italic">{alert.resolution_notes || 'No analyst resolution notes entered.'}</span>
            </div>
            
            {/* Quick triage status change buttons */}
            {isAnalyst && (
              <div className="pt-2">
                <span className="text-slate-400 block mb-2 uppercase text-[10px]">Quick Triage Transition:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleQuickTriage('acknowledge')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => handleQuickTriage('investigate')}
                    className="px-2.5 py-1 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 text-xs transition"
                  >
                    Investigate
                  </button>
                  <button
                    onClick={() => handleQuickTriage('resolve')}
                    className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs transition"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => handleQuickTriage('false_positive')}
                    className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700 text-xs transition"
                  >
                    False Positive
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Raw Event JSON & Packet Payload Inspector */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-cyan-400" />
            <span>Raw Normalized IDS Payload Inspector</span>
          </div>
        }
      >
        <pre className="bg-[#090d16] p-4 rounded-lg border border-[#1e293b] text-xs font-mono text-cyan-300 overflow-x-auto max-h-96">
          {JSON.stringify(parsedRaw, null, 2)}
        </pre>
      </Card>
    </div>
  );
};
