import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { NotificationSetting, NotificationLog } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  BellRing, Mail, Send, RefreshCw, CheckCircle2, AlertCircle, Radio, Settings 
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
      setSettingsList(setRes.data);
      setLogs(logsRes.data);
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
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <BellRing className="w-5 h-5 text-amber-400" />
            <span>EXTERNAL SECURITY NOTIFICATIONS & ALERT DISPATCH</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Multi-Channel Incident Advisory Routing (Email SMTP, Telegram Bot, Webhooks)
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchNotificationData} icon={<RefreshCw size={13} />}>
          Refresh Logs
        </Button>
      </div>

      {testStatus && (
        <div className="p-3 bg-cyan-950/70 border border-cyan-800 text-xs font-mono text-cyan-300 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{testStatus}</span>
        </div>
      )}

      {/* Notification Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Email SMTP Channel */}
        <Card className="border-t-4 border-t-cyan-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-cyan-400" />
              <h3 className="font-mono text-sm font-bold text-slate-100 uppercase">Email (SMTP)</h3>
            </div>
            <Badge variant="cyan">MEDIUM &bull; HIGH &bull; CRITICAL</Badge>
          </div>
          <p className="text-xs text-slate-400 font-mono mb-4">
            Dispatches rich HTML advisory alerts to the designated SOC engineering mailbox.
          </p>
          <div className="flex items-center justify-between pt-3 border-t border-[#1e293b]">
            <span className="text-xs font-mono text-slate-300">Channel Status: Active</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTestNotification('email')}
              isLoading={isTesting}
              icon={<Send size={12} />}
            >
              Test Email
            </Button>
          </div>
        </Card>

        {/* Telegram Bot Channel */}
        <Card className="border-t-4 border-t-indigo-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Send size={18} className="text-indigo-400" />
              <h3 className="font-mono text-sm font-bold text-slate-100 uppercase">Telegram Bot</h3>
            </div>
            <Badge variant="high">HIGH &bull; CRITICAL</Badge>
          </div>
          <p className="text-xs text-slate-400 font-mono mb-4">
            Direct high-priority push messages to the SOC Incident Response Telegram group.
          </p>
          <div className="flex items-center justify-between pt-3 border-t border-[#1e293b]">
            <span className="text-xs font-mono text-slate-300">Channel Status: Active</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTestNotification('telegram')}
              isLoading={isTesting}
              icon={<Send size={12} />}
            >
              Test Telegram
            </Button>
          </div>
        </Card>

        {/* Mock/Simulated Channel */}
        <Card className="border-t-4 border-t-amber-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio size={18} className="text-amber-400" />
              <h3 className="font-mono text-sm font-bold text-slate-100 uppercase">Lab Mock Adapter</h3>
            </div>
            <Badge variant="warning">DEV / LAB</Badge>
          </div>
          <p className="text-xs text-slate-400 font-mono mb-4">
            Safe offline simulation adapter for local college lab testing without live SMTP/Telegram tokens.
          </p>
          <div className="flex items-center justify-between pt-3 border-t border-[#1e293b]">
            <span className="text-xs font-mono text-emerald-400">Zero-Config Ready</span>
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
        </Card>
      </div>

      {/* Dispatched Notification History */}
      <Card title="Dispatched Notification Audit History" subtitle="Chronological log of alerts transmitted to external endpoints">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-[#1e293b]">
              <tr>
                <th className="pb-3">Channel</th>
                <th className="pb-3">Recipient</th>
                <th className="pb-3">Subject / Alert</th>
                <th className="pb-3">Transmission Status</th>
                <th className="pb-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-indigo-400">{log.channel}</td>
                    <td className="py-3 text-slate-300">{log.recipient}</td>
                    <td className="py-3 font-medium text-slate-200 max-w-sm truncate">{log.subject}</td>
                    <td className="py-3">
                      <Badge variant={log.status === 'SENT' ? 'online' : log.status === 'SIMULATED' ? 'warning' : 'critical'}>
                        {log.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    No external notifications dispatched yet.
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
