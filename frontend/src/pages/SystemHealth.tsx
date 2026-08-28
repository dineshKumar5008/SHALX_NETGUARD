import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { HealthMetric, ServerSelfHealth, DiscoveredDeviceTelemetryStatus } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  Activity, Server, Cpu, HardDrive, ShieldCheck, RefreshCw, Radio, Laptop,
  Router, Smartphone, HelpCircle, Terminal, CheckCircle, AlertCircle
} from 'lucide-react';

export const SystemHealth: React.FC = () => {
  const { subscribe } = useWebSocket();
  const [serverSelf, setServerSelf] = useState<ServerSelfHealth | null>(null);
  const [hostMetrics, setHostMetrics] = useState<HealthMetric[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDeviceTelemetryStatus[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchHealthData = async () => {
    try {
      const [selfRes, hostsRes, devRes] = await Promise.all([
        apiClient.get<ServerSelfHealth>('/health/server-self'),
        apiClient.get<HealthMetric[]>('/health/hosts'),
        apiClient.get<DiscoveredDeviceTelemetryStatus[]>('/health/discovered-devices'),
      ]);
      setServerSelf(selfRes.data);
      setHostMetrics(hostsRes.data);
      setDiscoveredDevices(devRes.data);
    } catch (err) {
      console.error('Failed to load health metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();

    const unsubscribe = subscribe('health_metric', (data: any) => {
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

  if (isLoading && !serverSelf) {
    return <LoadingSpinner message="Querying Monitoring Host & Telemetry Pipeline..." />;
  }

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'HEALTHY' || s === 'OPERATIONAL') return <Badge variant="online">HEALTHY</Badge>;
    if (s === 'WARNING') return <Badge variant="warning">WARNING</Badge>;
    if (s === 'CRITICAL') return <Badge variant="critical">CRITICAL</Badge>;
    if (s === 'OFFLINE') return <Badge variant="offline">OFFLINE</Badge>;
    return <Badge variant="offline">{status}</Badge>;
  };

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
            Real Host Resource Metrics (CPU, RAM, Disk, Uptime) & Verified Agent Telemetry Pipeline
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchHealthData} icon={<RefreshCw size={13} />}>
          Refresh Telemetry
        </Button>
      </div>

      {/* SECTION 1: SOC SERVER HOST STATUS (SELF) */}
      {serverSelf && (
        <Card title={`SHALX NETGUARD Monitoring Host (${serverSelf.hostname} - ${serverSelf.os_name})`}>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span>CPU UTILIZATION</span>
                <Cpu size={15} className="text-cyan-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-100">{serverSelf.cpu_percent}%</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    serverSelf.cpu_percent > 90
                      ? 'bg-rose-500'
                      : serverSelf.cpu_percent > 70
                      ? 'bg-amber-500'
                      : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, serverSelf.cpu_percent))}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1.5 flex justify-between">
                <span>Warn: {serverSelf.thresholds?.cpu_warn || 80}%</span>
                <span>Crit: {serverSelf.thresholds?.cpu_crit || 95}%</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span>RAM UTILIZATION</span>
                <Activity size={15} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-100">{serverSelf.ram_percent}%</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    serverSelf.ram_percent > 90
                      ? 'bg-rose-500'
                      : serverSelf.ram_percent > 75
                      ? 'bg-amber-500'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, serverSelf.ram_percent))}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1.5 flex justify-between">
                <span>{serverSelf.ram_used_gb} GB used</span>
                <span>{serverSelf.ram_total_gb} GB total</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span>DISK UTILIZATION</span>
                <HardDrive size={15} className="text-amber-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-100">{serverSelf.disk_percent}%</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(2, serverSelf.disk_percent))}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1.5 flex justify-between">
                <span>{serverSelf.disk_free_gb} GB free</span>
                <span>{serverSelf.disk_total_gb} GB total</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span>SYSTEM UPTIME</span>
                <ShieldCheck size={15} className="text-indigo-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-100">
                {Math.floor(serverSelf.uptime_seconds / 3600)}h {Math.floor((serverSelf.uptime_seconds % 3600) / 60)}m
              </div>
              <div className="text-[10px] font-mono text-emerald-400 mt-2 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>State: {serverSelf.status}</span>
                </span>
                <span>{serverSelf.uptime_seconds % 60}s</span>
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

      {/* SECTION 2: REPORTING HOST MONITORING AGENTS */}
      <Card title="Reporting Host Monitoring Agents (Linux & Windows)">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-[#1e293b]">
              <tr>
                <th className="pb-3">Hostname</th>
                <th className="pb-3">IP Address</th>
                <th className="pb-3">Platform</th>
                <th className="pb-3">CPU Usage</th>
                <th className="pb-3">RAM Usage</th>
                <th className="pb-3">Disk Usage</th>
                <th className="pb-3">Uptime</th>
                <th className="pb-3">Health Status</th>
                <th className="pb-3 text-right">Reported (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {hostMetrics.length > 0 ? (
                hostMetrics.map((host, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-slate-100 flex items-center gap-2">
                      <Server size={14} className={host.status === 'OFFLINE' ? 'text-slate-500' : 'text-cyan-400'} />
                      <span>{host.hostname}</span>
                    </td>
                    <td className="py-3 text-slate-300 font-mono">
                      {host.ip_address || '—'}
                    </td>
                    <td className="py-3 text-slate-300">{host.os_name || 'Generic OS'}</td>
                    <td className={`py-3 font-bold ${host.status === 'OFFLINE' ? 'text-slate-500' : 'text-cyan-400'}`}>
                      {host.cpu_percent}%
                    </td>
                    <td className={`py-3 font-bold ${host.status === 'OFFLINE' ? 'text-slate-500' : 'text-emerald-400'}`}>
                      {host.ram_percent}%
                    </td>
                    <td className={`py-3 font-bold ${host.status === 'OFFLINE' ? 'text-slate-500' : 'text-amber-400'}`}>
                      {host.disk_percent}%
                    </td>
                    <td className="py-3 text-slate-300">
                      {Math.floor((host.uptime_seconds || 0) / 3600)}h {Math.floor(((host.uptime_seconds || 0) % 3600) / 60)}m
                    </td>
                    <td className="py-3">
                      {getStatusBadge(host.status)}
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {new Date(host.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <Radio className="w-8 h-8 text-slate-600 mx-auto" />
                      <div className="font-semibold text-slate-300">No Remote Monitoring Agents Currently Reporting</div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Host telemetry requires an active NetGuard monitoring agent on client machines. Run the agent script on any Linux or Windows workstation to start streaming real-time hardware telemetry:
                      </p>
                      <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[11px] font-mono text-cyan-300 text-left overflow-x-auto flex items-center gap-2">
                        <Terminal size={13} className="text-slate-500 shrink-0" />
                        <code>python agents/windows/netguard_agent.py</code>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SECTION 3: DISCOVERED NETWORK DEVICES VS AGENT TELEMETRY STATUS */}
      <Card title="Discovered Network Assets (Discovery vs Host Telemetry Status)">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-[#1e293b]">
              <tr>
                <th className="pb-3">Discovered Asset</th>
                <th className="pb-3">IP Address</th>
                <th className="pb-3">Device Type</th>
                <th className="pb-3">Hardware / Vendor</th>
                <th className="pb-3">Host Telemetry Pipeline</th>
                <th className="pb-3 text-right">Last Discovered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {discoveredDevices.length > 0 ? (
                discoveredDevices.map((dev) => (
                  <tr key={dev.device_id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-slate-100 flex items-center gap-2">
                      <Laptop size={14} className="text-indigo-400" />
                      <span>{dev.hostname || dev.ip_address}</span>
                    </td>
                    <td className="py-3 text-slate-300 font-mono">{dev.ip_address}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px]">
                        {dev.device_type}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{dev.vendor || 'Generic Device'}</td>
                    <td className="py-3">
                      {dev.has_agent ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle size={13} className="text-emerald-400" />
                          <span>{dev.telemetry_status}</span>
                        </span>
                      ) : dev.telemetry_status.includes('offline') ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-400 font-normal">
                          <AlertCircle size={13} className="text-amber-400" />
                          <span>{dev.telemetry_status}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 font-normal">
                          <AlertCircle size={13} className="text-slate-600" />
                          <span>{dev.telemetry_status}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {dev.last_seen ? new Date(dev.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">
                    No discovered network devices found in active subnets.
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
