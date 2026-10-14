import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Device, Alert, HealthMetric, DeviceActivity } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  Server, Shield, Activity, Cpu, ArrowLeft, Ban, ShieldAlert, CheckCircle2, Network,
  Laptop, Smartphone, Monitor, Printer, Router, Tv, HelpCircle
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const DeviceDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [healthHistory, setHealthHistory] = useState<HealthMetric[]>([]);
  const [activity, setActivity] = useState<DeviceActivity | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'health' | 'alerts'>('overview');

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [devRes, alertRes, healthRes, actRes] = await Promise.all([
          apiClient.get(`/devices/${id}`),
          apiClient.get(`/devices/${id}/alerts`),
          apiClient.get(`/devices/${id}/health`),
          apiClient.get(`/devices/${id}/activity`).catch(() => ({ data: null })),
        ]);
        setDevice(devRes.data);
        setAlerts(alertRes.data);
        setHealthHistory(healthRes.data);
        if (actRes.data) {
          setActivity(actRes.data);
        }
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
        return { label: 'Laptop', emoji: '💻', icon: <Laptop size={16} className="text-blue-600" /> };
      case 'mobile':
        return { label: 'Mobile', emoji: '📱', icon: <Smartphone size={16} className="text-emerald-600" /> };
      case 'desktop':
      case 'workstation':
        return { label: 'Desktop', emoji: '🖥', icon: <Monitor size={16} className="text-slate-600" /> };
      case 'server':
        return { label: 'Server', emoji: '🖥️', icon: <Server size={16} className="text-indigo-600" /> };
      case 'router':
        return { label: 'Router', emoji: '📡', icon: <Router size={16} className="text-violet-600" /> };
      case 'switch':
        return { label: 'Switch', emoji: '🔀', icon: <Network size={16} className="text-blue-600" /> };
      case 'firewall':
        return { label: 'Firewall', emoji: '🛡️', icon: <Shield size={16} className="text-rose-600" /> };
      case 'printer':
        return { label: 'Printer', emoji: '🖨', icon: <Printer size={16} className="text-amber-600" /> };
      case 'iot':
        return { label: 'IoT', emoji: '📺', icon: <Tv size={16} className="text-slate-500" /> };
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
        <Link to="/devices" className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-slate-800 mb-3 transition-colors">
          <ArrowLeft size={13} />
          <span>Back to Device Inventory</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
              {devTypeInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold font-mono text-slate-900">{device.hostname || 'Unknown'}</h1>
                <Badge variant={device.status.toLowerCase() as any}>{device.status}</Badge>
              </div>
              <div className="text-xs font-mono text-slate-500 mt-0.5">
                IP: <span className="text-blue-600 font-semibold">{device.ip_address}</span> | MAC: {device.mac_address || 'Unknown'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to={`/blocked-ips?target=${device.ip_address}`}>
              <Button variant="danger" size="sm" icon={<Ban size={13} />}>
                Quarantine / Block Host
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-mono">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 transition border-b-2 font-medium ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          System Overview &amp; Specifications
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-2.5 transition border-b-2 font-medium flex items-center gap-1.5 ${
            activeTab === 'activity'
              ? 'border-blue-600 text-blue-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity size={13} />
          <span>Network &amp; Web Activity</span>
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`pb-2.5 transition border-b-2 font-medium flex items-center gap-1.5 ${
            activeTab === 'health'
              ? 'border-blue-600 text-blue-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cpu size={13} />
          <span>Host Health Telemetry</span>
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`pb-2.5 transition border-b-2 font-medium flex items-center gap-1.5 ${
            activeTab === 'alerts'
              ? 'border-blue-600 text-blue-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert size={13} />
          <span>Associated Alerts ({alerts.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Evidence-Based Hardware & Platform Specifications */}
            <Card title="Device Details &amp; Specifications">
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Device Name:</span>
                  <span className="text-slate-900 font-medium">{device.hostname || device.ip_address}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">IP Address:</span>
                  <span className="text-blue-600 font-semibold">{device.ip_address}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">MAC Address:</span>
                  <span className="text-slate-700">{device.mac_address || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Hostname:</span>
                  <span className="text-slate-700">{device.hostname || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Device Type:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-800 font-medium flex items-center gap-1.5">
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
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Operating System:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">
                      {device.os_type && device.os_type !== 'Unknown' ? `${device.os_type} ${device.os_version || ''}`.trim() : 'Unknown'}
                    </span>
                    {device.os_type && device.os_type !== 'Unknown' && (
                      <Badge variant={
                        device.os_confidence === 'High' ? 'online' :
                        device.os_confidence === 'Medium' ? 'medium' : 'default'
                      }>
                        {device.os_confidence || 'Low'}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Architecture:</span>
                  <span className="text-slate-700">{device.architecture || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Hardware Vendor:</span>
                  <span className="text-slate-700">{device.vendor || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Subnet Segment:</span>
                  <span className="text-slate-700">{device.subnet || '192.168.1.0/24'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">VLAN Segment:</span>
                  <span className="text-blue-600 font-semibold">{device.vlan || 'VLAN 1'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">Status:</span>
                  <Badge variant={device.status.toLowerCase() as any}>{device.status}</Badge>
                </div>
              </div>
            </Card>

            {/* Card 2: Network Ports & Detected Services */}
            <Card title="Detected Services &amp; Open Ports">
              <div className="space-y-4 text-xs font-mono">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 uppercase font-semibold">Open Ports:</span>
                    <span className="text-blue-600 font-mono text-[11px] font-semibold">{openPortsList.length} Active</span>
                  </div>
                  {openPortsList.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {openPortsList.map((p) => (
                        <span key={p} className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded font-mono font-medium text-xs">
                          Port {p}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-500 italic">
                      None detected (Filtered or closed)
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 uppercase font-semibold">Detected Services:</span>
                    <span className="text-slate-600 font-mono text-[11px]">{detectedServicesList.length} Identified</span>
                  </div>
                  {detectedServicesList.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detectedServicesList.map((s, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-500 italic">
                      None detected
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Monitoring Ingestion:</span>
                    <span className="text-emerald-700 font-semibold">{device.is_monitored ? 'Active Ingestion' : 'Passive'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">First Discovered:</span>
                    <span className="text-slate-700">{new Date(device.first_seen).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Last Telemetry Heartbeat:</span>
                    <span className="text-slate-700">{new Date(device.last_seen).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Network Interfaces Table */}
          <Card title="Physical &amp; Virtual Network Interfaces">
            <div className="overflow-x-auto">
              <table className="soc-table">
                <thead>
                  <tr>
                    <th>Interface</th>
                    <th>IP Address</th>
                    <th>MAC Address</th>
                    <th>Primary</th>
                  </tr>
                </thead>
                <tbody>
                  {device.interfaces && device.interfaces.length > 0 ? (
                    device.interfaces.map((iface, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold text-slate-800">{iface.interface_name}</td>
                        <td className="text-blue-600 font-semibold">{iface.ip_address || device.ip_address}</td>
                        <td className="text-slate-500">{iface.mac_address || device.mac_address || '—'}</td>
                        <td className="text-emerald-700 font-semibold">{iface.is_primary ? 'YES' : 'NO'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="font-semibold text-slate-800">eth0</td>
                      <td className="text-blue-600 font-semibold">{device.ip_address}</td>
                      <td className="text-slate-500">{device.mac_address || '—'}</td>
                      <td className="text-emerald-700 font-semibold">YES</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: Network & Web Activity */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-sm">
              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">DNS Queries</div>
              <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
                {activity?.summary.total_dns_queries || 0}
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-sm">
              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Active Flows</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {activity?.summary.total_connections || 0}
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-sm">
              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Security Events</div>
              <div className="text-2xl font-bold font-mono text-amber-600 mt-1">
                {activity?.summary.total_security_events || 0}
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-sm">
              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Traffic In / Out</div>
              <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                {((activity?.summary.bytes_uploaded || 0) / 1024).toFixed(1)} KB / {((activity?.summary.bytes_downloaded || 0) / 1024).toFixed(1)} KB
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Destination Domains */}
            <Card title="Top Destination Web &amp; API Domains">
              {!activity || activity.destination_domains.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-500 font-sans">
                  No outgoing domain requests logged yet for this endpoint.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="soc-table">
                    <thead>
                      <tr>
                        <th>Destination Domain</th>
                        <th>Category</th>
                        <th className="text-right">Hit Count</th>
                        <th className="text-right">Last Accessed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.destination_domains.map((dom, idx) => (
                        <tr key={idx}>
                          <td className="font-semibold text-blue-600">{dom.domain}</td>
                          <td className="text-slate-600">{dom.category || 'Web'}</td>
                          <td className="text-right text-slate-800 font-semibold">{dom.count}</td>
                          <td className="text-right text-slate-500 text-[11px]">
                            {new Date(dom.last_accessed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* DNS Queries Log */}
            <Card title="Live DNS Name Resolution Activity">
              {!activity || activity.dns_queries.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-500 font-sans">
                  No DNS resolution records for this endpoint.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="soc-table">
                    <thead>
                      <tr>
                        <th>Queried Name</th>
                        <th>Type</th>
                        <th>Resolved IP</th>
                        <th className="text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.dns_queries.map((dns, idx) => (
                        <tr key={idx}>
                          <td className="text-slate-800 font-medium">{dns.query}</td>
                          <td className="text-indigo-600 font-semibold">{dns.record_type || 'A'}</td>
                          <td className="text-blue-600 font-semibold">{dns.resolved_ip || '—'}</td>
                          <td className="text-right text-slate-500 text-[11px]">
                            {new Date(dns.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Connection Flows Table */}
          <Card title="Recent Active Network Socket Flows">
            {!activity || activity.recent_connections.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500 font-sans">
                No active socket connection telemetry reported.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="soc-table">
                  <thead>
                    <tr>
                      <th>Proto</th>
                      <th>Local Port</th>
                      <th>Destination</th>
                      <th>Status</th>
                      <th>Transfer</th>
                      <th className="text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.recent_connections.map((c, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold text-blue-600">{c.protocol}</td>
                        <td className="text-slate-600">{c.local_port || '—'}</td>
                        <td className="text-slate-800 font-medium">
                          {c.destination_domain ? (
                            <span>{c.destination_domain} ({c.destination_ip}:{c.destination_port})</span>
                          ) : (
                            <span>{c.destination_ip}:{c.destination_port}</span>
                          )}
                        </td>
                        <td>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold font-mono">
                            {c.status || 'ESTABLISHED'}
                          </span>
                        </td>
                        <td className="text-slate-500 text-[11px]">
                          &uarr; {(c.bytes_sent / 1024).toFixed(1)}K &bull; &darr; {(c.bytes_recv / 1024).toFixed(1)}K
                        </td>
                        <td className="text-right text-slate-500 text-[11px]">
                          {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="space-y-6">
          <Card title="Host Resource Utilization Trend" subtitle="CPU, RAM, and Storage telemetry history">
            {formattedHealth.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500 font-sans">
                No historical health agent records yet. Start the host monitoring agent to report metrics.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formattedHealth}>
                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 100]} unit="%" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                      }}
                    />
                    <Line type="monotone" dataKey="cpu" name="CPU (%)" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ram" name="RAM (%)" stroke="#059669" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="disk" name="Disk (%)" stroke="#d97706" strokeWidth={2} dot={false} />
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
            <div className="py-8 text-center text-xs font-mono text-emerald-700 flex items-center justify-center gap-2">
              <CheckCircle2 size={16} />
              <span>Clean Host Posture: No suspicious threat alerts recorded against this asset.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="soc-table">
                <thead>
                  <tr>
                    <th>Alert ID</th>
                    <th>Severity</th>
                    <th>Category</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id}>
                      <td className="font-semibold text-blue-600">{a.alert_id}</td>
                      <td>
                        <Badge variant={a.severity.toLowerCase() as any}>{a.severity}</Badge>
                      </td>
                      <td className="text-slate-600">{a.category}</td>
                      <td className="text-slate-800 font-sans font-medium">{a.title}</td>
                      <td>
                        <Badge variant={a.status === 'NEW' ? 'primary' : 'default'}>{a.status}</Badge>
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/alerts/${a.id}`}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition font-medium text-xs border border-slate-200 inline-flex items-center gap-1 active:scale-[0.99]"
                        >
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
