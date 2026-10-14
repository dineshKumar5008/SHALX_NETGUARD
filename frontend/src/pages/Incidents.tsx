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
  Flame, Plus, RefreshCw, Eye, User 
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            <span>Operations</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Incident Management</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-red-600" />
            <span>Incident Investigation &amp; Response Board</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono rounded px-2.5 py-1.5 outline-none focus:border-blue-500"
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
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono rounded px-2.5 py-1.5 outline-none focus:border-blue-500"
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
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Incident ID</th>
                  <th>Severity</th>
                  <th>Title / Summary</th>
                  <th>Assigned Analyst</th>
                  <th>Status</th>
                  <th>Linked Alerts</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td className="font-semibold text-red-600">
                      <Link to={`/incidents/${inc.id}`} className="hover:underline">
                        {inc.incident_id}
                      </Link>
                    </td>
                    <td>
                      <Badge variant={inc.severity.toLowerCase() as any}>{inc.severity}</Badge>
                    </td>
                    <td className="font-sans font-medium text-slate-900 max-w-sm truncate">{inc.title}</td>
                    <td className="text-slate-600 flex items-center gap-1.5 font-sans">
                      <User size={13} className="text-slate-400" />
                      <span>{inc.assigned_analyst || 'Unassigned'}</span>
                    </td>
                    <td>
                      <Badge variant={inc.status === 'RESOLVED' ? 'online' : inc.status === 'OPEN' ? 'critical' : 'medium'}>
                        {inc.status}
                      </Badge>
                    </td>
                    <td className="text-slate-700 font-semibold">{inc.alert_count} Alerts</td>
                    <td className="text-slate-500 text-[11px]">
                      {new Date(inc.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/incidents/${inc.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition font-medium text-xs border border-slate-200 active:scale-[0.99]"
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
            <Flame className="text-red-600" size={16} />
            <span>Open Forensic Incident Investigation</span>
          </div>
        }
      >
        <form onSubmit={handleCreateIncident} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-700 mb-1 uppercase font-semibold">Incident Title</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Distributed SSH Brute Force & Data Exfiltration Attempt"
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2 text-xs text-slate-900 font-mono outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-700 mb-1 uppercase font-semibold">Severity Level</label>
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 text-slate-800 text-xs font-mono rounded p-2 outline-none"
              >
                <option value="CRITICAL">Critical (Immediate Containment)</option>
                <option value="HIGH">High (Active Threat)</option>
                <option value="MEDIUM">Medium (Suspicious)</option>
                <option value="LOW">Low (Informational)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-700 mb-1 uppercase font-semibold">Affected IP Addresses</label>
              <input
                type="text"
                value={newAffectedIps}
                onChange={(e) => setNewAffectedIps(e.target.value)}
                placeholder="e.g. 192.168.10.220, 192.168.20.50"
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2 text-xs text-slate-900 font-mono outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-700 mb-1 uppercase font-semibold">Case Description &amp; Findings</label>
            <textarea
              rows={4}
              required
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Detail attacker vectors, IOCs, affected subnets, and initial response hypothesis..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2 text-xs text-slate-900 font-mono outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
