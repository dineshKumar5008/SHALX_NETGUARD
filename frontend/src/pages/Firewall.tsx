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
  ShieldCheck, Plus, RefreshCw 
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            <span>Response &amp; Defense</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Firewall Control</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Perimeter Firewall &amp; Response Policies</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Provider Mode</div>
          <div className="text-base font-mono font-bold text-slate-900 mt-1">{status?.provider}</div>
          <div className="text-[11px] text-blue-600 font-mono mt-1 font-semibold">
            {status?.is_connected ? 'Connected / Synced' : 'Disconnected'}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Active Block Rules</div>
          <div className="text-2xl font-mono font-bold text-rose-600 mt-1">{status?.active_blocks_count || 0}</div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">Contained Offender IPs</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Protected Safelist</div>
          <div className="text-2xl font-mono font-bold text-emerald-600 mt-1">{status?.protected_ips_count || 0}</div>
          <div className="text-[11px] text-emerald-700 font-mono mt-1 font-semibold">Infrastructure Safelist</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Total Policy Operations</div>
          <div className="text-2xl font-mono font-bold text-slate-900 mt-1">{status?.total_actions_count || 0}</div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">Audited Response Events</div>
        </div>
      </div>

      {/* Rules Table */}
      <Card title="Active Firewall Rules &amp; Policies" subtitle="Managed perimeter access control lists">
        <div className="overflow-x-auto">
          <table className="soc-table">
            <thead>
              <tr>
                <th>Policy Name</th>
                <th>Action</th>
                <th>Source CIDR</th>
                <th>Destination CIDR</th>
                <th>Port Range</th>
                <th>Protocol</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.length > 0 ? (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="font-semibold text-slate-900 font-sans">{rule.rule_name}</td>
                    <td>
                      <Badge variant={rule.action === 'BLOCK' ? 'critical' : 'online'}>{rule.action}</Badge>
                    </td>
                    <td className="text-slate-600">{rule.source_cidr}</td>
                    <td className="text-slate-600">{rule.dest_cidr}</td>
                    <td className="text-slate-600">{rule.port_range}</td>
                    <td className="text-slate-600 uppercase">{rule.protocol}</td>
                    <td>
                      <Badge variant={rule.is_enabled ? 'online' : 'offline'}>
                        {rule.is_enabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500 font-sans">
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
          <table className="soc-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Target IP</th>
                <th>Triggered By</th>
                <th>Status</th>
                <th>Details</th>
                <th className="text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((act) => (
                <tr key={act.id}>
                  <td className="font-semibold text-blue-600">{act.action_type}</td>
                  <td className="font-semibold text-rose-600">{act.ip_address || 'All'}</td>
                  <td className="text-slate-700">{act.triggered_by}</td>
                  <td>
                    <Badge variant={act.status === 'SUCCESS' ? 'online' : 'warning'}>{act.status}</Badge>
                  </td>
                  <td className="text-slate-600 max-w-sm truncate">{act.details || '-'}</td>
                  <td className="py-2.5 text-right text-slate-500 text-[11px]">
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
            <label className="block text-slate-700 mb-1 uppercase font-semibold">Rule Name</label>
            <input
              type="text"
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g. Block Malicious External SSH Subnet"
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2 text-slate-900 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold">Action</label>
              <select
                value={ruleAction}
                onChange={(e) => setRuleAction(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2 text-slate-900 outline-none"
              >
                <option value="BLOCK">BLOCK (Drop Packet)</option>
                <option value="PASS">PASS (Allow)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold">Protocol</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2 text-slate-900 outline-none"
              >
                <option value="any">Any Protocol</option>
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="ICMP">ICMP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold">Source CIDR</label>
              <input
                type="text"
                value={sourceCidr}
                onChange={(e) => setSourceCidr(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2 text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold">Dest CIDR</label>
              <input
                type="text"
                value={destCidr}
                onChange={(e) => setDestCidr(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2 text-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
