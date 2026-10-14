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
      setLogs(res.data || []);
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
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ScrollText className="w-5 h-5 text-blue-600" />
            <span>Immutable System Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cryptographically structured ledger of administrative operations, policy mutations, and access logs
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchAuditLogs} icon={<RefreshCw size={13} />}>
          Refresh Audit Trail
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 min-w-[260px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail by action, resource, or metadata..."
            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 font-mono outline-none transition"
          />
        </form>

        <div className="flex items-center gap-3">
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-mono rounded-lg px-3 py-1.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer shadow-xs"
          >
            <option value="">All Actors</option>
            <option value="admin">admin</option>
            <option value="analyst">analyst</option>
            <option value="system">system</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <Card title="Recorded Security Action Events" subtitle="Verifiable audit trail with origin IP telemetry">
        {isLoading ? (
          <LoadingSpinner message="Querying immutable audit trail..." />
        ) : logs.length === 0 ? (
          <EmptyState
            title="No Audit Records Found"
            description="No system security actions matched the current filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="soc-table w-full text-left text-xs font-mono">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Actor / User</th>
                  <th>Security Action</th>
                  <th>Target Resource</th>
                  <th>Result</th>
                  <th>Origin IP</th>
                  <th className="text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 font-semibold text-blue-600">{log.user}</td>
                    <td className="py-3 font-medium text-slate-800">{log.action}</td>
                    <td className="py-3 text-slate-600 max-w-xs truncate">{log.resource}</td>
                    <td className="py-3">
                      <Badge variant={log.result === 'SUCCESS' ? 'online' : 'critical'}>{log.result}</Badge>
                    </td>
                    <td className="py-3 text-slate-500 font-mono">{log.source_ip || '127.0.0.1'}</td>
                    <td className="py-3 text-right">
                      {log.metadata_json && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-sans transition border border-slate-200 shadow-xs"
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
            <Terminal size={15} className="text-blue-600" />
            <span className="font-semibold text-slate-900">Audit Action Metadata: {selectedLog?.action}</span>
          </div>
        }
      >
        {selectedLog && (
          <div className="space-y-4 text-xs font-mono">
            <pre className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-slate-100 overflow-x-auto max-h-80 shadow-inner">
              {JSON.stringify(JSON.parse(selectedLog.metadata_json || '{}'), null, 2)}
            </pre>
            <div className="flex justify-end pt-3 border-t border-slate-100">
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
