import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { BlockedIP } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { 
  Ban, Plus, RefreshCw, Unlock, ShieldAlert, CheckCircle2, Clock, AlertCircle 
} from 'lucide-react';

export const BlockedIPs: React.FC = () => {
  const { isAnalyst } = useAuth();
  const { subscribe } = useWebSocket();
  const [searchParams] = useSearchParams();
  const [blockedList, setBlockedList] = useState<BlockedIP[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Block Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [ipToBlock, setIpToBlock] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(60);
  const [isBlocking, setIsBlocking] = useState<boolean>(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const fetchBlockedIPs = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/firewall/blocked-ips?active_only=true');
      setBlockedList(res.data);
    } catch (err) {
      console.error('Error fetching blocked IPs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const targetParam = searchParams.get('target');
    if (targetParam) {
      setIpToBlock(targetParam);
      setReason('Identified threat actor originating from SOC incident analysis');
      setIsModalOpen(true);
    }
    fetchBlockedIPs();

    const unBlock = subscribe('firewall_block', () => fetchBlockedIPs());
    const unUnblock = subscribe('firewall_unblock', () => fetchBlockedIPs());

    return () => {
      unBlock();
      unUnblock();
    };
  }, [searchParams, subscribe]);

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBlocking(true);
    setBlockError(null);
    try {
      await apiClient.post('/firewall/block', {
        ip_address: ipToBlock,
        reason,
        duration_minutes: durationMinutes === '' ? null : Number(durationMinutes),
      });
      setIsModalOpen(false);
      setIpToBlock('');
      setReason('');
      fetchBlockedIPs();
    } catch (err: any) {
      setBlockError(err.response?.data?.detail || 'Failed to block IP on perimeter firewall.');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblock = async (ip: string) => {
    if (!window.confirm(`Are you sure you want to unblock ${ip} from the firewall perimeter?`)) return;
    try {
      await apiClient.post(`/firewall/unblock/${ip}`);
      fetchBlockedIPs();
    } catch (err) {
      console.error('Failed to unblock IP:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            <span>Response &amp; Defense</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Blocked IP Registry</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Ban className="w-5 h-5 text-red-600" />
            <span>Perimeter Blocked IP Registry</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isAnalyst && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => { setBlockError(null); setIsModalOpen(true); }}
              icon={<Plus size={13} />}
            >
              Block Threat IP
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={fetchBlockedIPs} icon={<RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-lg flex items-start gap-3 text-xs font-mono">
        <ShieldAlert size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-slate-700">
          <span className="font-semibold text-slate-900 uppercase mr-1">Protected Infrastructure Safelist:</span>
          SHALX NETGUARD SOC strictly enforces a safety allowlist preventing critical gateways (192.168.1.1, 192.168.10.1, 192.168.20.1), DNS servers (8.8.8.8, 1.1.1.1), and the SOC monitoring server itself from being blocked.
        </div>
      </div>

      {/* Blocked IPs Table */}
      <Card>
        {isLoading ? (
          <LoadingSpinner message="Querying Firewall Containment State..." />
        ) : blockedList.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={32} className="text-emerald-600" />}
            title="No Currently Blocked IPs"
            description="Perimeter firewall is operating with normal routing and zero active IP block drop rules."
            action={
              isAnalyst && (
                <Button variant="danger" size="sm" onClick={() => setIsModalOpen(true)}>
                  Block Threat IP
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Blocked IP Address</th>
                  <th>Threat Reason</th>
                  <th>Blocked By</th>
                  <th>Blocked Timestamp</th>
                  <th>Expiration Policy</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {blockedList.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold text-red-600 flex items-center gap-1.5 font-mono">
                      <Ban size={12} className="text-red-500" />
                      <span>{item.ip_address}</span>
                    </td>
                    <td className="text-slate-800 font-sans max-w-sm truncate">{item.reason}</td>
                    <td className="text-slate-600 font-sans">{item.blocked_by}</td>
                    <td className="text-slate-500 text-[11px]">
                      {new Date(item.blocked_at).toLocaleString()}
                    </td>
                    <td className="text-slate-700">
                      {item.expires_at ? (
                        <span className="flex items-center gap-1 text-amber-700 font-semibold">
                          <Clock size={12} />
                          <span>{new Date(item.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Indefinite (Manual)</span>
                      )}
                    </td>
                    <td>
                      <Badge variant="critical">BLOCKED</Badge>
                    </td>
                    <td className="text-right">
                      {isAnalyst && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUnblock(item.ip_address)}
                          icon={<Unlock size={12} />}
                        >
                          Unblock
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Block IP Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Ban className="text-red-600" size={16} />
            <span>Block Malicious IP on Firewall</span>
          </div>
        }
      >
        <form onSubmit={handleBlockSubmit} className="space-y-4 text-xs font-mono">
          {blockError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{blockError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 mb-1 uppercase font-semibold">Target IP Address</label>
            <input
              type="text"
              required
              value={ipToBlock}
              onChange={(e) => setIpToBlock(e.target.value)}
              placeholder="e.g. 192.168.10.220"
              className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 rounded p-2 text-slate-900 outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1 uppercase font-semibold">Block Duration</label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 rounded p-2 text-slate-800 outline-none"
            >
              <option value={30}>30 Minutes (Short Containment)</option>
              <option value={60}>1 Hour (Standard Containment)</option>
              <option value={1440}>24 Hours (Full Day)</option>
              <option value="">Indefinite (Until Analyst Unblocks)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 mb-1 uppercase font-semibold">Threat Justification / Reason</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Document threat justification: e.g. Repeated SSH Brute Force & port scan activity detected by Suricata IDS..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 rounded p-2 text-slate-900 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm" isLoading={isBlocking}>
              Confirm Firewall Block
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
