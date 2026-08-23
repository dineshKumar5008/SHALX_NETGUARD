import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { TrafficMetric } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  Radio, RefreshCw, ArrowDownLeft, ArrowUpRight, Activity, Network, Layers, BarChart3 
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Legend, CartesianGrid 
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
    { name: 'TCP', count: summary?.protocols?.TCP || 0, fill: '#00f0ff' },
    { name: 'UDP', count: summary?.protocols?.UDP || 0, fill: '#38bdf8' },
    { name: 'ICMP', count: summary?.protocols?.ICMP || 0, fill: '#10b981' },
    { name: 'Other', count: summary?.protocols?.OTHER || 0, fill: '#64748b' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-cyan-400" />
            <span>REAL-TIME TRAFFIC FLOW & BANDWIDTH ANALYZER</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Subnet Flow Metering, Layer 4 Distribution, and Top Talker Matrix
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={fetchTrafficData} icon={<RefreshCw size={13} />}>
            Refresh Pulse
          </Button>
        </div>
      </div>

      {/* Real-time Bandwidth Chart */}
      <Card title="Bandwidth Ingress / Egress Stream (Kbps)" subtitle="Real-time rolling telemetry">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficHistory}>
              <defs>
                <linearGradient id="trafficIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="trafficOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#475569" fontSize={10} />
              <YAxis stroke="#475569" fontSize={10} unit=" Kb" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0d14',
                  borderColor: '#1e293b',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              />
              <Area type="monotone" dataKey="in_kb" name="Ingress Bandwidth (Kbps)" stroke="#00f0ff" fill="url(#trafficIn)" strokeWidth={2} />
              <Area type="monotone" dataKey="out_kb" name="Egress Bandwidth (Kbps)" stroke="#f43f5e" fill="url(#trafficOut)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Packet Rates & Protocol Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Packet Rate Activity (Packets / Second)" subtitle="Rolling packet counters">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={10} />
                <YAxis stroke="#475569" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0d14',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Area type="monotone" dataKey="pkts_in" name="Packets In" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={1.5} />
                <Area type="monotone" dataKey="pkts_out" name="Packets Out" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Transport Layer Protocols" subtitle="Protocol distribution from IDS and flows">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={protoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#475569" fontSize={10} />
                <YAxis stroke="#475569" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0d14',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Bar dataKey="count" fill="#00f0ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top Talkers Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Top Ingress Talker IPs">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-[#1e293b]">
              <tr>
                <th className="pb-2">Source IP</th>
                <th className="pb-2 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {summary?.top_sources && Object.keys(summary.top_sources).length > 0 ? (
                Object.entries(summary.top_sources).map(([ip, bytes]: [string, any], idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 font-bold text-cyan-400">{ip}</td>
                    <td className="py-2.5 text-right font-medium text-slate-200">{Math.round(bytes / 1024)} KB</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-slate-500">
                    No active flow deviations
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title="Top Targeted Destination IPs">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-[#1e293b]">
              <tr>
                <th className="pb-2">Target IP</th>
                <th className="pb-2 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {summary?.top_destinations && Object.keys(summary.top_destinations).length > 0 ? (
                Object.entries(summary.top_destinations).map(([ip, bytes]: [string, any], idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 font-bold text-rose-400">{ip}</td>
                    <td className="py-2.5 text-right font-medium text-slate-200">{Math.round(bytes / 1024)} KB</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-slate-500">
                    No active flow deviations
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};
