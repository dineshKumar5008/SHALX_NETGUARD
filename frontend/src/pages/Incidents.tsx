import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Incident } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { 
  Flame, Plus, RefreshCw, Eye, ShieldAlert, CheckCircle2, User, Clock, AlertCircle 
} from 'lucide-react';

export const Incidents: React.FC = () => {
  const { isAnalyst, user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');

  // Create Incident Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newSeverity, setNewSeverity] = useState<string>('HIGH');
  const [newAffectedIps, setNewAffectedIps] = useState<string>('');
  const [newAssigned, setNewAssigned] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const fetchIncidents = async () => {
    setIsLoading(true);
    try {
      let url = '/incidents?';
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
      if (severityFilter) url += `severity=${encodeURIComponent(severityFilter)}&`;

      const res = await apiClient.get(url);
      setIncidents(res.data);
    } catch (err) {
      console.error('Error fetching incidents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter, severityFilter]);

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await apiClient.post('/incidents', {
        title: newTitle,
        description: newDescription,
        severity: newSeverity,
        affected_ips: newAffectedIps,
        assigned_analyst: newAssigned || user?.username,
      });
      setIsModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewAffectedIps('');
      fetchIncidents();
    } catch (err) {
      console.error('Failed to create incident:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-rose-400" />
            <span>INCIDENT INVESTIGATION & RESPONSE BOARD</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Forensic Case Management, Evidence Aggregation & Containment Tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAnalyst && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              icon={<Plus size={13} />}
            >
              Open New Incident
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={fetchIncidents} icon={<RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#0f1422] p-4 rounded-xl border border-[#1e293b] flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0a0d14] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="CONTAINED">Contained</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

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
        </div>
      </div>

      {/* Incidents List */}
      <Card>
        {isLoading ? (
          <LoadingSpinner message="Loading Incident Cases & Timelines..." />
        ) : incidents.length === 0 ? (
          <EmptyState
            title="No Active Incidents"
            description="There are currently no active forensic security incident cases in this view."
            action={
              isAnalyst && (
                <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
                  Create New Incident
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-400 border-b border-[#1e293b]">
                <tr>
                  <th className="pb-3">Incident ID</th>
                  <th className="pb-3">Severity</th>
                  <th className="pb-3">Title / Summary</th>
                  <th className="pb-3">Assigned Analyst</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Linked Alerts</th>
                  <th className="pb-3">Created</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-rose-400">
                      <Link to={`/incidents/${inc.id}`} className="hover:underline">
                        {inc.incident_id}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Badge variant={inc.severity.toLowerCase() as any}>{inc.severity}</Badge>
                    </td>
                    <td className="py-3 font-medium text-slate-100 max-w-sm truncate">{inc.title}</td>
                    <td className="py-3 text-slate-300 flex items-center gap-1.5">
                      <User size={13} className="text-cyan-400" />
                      <span>{inc.assigned_analyst || 'Unassigned'}</span>
                    </td>
                    <td className="py-3">
                      <Badge variant={inc.status === 'RESOLVED' ? 'online' : inc.status === 'OPEN' ? 'critical' : 'warning'}>
                        {inc.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-slate-300 font-semibold">{inc.alert_count} Alerts</td>
                    <td className="py-3 text-slate-400">
                      {new Date(inc.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/incidents/${inc.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium"
                      >
                        <Eye size={12} />
                        <span>Case File</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: Open New Incident */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Flame className="text-rose-400" size={18} />
            <span>Open Forensic Incident Investigation</span>
          </div>
        }
      >
        <form onSubmit={handleCreateIncident} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1 uppercase">Incident Title</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Distributed SSH Brute Force & Data Exfiltration Attempt"
              className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1 uppercase">Severity Level</label>
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value)}
                className="w-full bg-[#0a0d14] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg p-2.5 outline-none"
              >
                <option value="CRITICAL">Critical (Immediate Containment)</option>
                <option value="HIGH">High (Active Threat)</option>
                <option value="MEDIUM">Medium (Suspicious)</option>
                <option value="LOW">Low (Informational)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1 uppercase">Affected IP Addresses</label>
              <input
                type="text"
                value={newAffectedIps}
                onChange={(e) => setNewAffectedIps(e.target.value)}
                placeholder="e.g. 192.168.10.220, 192.168.20.50"
                className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1 uppercase">Case Description & Findings</label>
            <textarea
              rows={4}
              required
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Detail attacker vectors, IOCs, affected subnets, and initial response hypothesis..."
              className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreating}>
              Create Incident Case
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
