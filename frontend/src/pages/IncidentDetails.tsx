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
  Flame, ArrowLeft, Clock, User, Ban, MessageSquare, Plus, CheckCircle, ShieldAlert, CheckCircle2 
} from 'lucide-react';

export const IncidentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAnalyst, user } = useAuth();
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
        <Link to="/incidents" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:underline mb-3">
          <ArrowLeft size={13} />
          <span>Back to Incidents Board</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <Flame className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold font-mono text-slate-100">{incident.title}</h1>
                <Badge variant={incident.severity.toLowerCase() as any}>{incident.severity}</Badge>
                <Badge variant={incident.status === 'RESOLVED' ? 'online' : incident.status === 'OPEN' ? 'critical' : 'warning'}>
                  {incident.status}
                </Badge>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                Case ID: <span className="text-rose-400">{incident.incident_id}</span> | Lead Analyst:{' '}
                <span className="text-cyan-400">{incident.assigned_analyst || 'Unassigned'}</span>
              </div>
            </div>
          </div>

          {/* Quick Status Progression */}
          {isAnalyst && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Status:</span>
              <select
                value={incident.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-[#0f1422] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none font-semibold"
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
        <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-xs font-mono text-emerald-300 rounded-lg flex items-center gap-2">
          <CheckCircle size={15} />
          <span>{statusUpdateSuccess}</span>
        </div>
      )}

      {/* Case Overview & Affected Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Executive Case Overview" className="lg:col-span-2">
          <div className="space-y-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 block mb-1 uppercase font-semibold">Incident Narrative:</span>
              <p className="text-slate-200 bg-[#090d16] p-3 rounded-lg border border-slate-800 whitespace-pre-wrap leading-relaxed">
                {incident.description || 'No detailed narrative provided.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <span className="text-slate-400 block uppercase">Created By:</span>
                <span className="text-slate-200 font-semibold">{incident.created_by}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase">Created At:</span>
                <span className="text-slate-200">{new Date(incident.created_at).toLocaleString()} UTC</span>
              </div>
            </div>

            {incident.resolved_at && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300">
                Resolved on {new Date(incident.resolved_at).toLocaleString()} UTC
              </div>
            )}
          </div>
        </Card>

        <Card title="Targeted Infrastructure">
          <div className="space-y-3 text-xs font-mono">
            <div>
              <span className="text-slate-400 block uppercase mb-1">Affected IP Addresses:</span>
              <div className="flex flex-wrap gap-1.5">
                {incident.affected_ips ? (
                  incident.affected_ips.split(',').map((ip, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded font-semibold text-cyan-400"
                    >
                      {ip.trim()}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">None specified</span>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <span className="text-slate-400 block uppercase mb-2">Containment Actions:</span>
              <Link to={`/blocked-ips`}>
                <Button variant="danger" size="sm" className="w-full" icon={<Ban size={13} />}>
                  Open Perimeter Firewall Blocks
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Forensic Timeline & Investigation Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Chronological Investigation Timeline" className="lg:col-span-2">
          {incident.timeline_events && incident.timeline_events.length > 0 ? (
            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
              {incident.timeline_events.map((evt, idx) => (
                <div key={idx} className="flex gap-4 relative">
                  <div className="w-7 h-7 rounded-full bg-slate-900 border border-cyan-500/60 flex items-center justify-center shrink-0 z-10">
                    <Clock size={13} className="text-cyan-400" />
                  </div>
                  <div className="bg-[#090d16] p-3 rounded-lg border border-slate-800 flex-1 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="font-bold text-slate-200">{evt.actor}</span>
                      <span>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-300">{evt.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-mono text-slate-500">
              No timeline events recorded yet.
            </div>
          )}
        </Card>

        {/* Add Note Form */}
        <Card title="Add Analyst Finding / Note">
          {isAnalyst ? (
            <form onSubmit={handleAddNote} className="space-y-3 text-xs font-mono">
              <textarea
                rows={4}
                required
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log IOCs discovered, firewall rules applied, or packet analysis notes..."
                className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none"
              />
              <Button type="submit" variant="primary" size="sm" className="w-full" isLoading={isAddingNote} icon={<Plus size={13} />}>
                Record Finding to Timeline
              </Button>
            </form>
          ) : (
            <div className="text-xs text-slate-500 font-mono text-center py-4">
              Read-only mode. Analyst privileges required to log notes.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
