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
  Ban, Plus, RefreshCw, Unlock, ShieldAlert, CheckCircle2, Clock, AlertTriangle, AlertCircle 
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <Ban className="w-5 h-5 text-rose-400" />
            <span>PERIMETER BLOCKED IP REGISTRY</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Active Containment Table Enforced via pfSense Firewall Alias Tables
          </p>
        </div>
        <div className="flex items-center gap-3">
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
      <div className="bg-slate-900/90 border border-[#1e293b] p-4 rounded-xl flex items-start gap-3 text-xs font-mono">
        <ShieldAlert size={18} className="text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-slate-300">
          <span className="font-bold text-slate-100 uppercase mr-1">Protected Infrastructure Safelist:</span>
          SHALX NETGUARD SOC strictly enforces a safety allowlist preventing critical gateways (192.168.1.1, 192.168.10.1, 192.168.20.1), DNS servers (8.8.8.8, 1.1.1.1), and the SOC monitoring server itself from being blocked.
        </div>
      </div>

      {/* Blocked IPs Table */}
      <Card>
        {isLoading ? (
          <LoadingSpinner message="Querying Firewall Containment State..." />
        ) : blockedList.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={32} className="text-emerald-400" />}
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
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-400 border-b border-[#1e293b]">
                <tr>
                  <th className="pb-3">Blocked IP Address</th>
                  <th className="pb-3">Threat Reason</th>
                  <th className="pb-3">Blocked By</th>
                  <th className="pb-3">Blocked Timestamp</th>
                  <th className="pb-3">Expiration Policy</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {blockedList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-bold text-rose-400 flex items-center gap-1.5">
                      <Ban size={13} className="text-rose-500" />
                      <span>{item.ip_address}</span>
                    </td>
                    <td className="py-3 text-slate-200 max-w-sm truncate">{item.reason}</td>
                    <td className="py-3 text-cyan-400 font-semibold">{item.blocked_by}</td>
                    <td className="py-3 text-slate-400">
                      {new Date(item.blocked_at).toLocaleString()}
                    </td>
                    <td className="py-3 text-slate-300">
                      {item.expires_at ? (
                        <span className="flex items-center gap-1 text-amber-400">
                          <Clock size={12} />
                          <span>{new Date(item.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Indefinite (Manual)</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Badge variant="critical">BLOCKED</Badge>
                    </td>
                    <td className="py-3 text-right">
                      {isAnalyst && (
                        <Button
                          variant="outline"
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
            <Ban className="text-rose-400" size={18} />
            <span>Block Malicious IP on Firewall</span>
          </div>
        }
      >
        <form onSubmit={handleBlockSubmit} className="space-y-4 text-xs font-mono">
          {blockError && (
            <div className="p-3 bg-rose-950 border border-rose-800 rounded-lg text-rose-300 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{blockError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 mb-1 uppercase font-semibold">Target IP Address</label>
            <input
              type="text"
              required
              value={ipToBlock}
              onChange={(e) => setIpToBlock(e.target.value)}
              placeholder="e.g. 192.168.10.220"
              className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-rose-500 rounded-lg p-2.5 text-slate-100 outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 uppercase font-semibold">Block Duration</label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
            >
              <option value={30}>30 Minutes (Short Containment)</option>
              <option value={60}>1 Hour (Standard Containment)</option>
              <option value={1440}>24 Hours (Full Day)</option>
              <option value="">Indefinite (Until Analyst Unblocks)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 uppercase font-semibold">Threat Justification / Reason</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Document threat justification: e.g. Repeated SSH Brute Force & port scan activity detected by Suricata IDS..."
              className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg p-2.5 text-slate-100 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
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
