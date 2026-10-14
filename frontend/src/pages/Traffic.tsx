import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { TrafficMetric } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  Radio, RefreshCw 
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid 
} from 'recharts';

export const Traffic: React.FC = () => {
  const { subscribe } = useWebSocket();
  const [trafficHistory, setTrafficHistory] = useState<any[]>([]);
  const [summary, setTrafficSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchTrafficData = async () => {
    try {
      const [metricsRes, sumRes] = await Promise.all([
        apiClient.get('/traffic/metrics?limit=40'),
        apiClient.get('/traffic/summary'),
      ]);

      const formatted = metricsRes.data.map((m: TrafficMetric) => ({
        time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        in_kb: Math.round((m.bytes_in * 8) / 1024),
        out_kb: Math.round((m.bytes_out * 8) / 1024),
        pkts_in: m.packets_in,
        pkts_out: m.packets_out,
        flows: m.active_flows,
      }));
      setTrafficHistory(formatted);
      setTrafficSummary(sumRes.data);
    } catch (err) {
      console.error('Traffic fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrafficData();

    const unsubscribe = subscribe('traffic', (data) => {
      setTrafficHistory((prev) => [
        ...prev.slice(-39),
        {
          time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          in_kb: data.kbps_in,
          out_kb: data.kbps_out,
          pkts_in: data.packets_in,
          pkts_out: data.packets_out,
          flows: data.active_flows,
        },
      ]);
    });

    const interval = setInterval(fetchTrafficData, 10000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [subscribe]);

  if (isLoading) {
    return <LoadingSpinner message="Aggregating Flow Telemetry & Bandwidth Metrics..." />;
  }

  const protoData = [
    { name: 'TCP', count: summary?.protocols?.TCP || 0, fill: '#2563eb' },
    { name: 'UDP', count: summary?.protocols?.UDP || 0, fill: '#3b82f6' },
    { name: 'ICMP', count: summary?.protocols?.ICMP || 0, fill: '#10b981' },
    { name: 'Other', count: summary?.protocols?.OTHER || 0, fill: '#94a3b8' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            <span>Network &amp; Assets</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Traffic Telemetry</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-blue-600" />
            <span>Network Traffic Analysis &amp; Bandwidth Ingestion</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchTrafficData} icon={<RefreshCw size={13} />}>
            Refresh Pulse
          </Button>
        </div>
      </div>

      {/* Real-time Bandwidth Chart */}
      <Card title="Bandwidth Ingress / Egress Stream" subtitle="Real-time aggregate throughput (Kbps)">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficHistory}>
              <defs>
                <linearGradient id="trafficIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="trafficOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis stroke="#94a3b8" fontSize={10} unit=" Kb" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
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
              <Area type="monotone" dataKey="in_kb" name="Ingress Bandwidth (Kbps)" stroke="#2563eb" fill="url(#trafficIn)" strokeWidth={2} />
              <Area type="monotone" dataKey="out_kb" name="Egress Bandwidth (Kbps)" stroke="#e11d48" fill="url(#trafficOut)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Packet Rates & Protocol Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Packet Rate Activity" subtitle="Rolling ingress / egress packet volume">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
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
                <Area type="monotone" dataKey="pkts_in" name="Packets In" stroke="#059669" fill="#059669" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="pkts_out" name="Packets Out" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Transport Layer Protocols" subtitle="Protocol distribution from IDS and flows">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={protoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
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
                <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top Talkers Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Top Ingress Talker IPs" subtitle="Highest inbound packet emitters">
          <div className="overflow-x-auto">
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Source IP</th>
                  <th className="text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {summary?.top_sources && Object.keys(summary.top_sources).length > 0 ? (
                  Object.entries(summary.top_sources).map(([ip, bytes]: [string, any], idx) => (
                    <tr key={idx}>
                      <td className="font-semibold text-blue-600">{ip}</td>
                      <td className="text-right font-medium text-slate-800">{Math.round(bytes / 1024)} KB</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-slate-500 font-sans">
                      No active flow deviations
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Top Targeted Destination IPs" subtitle="Highest endpoint traffic sinks">
          <div className="overflow-x-auto">
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Target IP</th>
                  <th className="text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {summary?.top_destinations && Object.keys(summary.top_destinations).length > 0 ? (
                  Object.entries(summary.top_destinations).map(([ip, bytes]: [string, any], idx) => (
                    <tr key={idx}>
                      <td className="font-semibold text-rose-600">{ip}</td>
                      <td className="text-right font-medium text-slate-800">{Math.round(bytes / 1024)} KB</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-slate-500 font-sans">
                      No active flow deviations
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
