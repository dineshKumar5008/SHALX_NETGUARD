import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import { Alert, AlertSeverity, AlertStatus } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { 
  AlertTriangle, Search, Filter, RefreshCw, CheckCircle, ShieldAlert, 
  Flame, ExternalLink, ArrowRight, ShieldCheck, HelpCircle
} from 'lucide-react';

export const Alerts: React.FC = () => {
  const { isAnalyst } = useAuth();
  const { subscribe } = useWebSocket();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Triage Modal state
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [triageAction, setTriageAction] = useState<string>('acknowledge');
  const [triageNotes, setTriageNotes] = useState<string>('');
  const [isSubmittingTriage, setIsSubmittingTriage] = useState<boolean>(false);

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      let url = '/alerts?limit=100&';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (severityFilter) url += `severity=${encodeURIComponent(severityFilter)}&`;
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;

      const res = await apiClient.get(url);
      setAlerts(res.data);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const unsubscribe = subscribe('alert', (newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
    });

    return () => unsubscribe();
  }, [severityFilter, statusFilter, subscribe]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAlerts();
  };

  const handleTriageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    setIsSubmittingTriage(true);
    try {
      const res = await apiClient.post(`/alerts/${selectedAlert.id}/triage`, {
        action: triageAction,
        notes: triageNotes,
      });
      // Update local state
      setAlerts((prev) => prev.map((a) => (a.id === selectedAlert.id ? res.data : a)));
      setSelectedAlert(null);
      setTriageNotes('');
    } catch (err) {
      console.error('Triage error:', err);
    } finally {
      setIsSubmittingTriage(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>SECURITY ALERTS & THREAT TRIAGE</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Suricata IDS, Zeek Logs, and Behavioral Detection Rules Alert Queue
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={fetchAlerts} icon={<RefreshCw size={13} />}>
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="bg-[#0f1422] p-4 rounded-xl border border-[#1e293b] flex flex-wrap gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, IP address, signature, or alert ID..."
            className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-100 font-mono outline-none"
          />
        </form>

        <div className="flex items-center gap-3">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#0a0d14] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0a0d14] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="NEW">New (Unreviewed)</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
            <option value="FALSE_POSITIVE">False Positive</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <Card>
        {isLoading ? (
          <LoadingSpinner message="Querying Real-time Alert Registry..." />
        ) : alerts.length === 0 ? (
          <EmptyState
            title="No Security Alerts Found"
            description="The current search filter returned zero alerts or the IDS queue is nominal."
            action={
              <Button variant="secondary" size="sm" onClick={() => { setSeverityFilter(''); setStatusFilter(''); setSearch(''); }}>
                Clear Filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-400 border-b border-[#1e293b]">
                <tr>
                  <th className="pb-3">Alert ID</th>
                  <th className="pb-3">Severity</th>
                  <th className="pb-3">Threat Category</th>
                  <th className="pb-3">Signature / Threat Title</th>
                  <th className="pb-3">Source &rarr; Target</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-cyan-400">
                      <Link to={`/alerts/${alert.id}`} className="hover:underline">
                        {alert.alert_id}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Badge variant={alert.severity.toLowerCase() as any}>{alert.severity}</Badge>
                    </td>
                    <td className="py-3 text-slate-300 capitalize">{alert.category.replace('_', ' ')}</td>
                    <td className="py-3 font-medium text-slate-100 max-w-sm truncate">{alert.title}</td>
                    <td className="py-3 text-slate-300">
                      <span className="text-rose-400">{alert.source_ip || 'N/A'}</span>
                      <span className="text-slate-500 mx-1">&rarr;</span>
                      <span className="text-cyan-400">{alert.destination_ip || 'N/A'}:{alert.destination_port || ''}</span>
                    </td>
                    <td className="py-3">
                      <Badge variant={alert.status === 'NEW' ? 'cyan' : alert.status === 'RESOLVED' ? 'online' : 'default'}>
                        {alert.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-slate-400 whitespace-nowrap">
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 text-right space-x-2 whitespace-nowrap">
                      {isAnalyst && alert.status !== 'RESOLVED' && alert.status !== 'FALSE_POSITIVE' && (
                        <button
                          onClick={() => { setSelectedAlert(alert); setTriageAction('acknowledge'); }}
                          className="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/50 font-medium transition"
                        >
                          Triage
                        </button>
                      )}
                      <Link
                        to={`/alerts/${alert.id}`}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium inline-block"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Triage Action Modal */}
      <Modal
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title={
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-amber-400" size={18} />
            <span>Triage Alert {selectedAlert?.alert_id}</span>
          </div>
        }
      >
        {selectedAlert && (
          <form onSubmit={handleTriageSubmit} className="space-y-4">
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono">
              <div className="font-bold text-slate-100">{selectedAlert.title}</div>
              <div className="text-slate-400 mt-1">
                Source: <span className="text-rose-400">{selectedAlert.source_ip}</span> | Target:{' '}
                <span className="text-cyan-400">{selectedAlert.destination_ip}:{selectedAlert.destination_port}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">Triage Decision</label>
              <select
                value={triageAction}
                onChange={(e) => setTriageAction(e.target.value)}
                className="w-full bg-[#0a0d14] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg p-2.5 outline-none"
              >
                <option value="acknowledge">Acknowledge (Mark as Seen / Under Review)</option>
                <option value="investigate">Investigating (Active Forensic Triage)</option>
                <option value="resolve">Resolve (Remediated / Contained)</option>
                <option value="false_positive">Mark as False Positive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">Analyst Triage Notes</label>
              <textarea
                rows={3}
                value={triageNotes}
                onChange={(e) => setTriageNotes(e.target.value)}
                placeholder="Document findings, containment actions, or verification rationale..."
                className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedAlert(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingTriage}>
                Apply Triage Status
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
