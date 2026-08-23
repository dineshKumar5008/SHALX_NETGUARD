import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { HealthMetric } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  Activity, Server, Cpu, HardDrive, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw 
} from 'lucide-react';

export const SystemHealth: React.FC = () => {
  const { subscribe } = useWebSocket();
  const [serverSelf, setServerSelf] = useState<any>(null);
  const [hostMetrics, setHostMetrics] = useState<HealthMetric[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchHealthData = async () => {
    try {
      const [selfRes, hostsRes] = await Promise.all([
        apiClient.get('/health/server-self'),
        apiClient.get('/health/hosts'),
      ]);
      setServerSelf(selfRes.data);
      setHostMetrics(hostsRes.data);
    } catch (err) {
      console.error('Failed to load health metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();

    const unsubscribe = subscribe('health_metric', (data) => {
      setHostMetrics((prev) => {
        const filtered = prev.filter((h) => h.hostname !== data.hostname);
        return [data, ...filtered];
      });
    });

    const interval = setInterval(fetchHealthData, 10000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [subscribe]);

  if (isLoading) {
    return <LoadingSpinner message="Querying Host Monitoring Agents & Hardware Health..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>SYSTEM & HOST HARDWARE HEALTH TELEMETRY</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Host Resource Monitoring (CPU, RAM, Disk, Uptime) & Configurable Thresholds
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchHealthData} icon={<RefreshCw size={13} />}>
          Refresh Telemetry
        </Button>
      </div>

      {/* SOC Server Host Status */}
      {serverSelf && (
        <Card title="SHALX NETGUARD Monitoring Host (Self)">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span>CPU UTILIZATION</span>
                <Cpu size={14} className="text-cyan-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-100">{serverSelf.cpu_percent}%</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    serverSelf.cpu_percent > 90
                      ? 'bg-rose-500'
                      : serverSelf.cpu_percent > 70
                      ? 'bg-amber-500'
                      : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, serverSelf.cpu_percent)}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span>RAM UTILIZATION</span>
                <Activity size={14} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-100">{serverSelf.ram_percent}%</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    serverSelf.ram_percent > 90
                      ? 'bg-rose-500'
                      : serverSelf.ram_percent > 75
                      ? 'bg-amber-500'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, serverSelf.ram_percent)}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span>DISK UTILIZATION</span>
                <HardDrive size={14} className="text-amber-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-100">{serverSelf.disk_percent}%</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full"
                  style={{ width: `${Math.min(100, serverSelf.disk_percent)}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span>SYSTEM UPTIME</span>
                <ShieldCheck size={14} className="text-indigo-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-100">
                {Math.floor(serverSelf.uptime_seconds / 3600)}h {Math.floor((serverSelf.uptime_seconds % 3600) / 60)}m
              </div>
              <div className="text-[10px] font-mono text-emerald-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Host Status: {serverSelf.status}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Subsystem Health Status Matrix */}
      <Card title="Infrastructure & Core Services Health Matrix">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-[#090d16] rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-200">PostgreSQL / SQLite Database</div>
              <div className="text-[10px] text-slate-400">Connection Pool Nominal</div>
            </div>
            <Badge variant="online">OPERATIONAL</Badge>
          </div>

          <div className="p-3 bg-[#090d16] rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-200">FastAPI Async Core Backend</div>
              <div className="text-[10px] text-slate-400">REST Endpoints & OpenAPI</div>
            </div>
            <Badge variant="online">OPERATIONAL</Badge>
          </div>

          <div className="p-3 bg-[#090d16] rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-200">WebSocket Dispatch Manager</div>
              <div className="text-[10px] text-slate-400">Live Broadcast Engine</div>
            </div>
            <Badge variant="online">OPERATIONAL</Badge>
          </div>
        </div>
      </Card>

      {/* Monitored Host Agents Health Table */}
      <Card title="Reporting Host Monitoring Agents (Linux & Windows)">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-[#1e293b]">
              <tr>
                <th className="pb-3">Hostname</th>
                <th className="pb-3">Platform</th>
                <th className="pb-3">CPU Usage</th>
                <th className="pb-3">RAM Usage</th>
                <th className="pb-3">Disk Usage</th>
                <th className="pb-3">Health Status</th>
                <th className="pb-3 text-right">Reported (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {hostMetrics.length > 0 ? (
                hostMetrics.map((host, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-slate-100 flex items-center gap-2">
                      <Server size={14} className="text-cyan-400" />
                      <span>{host.hostname}</span>
                    </td>
                    <td className="py-3 text-slate-300">{host.os_name || 'Generic OS'}</td>
                    <td className="py-3 font-bold text-cyan-400">{host.cpu_percent}%</td>
                    <td className="py-3 font-bold text-emerald-400">{host.ram_percent}%</td>
                    <td className="py-3 font-bold text-amber-400">{host.disk_percent}%</td>
                    <td className="py-3">
                      <Badge variant={host.status.toLowerCase() as any}>{host.status}</Badge>
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {new Date(host.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-500">
                    No remote host agents reporting. Run netguard_agent.py on client nodes to start streaming metrics.
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
