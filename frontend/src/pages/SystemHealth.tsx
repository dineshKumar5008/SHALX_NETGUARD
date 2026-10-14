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
  Terminal, CheckCircle, AlertCircle
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            <span>System</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Hardware Health</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-blue-600" />
            <span>Host &amp; Infrastructure Health Telemetry</span>
          </h1>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchHealthData} icon={<RefreshCw size={13} />}>
          Refresh Telemetry
        </Button>
      </div>

      {/* SECTION 1: SOC SERVER HOST STATUS (SELF) */}
      {serverSelf && (
        <Card title={`SHALX NETGUARD Monitoring Host (${serverSelf.hostname} - ${serverSelf.os_name})`}>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                <span>CPU Utilization</span>
                <Cpu size={14} className="text-blue-600" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-900">{serverSelf.cpu_percent}%</div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    serverSelf.cpu_percent > 90
                      ? 'bg-rose-500'
                      : serverSelf.cpu_percent > 70
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, serverSelf.cpu_percent))}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1.5 flex justify-between">
                <span>Warn: {serverSelf.thresholds?.cpu_warn || 80}%</span>
                <span>Crit: {serverSelf.thresholds?.cpu_crit || 95}%</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                <span>RAM Utilization</span>
                <Activity size={14} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-900">{serverSelf.ram_percent}%</div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    serverSelf.ram_percent > 90
                      ? 'bg-rose-500'
                      : serverSelf.ram_percent > 75
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, serverSelf.ram_percent))}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1.5 flex justify-between">
                <span>{serverSelf.ram_used_gb} GB used</span>
                <span>{serverSelf.ram_total_gb} GB total</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                <span>Disk Utilization</span>
                <HardDrive size={14} className="text-amber-500" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-900">{serverSelf.disk_percent}%</div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(2, serverSelf.disk_percent))}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1.5 flex justify-between">
                <span>{serverSelf.disk_free_gb} GB free</span>
                <span>{serverSelf.disk_total_gb} GB total</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                <span>System Uptime</span>
                <ShieldCheck size={14} className="text-slate-500" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-900">
                {Math.floor(serverSelf.uptime_seconds / 3600)}h {Math.floor((serverSelf.uptime_seconds % 3600) / 60)}m
              </div>
              <div className="text-[10px] font-mono text-emerald-700 mt-2 flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>State: {serverSelf.status}</span>
                </span>
                <span className="text-slate-400 font-normal">{serverSelf.uptime_seconds % 60}s</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Subsystem Health Status Matrix */}
      <Card title="Infrastructure & Core Services Health Matrix">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">PostgreSQL / Neon Core Database</div>
              <div className="text-[10px] text-slate-500">Connection Pool Nominal</div>
            </div>
            <Badge variant="online">OPERATIONAL</Badge>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">FastAPI Async Core Backend</div>
              <div className="text-[10px] text-slate-500">REST Endpoints &amp; OpenAPI</div>
            </div>
            <Badge variant="online">OPERATIONAL</Badge>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">WebSocket Dispatch Manager</div>
              <div className="text-[10px] text-slate-500">Live Broadcast Engine</div>
            </div>
            <Badge variant="online">OPERATIONAL</Badge>
          </div>
        </div>
      </Card>

      {/* SECTION 2: REPORTING HOST MONITORING AGENTS */}
      <Card title="Reporting Host Monitoring Agents (Linux & Windows)">
        <div className="overflow-x-auto">
          <table className="soc-table">
            <thead>
              <tr>
                <th>Hostname</th>
                <th>IP Address</th>
                <th>Platform</th>
                <th>CPU Usage</th>
                <th>RAM Usage</th>
                <th>Disk Usage</th>
                <th>Uptime</th>
                <th>Health Status</th>
                <th className="text-right">Reported (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {hostMetrics.length > 0 ? (
                hostMetrics.map((host, idx) => (
                  <tr key={idx}>
                    <td className="font-medium text-slate-900 flex items-center gap-2">
                      <Server size={14} className={host.status === 'OFFLINE' ? 'text-slate-400' : 'text-blue-600'} />
                      <span className="font-sans font-semibold">{host.hostname}</span>
                    </td>
                    <td className="text-blue-600 font-semibold font-mono">
                      {host.ip_address || '—'}
                    </td>
                    <td className="text-slate-600">{host.os_name || 'Generic OS'}</td>
                    <td className={`font-semibold ${host.status === 'OFFLINE' ? 'text-slate-400' : 'text-blue-600'}`}>
                      {host.cpu_percent}%
                    </td>
                    <td className={`font-semibold ${host.status === 'OFFLINE' ? 'text-slate-400' : 'text-emerald-600'}`}>
                      {host.ram_percent}%
                    </td>
                    <td className={`font-semibold ${host.status === 'OFFLINE' ? 'text-slate-400' : 'text-amber-600'}`}>
                      {host.disk_percent}%
                    </td>
                    <td className="text-slate-600">
                      {Math.floor((host.uptime_seconds || 0) / 3600)}h {Math.floor(((host.uptime_seconds || 0) % 3600) / 60)}m
                    </td>
                    <td>
                      {getStatusBadge(host.status)}
                    </td>
                    <td className="text-right text-slate-500 text-[11px]">
                      {new Date(host.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-3">
                      <Radio className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="font-semibold text-slate-800">No Remote Monitoring Agents Currently Reporting</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                        Host telemetry requires an active NetGuard monitoring agent on client machines. Run the agent script on any Linux or Windows workstation to start streaming real-time hardware telemetry:
                      </p>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] font-mono text-blue-700 text-left overflow-x-auto flex items-center gap-2 font-semibold">
                        <Terminal size={13} className="text-slate-400 shrink-0" />
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
          <table className="soc-table">
            <thead>
              <tr>
                <th>Discovered Asset</th>
                <th>IP Address</th>
                <th>Device Type</th>
                <th>Hardware / Vendor</th>
                <th>Host Telemetry Pipeline</th>
                <th className="text-right">Last Discovered</th>
              </tr>
            </thead>
            <tbody>
              {discoveredDevices.length > 0 ? (
                discoveredDevices.map((dev) => (
                  <tr key={dev.device_id}>
                    <td className="font-semibold text-slate-900 flex items-center gap-2 font-sans">
                      <Laptop size={14} className="text-slate-500" />
                      <span>{dev.hostname || dev.ip_address}</span>
                    </td>
                    <td className="text-blue-600 font-semibold font-mono">{dev.ip_address}</td>
                    <td>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                        {dev.device_type}
                      </span>
                    </td>
                    <td className="text-slate-600">{dev.vendor || 'Generic Device'}</td>
                    <td>
                      {dev.has_agent ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <CheckCircle size={13} className="text-emerald-600" />
                          <span>{dev.telemetry_status}</span>
                        </span>
                      ) : dev.telemetry_status.includes('offline') ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                          <AlertCircle size={13} className="text-amber-600" />
                          <span>{dev.telemetry_status}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 font-normal">
                          <AlertCircle size={13} className="text-slate-400" />
                          <span>{dev.telemetry_status}</span>
                        </span>
                      )}
                    </td>
                    <td className="text-right text-slate-500 text-[11px]">
                      {dev.last_seen ? new Date(dev.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
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
