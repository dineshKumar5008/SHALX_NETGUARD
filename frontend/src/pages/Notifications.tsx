import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { NotificationSetting, NotificationLog } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  BellRing, Mail, Send, RefreshCw, CheckCircle2, AlertCircle, Radio, Settings, ShieldCheck
} from 'lucide-react';

export const Notifications: React.FC = () => {
  const { isAdmin } = useAuth();
  const [settingsList, setSettingsList] = useState<NotificationSetting[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const fetchNotificationData = async () => {
    setIsLoading(true);
    try {
      const [setRes, logsRes] = await Promise.all([
        apiClient.get('/notifications/settings'),
        apiClient.get('/notifications/logs?limit=30'),
      ]);
      setSettingsList(setRes.data || []);
      setLogs(logsRes.data || []);
    } catch (err) {
      console.error('Error fetching notification data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotificationData();
  }, []);

  const handleToggleChannel = async (setting: NotificationSetting) => {
    try {
      const res = await apiClient.put(`/notifications/settings/${setting.channel_type}`, {
        is_enabled: !setting.is_enabled,
        min_severity: setting.min_severity,
      });
      setSettingsList((prev) => prev.map((s) => (s.id === setting.id ? res.data : s)));
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  const handleTestNotification = async (channel: string) => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await apiClient.post('/notifications/test', {
        channel,
        recipient: channel === 'email' ? 'analyst@netguard.soc' : 'SOC_Telegram_Group',
      });
      setTestStatus(`Test notification dispatched via ${channel.toUpperCase()}: ${res.data.message}`);
      fetchNotificationData();
    } catch (err: any) {
      setTestStatus(`Error dispatching test: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Retrieving Notification Provider Configurations..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BellRing className="w-5 h-5 text-blue-600" />
            <span>Advisory Dispatch & Notifications</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Multi-channel incident routing engine (Enterprise SMTP, Telegram Gateway, and Simulation Harness)
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchNotificationData} icon={<RefreshCw size={13} />}>
          Refresh Logs
        </Button>
      </div>

      {testStatus && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-xs font-mono text-blue-700 rounded-lg flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
          <span>{testStatus}</span>
        </div>
      )}

      {/* Notification Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Email SMTP Channel */}
        <Card title="Email Service (SMTP)" subtitle="RFC-5322 MIME advisory routing">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                  <Mail size={15} />
                </div>
                <span className="font-mono text-xs font-semibold text-slate-800">Production SMTP</span>
              </div>
              <Badge variant="medium">HIGH &bull; CRITICAL</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Dispatches authenticated security notices and dynamic verification OTPs to operator inboxes.
            </p>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs font-mono text-emerald-700 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestNotification('email')}
                isLoading={isTesting}
                icon={<Send size={12} />}
              >
                Test Dispatch
              </Button>
            </div>
          </div>
        </Card>

        {/* Telegram Bot Channel */}
        <Card title="Telegram Gateway" subtitle="Direct push webhook dispatch">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Send size={15} />
                </div>
                <span className="font-mono text-xs font-semibold text-slate-800">Incident Channel</span>
              </div>
              <Badge variant="critical">CRITICAL ONLY</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Broadcasts immediate escalation events to the on-call SOC mobile response channel.
            </p>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs font-mono text-emerald-700 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestNotification('telegram')}
                isLoading={isTesting}
                icon={<Send size={12} />}
              >
                Test Dispatch
              </Button>
            </div>
          </div>
        </Card>

        {/* Mock/Simulated Channel */}
        <Card title="Simulation Harness" subtitle="Local offline verification adapter">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
                  <Radio size={15} />
                </div>
                <span className="font-mono text-xs font-semibold text-slate-800">Lab Mock Driver</span>
              </div>
              <Badge variant="warning">DEV / LAB</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Safe offline driver recording notifications into database memory without live internet egress.
            </p>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs font-mono text-slate-500 font-medium">Zero-Egress</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTestNotification('mock')}
                isLoading={isTesting}
                icon={<Send size={12} />}
              >
                Test Mock
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Dispatched Notification History */}
      <Card title="Dispatched Notification Audit History" subtitle="Chronological log of alerts transmitted to external endpoints">
        <div className="overflow-x-auto">
          <table className="soc-table w-full text-left text-xs font-mono">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Recipient</th>
                <th>Subject / Alert</th>
                <th>Transmission Status</th>
                <th className="text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 font-semibold text-blue-600">{log.channel}</td>
                    <td className="py-3 text-slate-700">{log.recipient}</td>
                    <td className="py-3 font-sans text-xs text-slate-800 max-w-sm truncate">{log.subject}</td>
                    <td className="py-3">
                      <Badge variant={log.status === 'SENT' ? 'online' : log.status === 'SIMULATED' ? 'warning' : 'critical'}>
                        {log.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-right text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs">
                    No external notifications recorded in this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
