import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { DashboardSummary, Alert, TrafficMetric } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  ShieldAlert,
  Server,
  Flame,
  Ban,
  Activity,
  Radio,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

export const Dashboard: React.FC = () => {
  const { subscribe } = useWebSocket();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [trafficHistory, setTrafficHistory] = useState<any[]>([]);
  const [trafficSummary, setTrafficSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDashboardData = async () => {
    try {
      const [sumRes, alertsRes, trafficRes, trafficSumRes] = await Promise.all([
        apiClient.get('/health/summary'),
        apiClient.get('/alerts?limit=8'),
        apiClient.get('/traffic/metrics?limit=30'),
        apiClient.get('/traffic/summary'),
      ]);

      setSummary(sumRes.data);
      setRecentAlerts(alertsRes.data);
      
      const formattedTraffic = trafficRes.data.map((m: TrafficMetric) => ({
        time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        in_kb: Math.round((m.bytes_in * 8) / 1024),
        out_kb: Math.round((m.bytes_out * 8) / 1024),
        active_flows: m.active_flows,
      }));
      setTrafficHistory(formattedTraffic);
      setTrafficSummary(trafficSumRes.data);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to live WebSocket updates
    const unTraffic = subscribe('traffic', (data) => {
      setTrafficHistory((prev) => {
        const next = [
          ...prev.slice(-29),
          {
            time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            in_kb: data.kbps_in,
            out_kb: data.kbps_out,
            active_flows: data.active_flows,
          },
        ];
        return next;
      });
    });

    const unAlert = subscribe('alert', (alert) => {
      setRecentAlerts((prev) => [alert, ...prev.slice(0, 7)]);
      setSummary((prev) => prev ? { ...prev, active_alerts: prev.active_alerts + 1 } : null);
    });

    const interval = setInterval(fetchDashboardData, 15000);
    return () => {
      unTraffic();
      unAlert();
      clearInterval(interval);
    };
  }, [subscribe]);

  if (isLoading) {
    return <LoadingSpinner message="Connecting to SHALX NETGUARD SOC Engine..." />;
  }

  // Severity Distribution Data
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  recentAlerts.forEach((a) => {
    const s = a.severity as keyof typeof severityCounts;
    if (severityCounts[s] !== undefined) severityCounts[s]++;
  });

  const severityChartData = [
    { name: 'Critical', value: severityCounts.CRITICAL || 1, color: '#f43f5e' },
    { name: 'High', value: severityCounts.HIGH || 2, color: '#f97316' },
    { name: 'Medium', value: severityCounts.MEDIUM || 3, color: '#f59e0b' },
    { name: 'Low', value: severityCounts.LOW || 4, color: '#38bdf8' },
  ];

  // Protocol distribution data
  const protoData = [
    { name: 'TCP', count: trafficSummary?.protocols?.TCP || 24, fill: '#00f0ff' },
    { name: 'UDP', count: trafficSummary?.protocols?.UDP || 12, fill: '#38bdf8' },
    { name: 'ICMP', count: trafficSummary?.protocols?.ICMP || 4, fill: '#10b981' },
    { name: 'Other', count: trafficSummary?.protocols?.OTHER || 2, fill: '#64748b' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>SHALX NETGUARD SECURITY OPERATIONS CENTER</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Intelligent Network Security Monitoring &amp; Response Platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDashboardData}
            icon={<RefreshCw size={13} />}
          >
            Refresh
          </Button>
          <Link to="/topology">
            <Button variant="outline" size="sm" icon={<ExternalLink size={13} />}>
              Live Topology
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="!p-4 border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Monitored Assets</span>
            <Server size={16} className="text-cyan-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100 mt-2">{summary?.total_devices || 0}</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            {summary?.online_devices || 0} Active Online
          </div>
        </Card>

        <Card className="!p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Active Alerts</span>
            <ShieldAlert size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100 mt-2">{summary?.active_alerts || 0}</div>
          <div className="text-[10px] text-rose-400 font-mono mt-1">
            {summary?.critical_alerts || 0} Critical Severity
          </div>
        </Card>

        <Card className="!p-4 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Open Incidents</span>
            <Flame size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100 mt-2">{summary?.open_incidents || 0}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">Under Investigation</div>
        </Card>

        <Card className="!p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Blocked IPs</span>
            <Ban size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100 mt-2">{summary?.blocked_ips_count || 0}</div>
          <div className="text-[10px] text-cyan-400 font-mono mt-1">Firewall Enforced</div>
        </Card>

        <Card className="!p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Bandwidth In</span>
            <ArrowDownLeft size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100 mt-2">
            {summary?.current_bandwidth_in_kbps || 0} <span className="text-xs font-normal text-slate-400">Kbps</span>
          </div>
          <div className="text-[10px] text-emerald-400 font-mono mt-1">Ingress Flow</div>
        </Card>

        <Card className="!p-4 border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Bandwidth Out</span>
            <ArrowUpRight size={16} className="text-sky-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100 mt-2">
            {summary?.current_bandwidth_out_kbps || 0} <span className="text-xs font-normal text-slate-400">Kbps</span>
          </div>
          <div className="text-[10px] text-sky-400 font-mono mt-1">Egress Flow</div>
        </Card>
      </div>

      {/* Subsystem Health Status Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#0f1422] p-4 rounded-xl border border-[#1e293b]">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-mono font-semibold text-slate-200">SURICATA IDS</div>
            <div className="text-[10px] font-mono text-emerald-400">EVE Engine Operational</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-mono font-semibold text-slate-200">pfSense FIREWALL</div>
            <div className="text-[10px] font-mono text-emerald-400">Response Table Active</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-mono font-semibold text-slate-200">ZEEK NETWORK LOGS</div>
            <div className="text-[10px] font-mono text-cyan-400">Collector Standby / Active</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-mono font-semibold text-slate-200">HOST AGENTS</div>
            <div className="text-[10px] font-mono text-emerald-400">Win & Linux Telemetry</div>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Bandwidth Area Chart */}
        <Card
          title="Live Network Traffic Stream"
          subtitle="Real-time aggregate ingress / egress throughput"
          className="lg:col-span-2"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficHistory}>
                <defs>
                  <linearGradient id="inFlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outFlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} unit=" Kb" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0d14',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
                <Area type="monotone" dataKey="in_kb" name="Ingress (Kbps)" stroke="#00f0ff" fillOpacity={1} fill="url(#inFlow)" strokeWidth={2} />
                <Area type="monotone" dataKey="out_kb" name="Egress (Kbps)" stroke="#f43f5e" fillOpacity={1} fill="url(#outFlow)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Severity Distribution Donut Chart */}
        <Card title="Alert Severity Distribution" subtitle="Active threat profile breakdown">
          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {severityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0d14',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-[#1e293b]">
            {severityChartData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-400">{item.name}:</span>
                <span className="font-bold text-slate-200">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Protocol Breakdown & Top Talkers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Protocol Distribution */}
        <Card title="Protocol Distribution" subtitle="Layer 4 packet counts">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={protoData}>
                <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
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

        {/* Top Attacking Sources */}
        <Card title="Top Talker Source IPs" subtitle="Highest bandwidth generating nodes" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-400 border-b border-[#1e293b] pb-2">
                <tr>
                  <th className="pb-2">Source IP</th>
                  <th className="pb-2">Subnet / Location</th>
                  <th className="pb-2 text-right">Bytes Transferred</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {trafficSummary?.top_sources && Object.keys(trafficSummary.top_sources).length > 0 ? (
                  Object.entries(trafficSummary.top_sources).map(([ip, bytes]: [string, any], idx) => (
                    <tr key={idx} className="hover:bg-slate-900/60">
                      <td className="py-2.5 font-semibold text-cyan-400">{ip}</td>
                      <td className="py-2.5 text-slate-400">{ip.startsWith('192.168.10.') ? 'VLAN 10 Users' : ip.startsWith('192.168.20.') ? 'VLAN 20 Servers' : 'Security / External'}</td>
                      <td className="py-2.5 text-right font-medium text-slate-200">{Math.round(bytes / 1024)} KB</td>
                      <td className="py-2.5 text-right">
                        <Link to={`/blocked-ips?target=${ip}`} className="text-rose-400 hover:text-rose-300 font-semibold underline">
                          Block IP
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      Baseline traffic stream active. No anomaly spikes recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Recent High Priority Alerts Table */}
      <Card
        title="Recent Security Alerts & IDS Detections"
        subtitle="Latest events ingested from Suricata EVE JSON and Detection Engine"
        action={
          <Link to="/alerts" className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
            <span>View All Alerts</span>
            <ExternalLink size={12} />
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-[#1e293b]">
              <tr>
                <th className="pb-2.5">Alert ID</th>
                <th className="pb-2.5">Severity</th>
                <th className="pb-2.5">Threat Title</th>
                <th className="pb-2.5">Source IP</th>
                <th className="pb-2.5">Target IP</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-slate-900/60 transition">
                  <td className="py-3 font-semibold text-cyan-400">{alert.alert_id}</td>
                  <td className="py-3">
                    <Badge variant={alert.severity.toLowerCase() as any}>{alert.severity}</Badge>
                  </td>
                  <td className="py-3 font-medium text-slate-200 max-w-xs truncate">{alert.title}</td>
                  <td className="py-3 text-slate-300">{alert.source_ip || 'N/A'}</td>
                  <td className="py-3 text-slate-300">{alert.destination_ip || 'N/A'}:{alert.destination_port || ''}</td>
                  <td className="py-3">
                    <Badge variant={alert.status === 'NEW' ? 'cyan' : 'default'}>{alert.status}</Badge>
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      to={`/alerts/${alert.id}`}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium"
                    >
                      Investigate
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
