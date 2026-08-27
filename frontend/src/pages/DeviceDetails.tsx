import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Device, Alert, HealthMetric } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  Server, Shield, Activity, Cpu, HardDrive, ArrowLeft, Ban, ShieldAlert, CheckCircle2, Network,
  Laptop, Smartphone, Monitor, Printer, Router, Tv, HelpCircle, Radio, Tag, Layers
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

export const DeviceDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [healthHistory, setHealthHistory] = useState<HealthMetric[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'alerts'>('overview');

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [devRes, alertRes, healthRes] = await Promise.all([
          apiClient.get(`/devices/${id}`),
          apiClient.get(`/devices/${id}/alerts`),
          apiClient.get(`/devices/${id}/health`),
        ]);
        setDevice(devRes.data);
        setAlerts(alertRes.data);
        setHealthHistory(healthRes.data);
      } catch (err) {
        console.error('Error fetching device details:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  if (isLoading || !device) {
    return <LoadingSpinner message="Retrieving Host Forensics & Hardware Telemetry..." />;
  }

  const formattedHealth = [...healthHistory].reverse().map((h) => ({
    time: new Date(h.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cpu: h.cpu_percent,
    ram: h.ram_percent,
    disk: h.disk_percent,
  }));

  const getDeviceTypeDisplay = (type?: string) => {
    const t = (type || 'Unknown').toLowerCase();
    switch (t) {
      case 'laptop':
        return { label: 'Laptop', emoji: '💻', icon: <Laptop size={16} className="text-cyan-400" /> };
      case 'mobile':
        return { label: 'Mobile', emoji: '📱', icon: <Smartphone size={16} className="text-emerald-400" /> };
      case 'desktop':
      case 'workstation':
        return { label: 'Desktop', emoji: '🖥', icon: <Monitor size={16} className="text-sky-400" /> };
      case 'printer':
        return { label: 'Printer', emoji: '🖨', icon: <Printer size={16} className="text-amber-400" /> };
      case 'router':
      case 'firewall':
        return { label: 'Router', emoji: '📡', icon: <Router size={16} className="text-indigo-400" /> };
      case 'iot':
        return { label: 'IoT', emoji: '📺', icon: <Tv size={16} className="text-purple-400" /> };
      default:
        return { label: 'Unknown', emoji: '❓', icon: <HelpCircle size={16} className="text-slate-400" /> };
    }
  };

  const devTypeInfo = getDeviceTypeDisplay(device.device_type);
  const openPortsList = Array.isArray(device.open_ports) ? device.open_ports : [];
  const detectedServicesList = Array.isArray(device.detected_services) ? device.detected_services : [];

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div>
        <Link to="/devices" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:underline mb-3">
          <ArrowLeft size={13} />
          <span>Back to Device Inventory</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              {devTypeInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold font-mono text-slate-100">{device.hostname || 'Hostname unavailable'}</h1>
                <Badge variant={device.status.toLowerCase() as any}>{device.status}</Badge>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                IP: <span className="text-cyan-400">{device.ip_address}</span> | MAC: {device.mac_address || 'Unavailable'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to={`/blocked-ips?target=${device.ip_address}`}>
              <Button variant="danger" size="sm" icon={<Ban size={13} />}>
                Quarantine / Block Host
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1e293b] gap-6 text-xs font-mono">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition border-b-2 font-medium ${
            activeTab === 'overview'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          System Overview &amp; Specifications
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`pb-3 transition border-b-2 font-medium flex items-center gap-1.5 ${
            activeTab === 'health'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity size={14} />
          <span>Host Health Telemetry ({healthHistory.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`pb-3 transition border-b-2 font-medium flex items-center gap-1.5 ${
            activeTab === 'alerts'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert size={14} />
          <span>Associated Alerts ({alerts.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Evidence-Based Hardware & Platform Specifications */}
            <Card title="DEVICE DETAILS &amp; SPECIFICATIONS">
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Device Name:</span>
                  <span className="text-slate-200 font-bold">{device.hostname || device.ip_address}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">IP Address:</span>
                  <span className="text-cyan-400 font-bold">{device.ip_address}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">MAC Address:</span>
                  <span className="text-slate-200">{device.mac_address || 'Unavailable'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Hostname:</span>
                  <span className="text-slate-200">{device.hostname || 'Hostname unavailable'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Device Type:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-100 font-bold flex items-center gap-1.5">
                      <span>{devTypeInfo.emoji}</span>
                      <span>{devTypeInfo.label}</span>
                    </span>
                    <Badge variant={
                      device.device_type_confidence === 'High' ? 'online' :
                      device.device_type_confidence === 'Medium' ? 'medium' : 'default'
                    }>
                      {device.device_type_confidence || 'Low'} Conf.
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Operating System:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200">
                      {device.os_type ? `${device.os_type} ${device.os_version || ''}`.trim() : 'Unknown'}
                    </span>
                    {device.os_type && (
                      <Badge variant={
                        device.os_confidence === 'High' ? 'online' :
                        device.os_confidence === 'Medium' ? 'medium' : 'default'
                      }>
                        {device.os_confidence || 'Low'}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Architecture:</span>
                  <span className="text-slate-200">{device.architecture || 'Not detected'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Hardware Vendor:</span>
                  <span className="text-slate-200">{device.vendor || 'Unknown Hardware'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-400">Status:</span>
                  <Badge variant={device.status.toLowerCase() as any}>{device.status}</Badge>
                </div>
              </div>
            </Card>

            {/* Card 2: Network Ports & Detected Services */}
            <Card title="DETECTED SERVICES &amp; OPEN PORTS">
              <div className="space-y-4 text-xs font-mono">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 uppercase font-semibold">Open Ports:</span>
                    <span className="text-cyan-400 font-mono text-[11px]">{openPortsList.length} Active</span>
                  </div>
                  {openPortsList.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {openPortsList.map((p) => (
                        <span key={p} className="px-2.5 py-1 bg-cyan-950/80 border border-cyan-800 text-cyan-300 rounded font-mono font-bold text-xs">
                          Port {p}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900/60 rounded border border-slate-800 text-slate-500 italic">
                      None detected (Filtered or closed)
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 uppercase font-semibold">Detected Services:</span>
                    <span className="text-sky-400 font-mono text-[11px]">{detectedServicesList.length} Identified</span>
                  </div>
                  {detectedServicesList.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detectedServicesList.map((s, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded border border-slate-700 text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900/60 rounded border border-slate-800 text-slate-500 italic">
                      None detected
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Monitoring Ingestion:</span>
                    <span className="text-emerald-400 font-semibold">{device.is_monitored ? 'Active Ingestion' : 'Passive'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">First Discovered:</span>
                    <span className="text-slate-300">{new Date(device.first_seen).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Last Telemetry Heartbeat:</span>
                    <span className="text-slate-300">{new Date(device.last_seen).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Network Interfaces Table */}
          <Card title="Physical &amp; Virtual Network Interfaces">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-slate-400 border-b border-[#1e293b]">
                  <tr>
                    <th className="pb-2">Interface</th>
                    <th className="pb-2">IP Address</th>
                    <th className="pb-2">MAC Address</th>
                    <th className="pb-2">Primary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {device.interfaces && device.interfaces.length > 0 ? (
                    device.interfaces.map((iface, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 font-semibold text-slate-200">{iface.interface_name}</td>
                        <td className="py-2.5 text-cyan-400">{iface.ip_address || device.ip_address}</td>
                        <td className="py-2.5 text-slate-400">{iface.mac_address || device.mac_address || '—'}</td>
                        <td className="py-2.5 text-emerald-400 font-semibold">{iface.is_primary ? 'YES' : 'NO'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-2.5 font-semibold text-slate-200">eth0</td>
                      <td className="py-2.5 text-cyan-400">{device.ip_address}</td>
                      <td className="py-2.5 text-slate-400">{device.mac_address || '—'}</td>
                      <td className="py-2.5 text-emerald-400 font-semibold">YES</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="space-y-6">
          <Card title="Host Resource Utilization Trend" subtitle="CPU, RAM, and Storage telemetry history">
            {formattedHealth.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">
                No historical health agent records yet. Start the host monitoring agent to report metrics.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formattedHealth}>
                    <XAxis dataKey="time" stroke="#475569" fontSize={10} />
                    <YAxis stroke="#475569" fontSize={10} domain={[0, 100]} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0d14',
                        borderColor: '#1e293b',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                    />
                    <Line type="monotone" dataKey="cpu" name="CPU (%)" stroke="#00f0ff" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ram" name="RAM (%)" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="disk" name="Disk (%)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'alerts' && (
        <Card title={`Security Alerts Involving ${device.hostname || device.ip_address}`}>
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-emerald-400 flex items-center justify-center gap-2">
              <CheckCircle2 size={16} />
              <span>Clean Host Posture: No suspicious threat alerts recorded against this asset.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-slate-400 border-b border-[#1e293b]">
                  <tr>
                    <th className="pb-2">Alert ID</th>
                    <th className="pb-2">Severity</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Title</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {alerts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-900/60">
                      <td className="py-2.5 font-semibold text-cyan-400">{a.alert_id}</td>
                      <td className="py-2.5">
                        <Badge variant={a.severity.toLowerCase() as any}>{a.severity}</Badge>
                      </td>
                      <td className="py-2.5 text-slate-300">{a.category}</td>
                      <td className="py-2.5 text-slate-200">{a.title}</td>
                      <td className="py-2.5">
                        <Badge variant={a.status === 'NEW' ? 'cyan' : 'default'}>{a.status}</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <Link to={`/alerts/${a.id}`} className="text-cyan-400 hover:underline">
                          Triage &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
