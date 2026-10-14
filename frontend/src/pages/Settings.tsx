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
      setSettingsList(res.data || []);
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
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-blue-600" />
            <span>Global Platform Parameters & Policies</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Perimeter auto-response rules, monitored CIDR scopes, and IDS log ingestion telemetry paths
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchSettings} icon={<RefreshCw size={13} />}>
          Refresh Parameters
        </Button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 rounded-lg flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Threat Detection & Auto-Response Policies" subtitle="Automated perimeter isolation directives">
          <div className="space-y-3.5 text-xs font-mono">
            <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/90">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-800 uppercase text-[11px]">AUTO-BLOCK ON CRITICAL THREATS</span>
                <span className="text-amber-600 font-bold px-2 py-0.5 bg-amber-50 rounded border border-amber-200">
                  {settingsList.find((s) => s.key === 'AUTO_BLOCK_CRITICAL_ALERTS')?.value || 'false'}
                </span>
              </div>
              <p className="text-slate-500 text-xs font-sans">
                Enables immediate pfSense perimeter drop rule insertion upon CRITICAL IDS signature match.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/90">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-800 uppercase text-[11px]">AUTO-BLOCK RETENTION DURATION</span>
                <span className="text-blue-600 font-bold px-2 py-0.5 bg-blue-50 rounded border border-blue-200">
                  {settingsList.find((s) => s.key === 'AUTO_BLOCK_DURATION_MINUTES')?.value || '60'} mins
                </span>
              </div>
              <p className="text-slate-500 text-xs font-sans">
                Time-to-live before automated perimeter firewall drop entries expire from the active table.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Subnet Scopes & Ingestion Paths" subtitle="Monitored network topology addresses">
          <div className="space-y-3.5 text-xs font-mono">
            <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/90">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-800 uppercase text-[11px]">MONITORED CIDR SUBNETS</span>
              </div>
              <p className="text-blue-600 text-xs font-mono font-semibold break-all bg-white p-2 rounded-lg border border-slate-200">
                {settingsList.find((s) => s.key === 'MONITORED_SUBNETS')?.value || '192.168.10.0/24, 192.168.20.0/24, 192.168.30.0/24'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/90">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-800 uppercase text-[11px]">SURICATA EVE JSON LOG PATH</span>
              </div>
              <p className="text-slate-700 text-xs font-mono bg-white p-2 rounded-lg border border-slate-200">
                {settingsList.find((s) => s.key === 'SURICATA_EVE_PATH')?.value || './logs/suricata/eve.json'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Full Parameters Table */}
      <Card title="System Settings Registry" subtitle="Operational parameters registered in persistent storage">
        <div className="overflow-x-auto">
          <table className="soc-table w-full text-left text-xs font-mono">
            <thead>
              <tr>
                <th>Setting Key</th>
                <th>Configured Value</th>
                <th>Description</th>
                <th>Last Updated By</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settingsList.map((s) => (
                <tr key={s.key} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 font-semibold text-slate-800">{s.key}</td>
                  <td className="py-3 font-bold text-blue-600 max-w-xs truncate">{s.value}</td>
                  <td className="py-3 text-slate-500 font-sans">{s.description || '-'}</td>
                  <td className="py-3 text-slate-700">{s.updated_by}</td>
                  <td className="py-3 text-right">
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setEditingSetting(s);
                          setEditValue(s.value);
                        }}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-sans transition border border-slate-200 shadow-xs"
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
              <label className="block text-slate-700 mb-1.5 uppercase font-semibold text-[11px]">
                {editingSetting.key} Value
              </label>
              <input
                type="text"
                required
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              />
              <p className="text-slate-500 text-xs font-sans mt-1.5">{editingSetting.description}</p>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingSetting(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                Save Parameter
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
