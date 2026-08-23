import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SystemSetting } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  Sliders, RefreshCw, CheckCircle2, Edit, Save, Shield, HardDrive, Network, ShieldCheck 
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { isAdmin } = useAuth();
  const [settingsList, setSettingsList] = useState<SystemSetting[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [editingSetting, setEditingSetting] = useState<SystemSetting | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/settings');
      setSettingsList(res.data);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSetting) return;
    setIsSaving(true);
    try {
      const res = await apiClient.put(`/settings/${editingSetting.key}`, {
        key: editingSetting.key,
        value: editValue,
        description: editingSetting.description,
      });
      setSettingsList((prev) => prev.map((s) => (s.key === editingSetting.key ? res.data : s)));
      setSaveSuccess(`Updated setting ${editingSetting.key}`);
      setEditingSetting(null);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update setting:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Querying Global Platform Parameters & Policies..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <span>GLOBAL PLATFORM CONFIGURATION & POLICIES</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Subnet Scopes, Threat Response Rules, and Telemetry Thresholds
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchSettings} icon={<RefreshCw size={13} />}>
          Refresh Parameters
        </Button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-xs font-mono text-emerald-300 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Threat Detection & Auto-Response Policies">
          <div className="space-y-4 text-xs font-mono">
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-200">AUTO-BLOCK ON CRITICAL THREATS</span>
                <span className="text-amber-400 font-bold">
                  {settingsList.find((s) => s.key === 'AUTO_BLOCK_CRITICAL_ALERTS')?.value || 'false'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Enables immediate pfSense perimeter block insertion upon CRITICAL IDS rule match.
              </p>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-200">AUTO-BLOCK DURATION</span>
                <span className="text-cyan-400 font-bold">
                  {settingsList.find((s) => s.key === 'AUTO_BLOCK_DURATION_MINUTES')?.value || '60'} mins
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Duration before automated firewall drop rules automatically expire.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Subnet Scopes & Ingestion Paths">
          <div className="space-y-4 text-xs font-mono">
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-200">MONITORED CIDR SUBNETS</span>
              </div>
              <p className="text-cyan-400 text-[11px] font-semibold break-all">
                {settingsList.find((s) => s.key === 'MONITORED_SUBNETS')?.value || '192.168.10.0/24, 192.168.20.0/24, 192.168.30.0/24'}
              </p>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-200">SURICATA EVE JSON LOG PATH</span>
              </div>
              <p className="text-slate-300 text-[11px] font-mono">
                {settingsList.find((s) => s.key === 'SURICATA_EVE_PATH')?.value || './logs/suricata/eve.json'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Full Parameters Table */}
      <Card title="System Settings Registry">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-[#1e293b]">
              <tr>
                <th className="pb-3">Setting Key</th>
                <th className="pb-3">Configured Value</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Last Updated By</th>
                <th className="pb-3 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {settingsList.map((s) => (
                <tr key={s.key} className="hover:bg-slate-900/60 transition">
                  <td className="py-3 font-semibold text-slate-200">{s.key}</td>
                  <td className="py-3 font-bold text-cyan-400 max-w-xs truncate">{s.value}</td>
                  <td className="py-3 text-slate-400">{s.description || '-'}</td>
                  <td className="py-3 text-slate-300">{s.updated_by}</td>
                  <td className="py-3 text-right">
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setEditingSetting(s);
                          setEditValue(s.value);
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
                      >
                        Modify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Setting Modal */}
      <Modal
        isOpen={!!editingSetting}
        onClose={() => setEditingSetting(null)}
        title={`Modify Setting: ${editingSetting?.key}`}
      >
        {editingSetting && (
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-slate-300 mb-1 uppercase font-semibold">
                {editingSetting.key} Value
              </label>
              <input
                type="text"
                required
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              />
              <p className="text-slate-400 text-[11px] mt-1">{editingSetting.description}</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingSetting(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                Save Value
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
