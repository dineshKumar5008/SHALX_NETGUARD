import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FirewallStatus, FirewallAction, FirewallRule } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  ShieldCheck, ShieldAlert, Plus, RefreshCw, CheckCircle2, XCircle, Router, Layers, Activity 
} from 'lucide-react';

export const Firewall: React.FC = () => {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<FirewallStatus | null>(null);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [actions, setActions] = useState<FirewallAction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New Rule Modal
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [ruleName, setRuleName] = useState<string>('');
  const [ruleAction, setRuleAction] = useState<'BLOCK' | 'PASS'>('BLOCK');
  const [sourceCidr, setSourceCidr] = useState<string>('any');
  const [destCidr, setDestCidr] = useState<string>('any');
  const [portRange, setPortRange] = useState<string>('any');
  const [protocol, setProtocol] = useState<string>('any');
  const [isCreatingRule, setIsCreatingRule] = useState<boolean>(false);

  const fetchFirewallData = async () => {
    setIsLoading(true);
    try {
      const [statusRes, rulesRes, actionsRes] = await Promise.all([
        apiClient.get('/firewall/status'),
        apiClient.get('/firewall/rules'),
        apiClient.get('/firewall/actions?limit=25'),
      ]);
      setStatus(statusRes.data);
      setRules(rulesRes.data);
      setActions(actionsRes.data);
    } catch (err) {
      console.error('Firewall fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFirewallData();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingRule(true);
    try {
      await apiClient.post('/firewall/rules', {
        rule_name: ruleName,
        action: ruleAction,
        source_cidr: sourceCidr,
        dest_cidr: destCidr,
        port_range: portRange,
        protocol: protocol,
        is_enabled: true,
      });
      setIsRuleModalOpen(false);
      setRuleName('');
      fetchFirewallData();
    } catch (err) {
      console.error('Create rule error:', err);
    } finally {
      setIsCreatingRule(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Checking Firewall Integration Status & Filter Policies..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span>PERIMETER FIREWALL & RESPONSE INTEGRATION</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            pfSense API Provider, Dynamic Threat Table Sync & Automated Containment
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsRuleModalOpen(true)}
              icon={<Plus size={13} />}
            >
              Add Filter Policy
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={fetchFirewallData} icon={<RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Firewall Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="!p-4 border-l-4 border-l-indigo-500">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Provider Mode</div>
          <div className="text-base font-mono font-bold text-slate-100 mt-1">{status?.provider}</div>
          <div className="text-[10px] text-indigo-400 font-mono mt-1">
            {status?.is_connected ? 'Connected / Synced' : 'Disconnected'}
          </div>
        </Card>

        <Card className="!p-4 border-l-4 border-l-rose-500">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Active Block Rules</div>
          <div className="text-2xl font-mono font-bold text-rose-400 mt-1">{status?.active_blocks_count || 0}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">Contained Hosts</div>
        </Card>

        <Card className="!p-4 border-l-4 border-l-emerald-500">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Protected Allowlist</div>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">{status?.protected_ips_count || 0}</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-1">Infrastructure Safelist</div>
        </Card>

        <Card className="!p-4 border-l-4 border-l-cyan-500">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Total Operations</div>
          <div className="text-2xl font-mono font-bold text-cyan-400 mt-1">{status?.total_actions_count || 0}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">Audited Responses</div>
        </Card>
      </div>

      {/* Rules Table */}
      <Card title="Active Firewall Rules & Policies" subtitle="Managed perimeter access control lists">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-[#1e293b]">
              <tr>
                <th className="pb-3">Policy Name</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Source CIDR</th>
                <th className="pb-3">Destination CIDR</th>
                <th className="pb-3">Port Range</th>
                <th className="pb-3">Protocol</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rules.length > 0 ? (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-slate-200">{rule.rule_name}</td>
                    <td className="py-3">
                      <Badge variant={rule.action === 'BLOCK' ? 'critical' : 'online'}>{rule.action}</Badge>
                    </td>
                    <td className="py-3 text-slate-300">{rule.source_cidr}</td>
                    <td className="py-3 text-slate-300">{rule.dest_cidr}</td>
                    <td className="py-3 text-slate-300">{rule.port_range}</td>
                    <td className="py-3 text-slate-300 uppercase">{rule.protocol}</td>
                    <td className="py-3">
                      <Badge variant={rule.is_enabled ? 'online' : 'offline'}>
                        {rule.is_enabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-500">
                    No custom user rules defined. Dynamic Threat Block Table is active.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Firewall Audit Actions */}
      <Card title="Recent Firewall Automated Actions" subtitle="Audit log of block and unblock commands">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-[#1e293b]">
              <tr>
                <th className="pb-2">Action</th>
                <th className="pb-2">Target IP</th>
                <th className="pb-2">Triggered By</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Details</th>
                <th className="pb-2 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {actions.map((act) => (
                <tr key={act.id} className="hover:bg-slate-900/60">
                  <td className="py-2.5 font-bold text-indigo-400">{act.action_type}</td>
                  <td className="py-2.5 font-bold text-rose-400">{act.ip_address || 'All'}</td>
                  <td className="py-2.5 text-slate-300">{act.triggered_by}</td>
                  <td className="py-2.5">
                    <Badge variant={act.status === 'SUCCESS' ? 'online' : 'warning'}>{act.status}</Badge>
                  </td>
                  <td className="py-2.5 text-slate-400 max-w-sm truncate">{act.details || '-'}</td>
                  <td className="py-2.5 text-right text-slate-400">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Rule Modal */}
      <Modal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        title="Create Firewall Policy Rule"
      >
        <form onSubmit={handleCreateRule} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-300 mb-1 uppercase">Rule Name</label>
            <input
              type="text"
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g. Block Malicious External SSH Subnet"
              className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 uppercase">Action</label>
              <select
                value={ruleAction}
                onChange={(e) => setRuleAction(e.target.value as any)}
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              >
                <option value="BLOCK">BLOCK (Drop Packet)</option>
                <option value="PASS">PASS (Allow)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1 uppercase">Protocol</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              >
                <option value="any">Any Protocol</option>
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="ICMP">ICMP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 uppercase">Source CIDR</label>
              <input
                type="text"
                value={sourceCidr}
                onChange={(e) => setSourceCidr(e.target.value)}
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 uppercase">Dest CIDR</label>
              <input
                type="text"
                value={destCidr}
                onChange={(e) => setDestCidr(e.target.value)}
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsRuleModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreatingRule}>
              Save Firewall Rule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
