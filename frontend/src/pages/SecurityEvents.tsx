import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { SecurityEvent } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Binary, Search, RefreshCw, Terminal } from 'lucide-react';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            <span>Operations</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Telemetry Stream</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Binary className="w-5 h-5 text-blue-600" />
            <span>Normalized Security Events Stream</span>
          </h1>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchEvents} icon={<RefreshCw size={13} />}>
          Refresh Stream
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 min-w-[260px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by signature, IP address, or payload..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded pl-9 pr-3 py-1.5 text-xs text-slate-900 font-mono outline-none transition-colors"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono rounded px-2.5 py-1.5 outline-none focus:border-blue-500"
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
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono rounded px-2.5 py-1.5 outline-none focus:border-blue-500"
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
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Source &rarr; Target</th>
                  <th>Signature / Summary</th>
                  <th>Timestamp</th>
                  <th className="text-right">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => (
                  <tr key={evt.id}>
                    <td className="font-semibold text-blue-600">{evt.event_id}</td>
                    <td className="uppercase font-semibold text-slate-700">{evt.source}</td>
                    <td>
                      <Badge variant="primary">{evt.event_type}</Badge>
                    </td>
                    <td className="text-slate-600">
                      <span className="text-rose-600 font-semibold">{evt.source_ip || 'N/A'}</span>
                      <span className="text-slate-400 mx-1">&rarr;</span>
                      <span className="text-blue-600 font-semibold">{evt.destination_ip || 'N/A'}:{evt.destination_port || ''}</span>
                    </td>
                    <td className="text-slate-800 font-sans font-medium max-w-sm truncate">{evt.signature || evt.description}</td>
                    <td className="text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition font-medium text-xs active:scale-[0.99]"
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
            <Terminal size={15} className="text-blue-600" />
            <span>Event Payload Inspector: {selectedEvent?.event_id}</span>
          </div>
        }
        maxWidth="2xl"
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Source IP:</span>
                <span className="text-rose-600 font-semibold">{selectedEvent.source_ip || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Target:</span>
                <span className="text-blue-600 font-semibold">
                  {selectedEvent.destination_ip || 'N/A'}:{selectedEvent.destination_port}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-700 block mb-1 uppercase text-[10px] font-semibold">Raw JSON Payload:</span>
              <pre className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-slate-800 overflow-x-auto max-h-80">
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
