import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { 
  AlertTriangle, Search, RefreshCw, ShieldAlert 
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            <span>Operations</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Alert Triage Queue</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Security Alerts &amp; Threat Triage</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchAlerts} icon={<RefreshCw size={13} />}>
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, IP address, signature, or alert ID..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded pl-9 pr-3 py-1.5 text-xs text-slate-800 font-mono outline-none transition-colors"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono rounded px-2.5 py-1.5 outline-none focus:border-blue-500"
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
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono rounded px-2.5 py-1.5 outline-none focus:border-blue-500"
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
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Alert ID</th>
                  <th>Severity</th>
                  <th>Threat Category</th>
                  <th>Signature / Threat Title</th>
                  <th>Source &rarr; Target</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="font-semibold text-blue-600">
                      <Link to={`/alerts/${alert.id}`} className="hover:underline">
                        {alert.alert_id}
                      </Link>
                    </td>
                    <td>
                      <Badge variant={alert.severity.toLowerCase() as any}>{alert.severity}</Badge>
                    </td>
                    <td className="text-slate-600 capitalize">{alert.category.replace('_', ' ')}</td>
                    <td className="font-sans font-medium text-slate-900 max-w-sm truncate">{alert.title}</td>
                    <td className="text-slate-600">
                      <span className="text-rose-600 font-mono font-semibold">{alert.source_ip || 'N/A'}</span>
                      <span className="text-slate-400 mx-1">&rarr;</span>
                      <span className="text-blue-600 font-mono">{alert.destination_ip || 'N/A'}:{alert.destination_port || ''}</span>
                    </td>
                    <td>
                      <Badge variant={alert.status === 'NEW' ? 'primary' : alert.status === 'RESOLVED' ? 'online' : 'default'}>
                        {alert.status}
                      </Badge>
                    </td>
                    <td className="text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="text-right space-x-1.5 whitespace-nowrap">
                      {isAnalyst && alert.status !== 'RESOLVED' && alert.status !== 'FALSE_POSITIVE' && (
                        <button
                          onClick={() => { setSelectedAlert(alert); setTriageAction('acknowledge'); }}
                          className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium transition active:scale-[0.99]"
                        >
                          Triage
                        </button>
                      )}
                      <Link
                        to={`/alerts/${alert.id}`}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition font-medium text-xs border border-slate-200 inline-block active:scale-[0.99]"
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
            <ShieldAlert className="text-amber-500" size={16} />
            <span>Triage Alert {selectedAlert?.alert_id}</span>
          </div>
        }
      >
        {selectedAlert && (
          <form onSubmit={handleTriageSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono">
              <div className="font-semibold text-slate-900">{selectedAlert.title}</div>
              <div className="text-slate-500 mt-1">
                Source: <span className="text-rose-600 font-semibold">{selectedAlert.source_ip}</span> | Target:{' '}
                <span className="text-blue-600 font-semibold">{selectedAlert.destination_ip}:{selectedAlert.destination_port}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-700 mb-1.5 uppercase font-semibold">Triage Decision</label>
              <select
                value={triageAction}
                onChange={(e) => setTriageAction(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 text-slate-800 text-xs font-mono rounded p-2 outline-none"
              >
                <option value="acknowledge">Acknowledge (Mark as Seen / Under Review)</option>
                <option value="investigate">Investigating (Active Forensic Triage)</option>
                <option value="resolve">Resolve (Remediated / Contained)</option>
                <option value="false_positive">Mark as False Positive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-700 mb-1.5 uppercase font-semibold">Analyst Triage Notes</label>
              <textarea
                rows={3}
                value={triageNotes}
                onChange={(e) => setTriageNotes(e.target.value)}
                placeholder="Document findings, containment actions, or verification rationale..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2 text-xs text-slate-800 font-mono outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
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
