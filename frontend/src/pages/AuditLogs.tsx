import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { AuditLog } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { ScrollText, Search, RefreshCw, Eye, Terminal, Lock } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      let url = '/audit-logs?limit=100&';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (userFilter) url += `user=${encodeURIComponent(userFilter)}&`;

      const res = await apiClient.get(url);
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [userFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAuditLogs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <ScrollText className="w-5 h-5 text-indigo-400" />
            <span>IMMUTABLE SYSTEM AUDIT TRAIL</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Cryptographically Anchored Security Actions, Firewall Block Logs & User Activity
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchAuditLogs} icon={<RefreshCw size={13} />}>
          Refresh Audit Trail
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
            placeholder="Search audit trail by action, resource, or metadata..."
            className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-100 font-mono outline-none"
          />
        </form>

        <div className="flex items-center gap-3">
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-[#0a0d14] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none"
          >
            <option value="">All Actors</option>
            <option value="admin">admin</option>
            <option value="analyst">analyst</option>
            <option value="system">system</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <Card>
        {isLoading ? (
          <LoadingSpinner message="Querying Immutable Audit Trail..." />
        ) : logs.length === 0 ? (
          <EmptyState
            title="No Audit Records Found"
            description="No system security actions matched the current filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-400 border-b border-[#1e293b]">
                <tr>
                  <th className="pb-3">Timestamp (UTC)</th>
                  <th className="pb-3">Actor / User</th>
                  <th className="pb-3">Security Action</th>
                  <th className="pb-3">Target Resource</th>
                  <th className="pb-3">Result</th>
                  <th className="pb-3">Origin IP</th>
                  <th className="pb-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 font-semibold text-cyan-400">{log.user}</td>
                    <td className="py-3 font-bold text-slate-200">{log.action}</td>
                    <td className="py-3 text-slate-300 max-w-xs truncate">{log.resource}</td>
                    <td className="py-3">
                      <Badge variant={log.result === 'SUCCESS' ? 'online' : 'critical'}>{log.result}</Badge>
                    </td>
                    <td className="py-3 text-slate-400">{log.source_ip || '127.0.0.1'}</td>
                    <td className="py-3 text-right">
                      {log.metadata_json && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
                        >
                          Payload
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Metadata Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-cyan-400" />
            <span>Audit Action Metadata: {selectedLog?.action}</span>
          </div>
        }
      >
        {selectedLog && (
          <div className="space-y-4 text-xs font-mono">
            <pre className="bg-[#090d16] p-4 rounded-lg border border-[#1e293b] text-cyan-300 overflow-x-auto max-h-80">
              {JSON.stringify(JSON.parse(selectedLog.metadata_json || '{}'), null, 2)}
            </pre>
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
