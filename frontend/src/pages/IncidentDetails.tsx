import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Incident } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  Flame, ArrowLeft, Clock, Ban, Plus, CheckCircle 
} from 'lucide-react';

export const IncidentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAnalyst } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [newNote, setNewNote] = useState<string>('');
  const [isAddingNote, setIsAddingNote] = useState<boolean>(false);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<string | null>(null);

  const fetchIncident = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/incidents/${id}`);
      setIncident(res.data);
    } catch (err) {
      console.error('Error fetching incident:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    try {
      const res = await apiClient.put(`/incidents/${id}`, { status: newStatus });
      setIncident(res.data);
      setStatusUpdateSuccess(`Status updated to ${newStatus}`);
      setTimeout(() => setStatusUpdateSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newNote.trim()) return;
    setIsAddingNote(true);
    try {
      await apiClient.post(`/incidents/${id}/notes`, { note: newNote });
      setNewNote('');
      fetchIncident();
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setIsAddingNote(false);
    }
  };

  if (isLoading || !incident) {
    return <LoadingSpinner message="Loading Forensic Incident Timeline & Evidence..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/incidents" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition mb-3 font-mono">
          <ArrowLeft size={13} />
          <span>Back to Incidents Registry</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
              <Flame className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900">{incident.title}</h1>
                <Badge variant={incident.severity.toLowerCase() as any}>{incident.severity}</Badge>
                <Badge variant={incident.status === 'RESOLVED' ? 'online' : incident.status === 'OPEN' ? 'critical' : 'warning'}>
                  {incident.status}
                </Badge>
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                Case ID: <span className="text-slate-800 font-semibold">{incident.incident_id}</span> &bull; Lead Analyst:{' '}
                <span className="text-slate-800 font-semibold">{incident.assigned_analyst || 'Unassigned'}</span>
              </div>
            </div>
          </div>

          {/* Quick Status Progression */}
          {isAnalyst && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 uppercase font-semibold text-[11px]">Lifecycle:</span>
              <select
                value={incident.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono rounded px-3 py-1.5 outline-none focus:border-blue-500"
              >
                <option value="OPEN">Open</option>
                <option value="INVESTIGATING">Investigating</option>
                <option value="CONTAINED">Contained</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {statusUpdateSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 rounded-lg flex items-center gap-2">
          <CheckCircle size={15} className="text-emerald-600" />
          <span>{statusUpdateSuccess}</span>
        </div>
      )}

      {/* Case Overview & Affected Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Case Intelligence Overview" subtitle="Forensic context and event summary" className="lg:col-span-2">
          <div className="space-y-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 uppercase text-[11px] font-semibold block mb-1.5">Narrative &amp; Findings:</span>
              <p className="text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed font-sans text-xs">
                {incident.description || 'No detailed narrative provided.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <span className="text-slate-500 uppercase text-[11px] block">Created By:</span>
                <span className="text-slate-800 font-semibold">{incident.created_by}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[11px] block">Created At:</span>
                <span className="text-slate-800">{new Date(incident.created_at).toLocaleString()} UTC</span>
              </div>
            </div>

            {incident.resolved_at && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 font-semibold">
                Resolved on {new Date(incident.resolved_at).toLocaleString()} UTC
              </div>
            )}
          </div>
        </Card>

        <Card title="Targeted Infrastructure" subtitle="Impacted perimeter and internal endpoints">
          <div className="space-y-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 uppercase text-[11px] font-semibold block mb-2">Affected IP Addresses:</span>
              <div className="flex flex-wrap gap-1.5">
                {incident.affected_ips ? (
                  incident.affected_ips.split(',').map((ip, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded font-mono text-xs text-slate-800"
                    >
                      {ip.trim()}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">None specified</span>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <span className="text-slate-500 uppercase text-[11px] font-semibold block mb-2">Perimeter Containment:</span>
              <Link to={`/blocked-ips`}>
                <Button variant="danger" size="sm" className="w-full" icon={<Ban size={13} />}>
                  View Firewall Blocks
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Forensic Timeline & Investigation Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Chronological Investigation Timeline" subtitle="Recorded telemetry milestones and operator findings" className="lg:col-span-2">
          {incident.timeline_events && incident.timeline_events.length > 0 ? (
            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
              {incident.timeline_events.map((evt, idx) => (
                <div key={idx} className="flex gap-4 relative">
                  <div className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0 z-10 text-slate-500 shadow-sm">
                    <Clock size={12} className="text-blue-600" />
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex-1 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="font-bold text-slate-800">{evt.actor}</span>
                      <span>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
                    </div>
                    <p className="text-slate-700 font-sans text-xs">{evt.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-mono text-slate-500 font-sans">
              No timeline events recorded yet.
            </div>
          )}
        </Card>

        {/* Add Note Form */}
        <Card title="Add Analyst Finding" subtitle="Record evidence to case ledger">
          {isAnalyst ? (
            <form onSubmit={handleAddNote} className="space-y-3 text-xs font-mono">
              <textarea
                rows={4}
                required
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log IOCs discovered, firewall rules applied, or packet analysis notes..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2.5 text-xs text-slate-900 font-mono outline-none resize-none"
              />
              <Button type="submit" variant="primary" size="sm" className="w-full" isLoading={isAddingNote} icon={<Plus size={13} />}>
                Record Finding
              </Button>
            </form>
          ) : (
            <div className="text-xs text-slate-500 font-mono text-center py-4 font-sans">
              Read-only mode. Analyst privileges required to log notes.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
