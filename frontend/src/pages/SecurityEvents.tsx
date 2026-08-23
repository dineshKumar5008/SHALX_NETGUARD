import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { SecurityEvent } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Binary, Search, Filter, RefreshCw, Eye, Terminal } from 'lucide-react';

export const SecurityEvents: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      let url = '/events?limit=100&';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (sourceFilter) url += `source=${encodeURIComponent(sourceFilter)}&`;
      if (typeFilter) url += `event_type=${encodeURIComponent(typeFilter)}&`;

      const res = await apiClient.get(url);
      setEvents(res.data);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [sourceFilter, typeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <Binary className="w-5 h-5 text-cyan-400" />
            <span>NORMALIZED SECURITY EVENTS STREAM</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Unified Telemetry Ingest (Suricata EVE, Zeek DNS/HTTP/TLS, Host Agents)
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchEvents} icon={<RefreshCw size={13} />}>
          Refresh Stream
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#0f1422] p-4 rounded-xl border border-[#1e293b] flex flex-wrap gap-4 items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 min-w-[260px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by signature, IP address, or payload..."
            className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-100 font-mono outline-none"
          />
        </form>

        <div className="flex items-center gap-3">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-[#0a0d14] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none"
          >
            <option value="">All Sources</option>
            <option value="suricata">Suricata IDS</option>
            <option value="zeek">Zeek Sensor</option>
            <option value="agent">Host Agents</option>
            <option value="simulator">Lab Simulator</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#0a0d14] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none"
          >
            <option value="">All Event Types</option>
            <option value="alert">Alerts</option>
            <option value="dns">DNS Queries</option>
            <option value="http">HTTP Requests</option>
            <option value="tls">TLS Sessions</option>
            <option value="flow">Flows / Connections</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <Card>
        {isLoading ? (
          <LoadingSpinner message="Ingesting & Formatting Security Events..." />
        ) : events.length === 0 ? (
          <EmptyState
            title="No Security Events Found"
            description="No matching telemetry events recorded in the current ingestion pipeline."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-400 border-b border-[#1e293b]">
                <tr>
                  <th className="pb-3">Event ID</th>
                  <th className="pb-3">Source</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Source &rarr; Target</th>
                  <th className="pb-3">Signature / Summary</th>
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-cyan-400">{evt.event_id}</td>
                    <td className="py-3 uppercase font-semibold text-slate-300">{evt.source}</td>
                    <td className="py-3">
                      <Badge variant="cyan">{evt.event_type}</Badge>
                    </td>
                    <td className="py-3 text-slate-300">
                      <span className="text-rose-400">{evt.source_ip || 'N/A'}</span>
                      <span className="text-slate-500 mx-1">&rarr;</span>
                      <span className="text-cyan-400">{evt.destination_ip || 'N/A'}:{evt.destination_port || ''}</span>
                    </td>
                    <td className="py-3 text-slate-200 max-w-sm truncate">{evt.signature || evt.description}</td>
                    <td className="py-3 text-slate-400 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium"
                      >
                        Payload
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Payload Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-cyan-400" />
            <span>Event Payload Inspector: {selectedEvent?.event_id}</span>
          </div>
        }
        maxWidth="2xl"
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-400 block">Source IP:</span>
                <span className="text-rose-400 font-bold">{selectedEvent.source_ip || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Target:</span>
                <span className="text-cyan-400 font-bold">
                  {selectedEvent.destination_ip || 'N/A'}:{selectedEvent.destination_port}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Raw JSON Payload:</span>
              <pre className="bg-[#090d16] p-4 rounded-lg border border-[#1e293b] text-cyan-300 overflow-x-auto max-h-80">
                {JSON.stringify(JSON.parse(selectedEvent.raw_payload || '{}'), null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
