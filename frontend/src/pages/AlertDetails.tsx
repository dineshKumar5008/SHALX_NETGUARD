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
  ShieldAlert, ArrowLeft, Flame, Ban, CheckCircle, Terminal 
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
        <Link to="/alerts" className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-slate-800 mb-3 transition-colors">
          <ArrowLeft size={13} />
          <span>Back to Alerts Queue</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold font-mono text-slate-900">{alert.title}</h1>
                <Badge variant={alert.severity.toLowerCase() as any}>{alert.severity}</Badge>
                <Badge variant={alert.status === 'NEW' ? 'primary' : 'default'}>{alert.status}</Badge>
              </div>
              <div className="text-xs font-mono text-slate-500 mt-0.5">
                Alert ID: <span className="text-blue-600 font-semibold">{alert.alert_id}</span> | Source Engine: {alert.source}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isAnalyst && (
            <div className="flex items-center gap-2">
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
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 rounded-lg flex items-center gap-2">
          <CheckCircle size={14} className="text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Forensic Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Network Threat Context">
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Threat Category:</span>
              <span className="text-slate-900 capitalize font-medium">{alert.category.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Attacker Source IP:</span>
              <span className="text-rose-600 font-semibold">{alert.source_ip || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Target Destination IP:</span>
              <span className="text-blue-600 font-semibold">{alert.destination_ip || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Target Port &amp; Protocol:</span>
              <span className="text-slate-800">{alert.destination_port || 'N/A'} ({alert.protocol || 'TCP'})</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">IDS Signature:</span>
              <span className="text-amber-800 font-medium truncate max-w-[240px]">{alert.signature || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Detection Timestamp:</span>
              <span className="text-slate-800">{new Date(alert.created_at).toLocaleString()} UTC</span>
            </div>
          </div>
        </Card>

        <Card title="Triage State &amp; Resolution Trail">
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Acknowledged By:</span>
              <span className="text-slate-800">{alert.acknowledged_by || 'Unacknowledged'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Resolved By:</span>
              <span className="text-slate-800">{alert.resolved_by || 'Pending Investigation'}</span>
            </div>
            <div className="py-1.5 border-b border-slate-100">
              <span className="text-slate-500 block mb-1">Resolution Notes:</span>
              <span className="text-slate-700 italic">{alert.resolution_notes || 'No analyst resolution notes entered.'}</span>
            </div>
            
            {/* Quick triage status change buttons */}
            {isAnalyst && (
              <div className="pt-2">
                <span className="text-slate-500 block mb-2 uppercase text-[10px] font-semibold">Quick Triage Transition:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleQuickTriage('acknowledge')}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs border border-slate-200 transition active:scale-[0.99]"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => handleQuickTriage('investigate')}
                    className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs transition active:scale-[0.99]"
                  >
                    Investigate
                  </button>
                  <button
                    onClick={() => handleQuickTriage('resolve')}
                    className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs transition active:scale-[0.99]"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => handleQuickTriage('false_positive')}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs border border-slate-200 transition active:scale-[0.99]"
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
            <Terminal size={15} className="text-blue-600" />
            <span>Raw Normalized IDS Payload Inspector</span>
          </div>
        }
      >
        <pre className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 overflow-x-auto max-h-96">
          {JSON.stringify(parsedRaw, null, 2)}
        </pre>
      </Card>
    </div>
  );
};
