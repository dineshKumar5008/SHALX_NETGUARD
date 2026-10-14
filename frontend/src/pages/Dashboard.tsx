import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { DashboardSummary, Alert, Device } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  ShieldAlert,
  Server,
  Flame,
  Ban,
  Activity,
  RefreshCw,
  Search,
  Filter,
  Download,
  Play,
  ArrowRight,
  Shield,
  CheckCircle2,
  Clock,
  ChevronDown,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { subscribe } = useWebSocket();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Table filter states
  const [tableSearch, setTableSearch] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const fetchDashboardData = async () => {
    try {
      const [sumRes, alertsRes, devRes] = await Promise.all([
        apiClient.get('/health/summary'),
        apiClient.get('/alerts?limit=50'),
        apiClient.get('/devices?limit=50'),
      ]);

      setSummary(sumRes.data);
      setAlerts(alertsRes.data || []);
      setDevices(devRes.data || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to live WebSocket alerts
    const unAlert = subscribe('alert', (alert) => {
      setAlerts((prev) => [alert, ...prev]);
      setSummary((prev) => {
        if (!prev) return null;
        const rawSev = (alert.severity || '').toUpperCase();
        const sevKey = rawSev in { CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 1 }
          ? (rawSev as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')
          : null;
        const currentDist = prev.severity_distribution || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        const updatedDist = sevKey
          ? { ...currentDist, [sevKey]: (currentDist[sevKey] || 0) + 1 }
          : currentDist;
        return {
          ...prev,
          active_alerts: prev.active_alerts + 1,
          critical_alerts: sevKey === 'CRITICAL' ? prev.critical_alerts + 1 : prev.critical_alerts,
          severity_distribution: updatedDist,
        };
      });
    });

    const interval = setInterval(fetchDashboardData, 15000);
    return () => {
      unAlert();
      clearInterval(interval);
    };
  }, [subscribe]);

  const handleRunScan = async () => {
    setIsScanning(true);
    setScanMessage(null);
    try {
      await apiClient.post('/devices/scan', { subnet: '192.168.10.0/24' });
      setScanMessage('ARP & ICMP subnet discovery initiated.');
      fetchDashboardData();
      setTimeout(() => setScanMessage(null), 4000);
    } catch (err: any) {
      setScanMessage(err.response?.data?.detail || 'Scan dispatched to background worker.');
      setTimeout(() => setScanMessage(null), 4000);
    } finally {
      setIsScanning(false);
    }
  };

  // Helper for human-readable relative time
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Calculate Findings by Severity from real summary / alerts
  const severityBreakdown = useMemo(() => {
    const counts = {
      CRITICAL: summary?.severity_distribution?.CRITICAL ?? alerts.filter((a) => a.severity === 'CRITICAL').length,
      HIGH: summary?.severity_distribution?.HIGH ?? alerts.filter((a) => a.severity === 'HIGH').length,
      MEDIUM: summary?.severity_distribution?.MEDIUM ?? alerts.filter((a) => a.severity === 'MEDIUM').length,
      LOW: summary?.severity_distribution?.LOW ?? alerts.filter((a) => a.severity === 'LOW').length,
    };
    const total = counts.CRITICAL + counts.HIGH + counts.MEDIUM + counts.LOW;

    return [
      { name: 'Critical', value: counts.CRITICAL, color: '#dc2626', percent: total > 0 ? Math.round((counts.CRITICAL / total) * 100) : 0 },
      { name: 'High', value: counts.HIGH, color: '#ea580c', percent: total > 0 ? Math.round((counts.HIGH / total) * 100) : 0 },
      { name: 'Medium', value: counts.MEDIUM, color: '#d97706', percent: total > 0 ? Math.round((counts.MEDIUM / total) * 100) : 0 },
      { name: 'Low', value: counts.LOW, color: '#2563eb', percent: total > 0 ? Math.round((counts.LOW / total) * 100) : 0 },
    ];
  }, [summary, alerts]);

  const totalFindingsCount = useMemo(() => {
    return severityBreakdown.reduce((sum, item) => sum + item.value, 0);
  }, [severityBreakdown]);

  // Visual pie data
  const pieData = useMemo(() => {
    if (totalFindingsCount === 0) {
      return [{ name: 'No Active Threats', value: 1, color: '#e2e8f0' }];
    }
    return severityBreakdown.filter((item) => item.value > 0);
  }, [severityBreakdown, totalFindingsCount]);

  // Calculate Findings by Asset from real alerts & devices
  const { assetChartData, topAssetsWithFindings } = useMemo(() => {
    const assetMap: { [key: string]: { name: string; count: number; criticalCount: number } } = {};

    // Seed with discovered devices
    devices.slice(0, 8).forEach((d) => {
      const label = d.hostname || d.ip_address;
      assetMap[label] = { name: label, count: 0, criticalCount: 0 };
    });

    // Aggregate alert counts per asset
    alerts.forEach((alert) => {
      const ip = alert.destination_ip || alert.source_ip || 'Unknown';
      const matched = devices.find((d) => d.ip_address === ip);
      const label = matched?.hostname || ip;
      if (!assetMap[label]) {
        assetMap[label] = { name: label, count: 0, criticalCount: 0 };
      }
      assetMap[label].count += 1;
      if (alert.severity === 'CRITICAL') {
        assetMap[label].criticalCount += 1;
      }
    });

    const sorted = Object.values(assetMap).sort((a, b) => b.count - a.count);

    const chartData = sorted.slice(0, 5).map((item) => ({
      name: item.name.length > 14 ? item.name.substring(0, 12) + '..' : item.name,
      fullName: item.name,
      findings: item.count,
      criticalCount: item.criticalCount,
      fill: item.criticalCount > 0 ? '#dc2626' : '#2563eb',
    }));

    return { assetChartData: chartData, topAssetsWithFindings: sorted.slice(0, 4) };
  }, [alerts, devices]);

  // Filtered Findings Table
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSearch =
        tableSearch === '' ||
        alert.title.toLowerCase().includes(tableSearch.toLowerCase()) ||
        (alert.destination_ip || '').includes(tableSearch) ||
        (alert.source_ip || '').includes(tableSearch) ||
        alert.alert_id.toLowerCase().includes(tableSearch.toLowerCase());

      const matchesSeverity =
        severityFilter === 'ALL' || alert.severity.toUpperCase() === severityFilter;

      return matchesSearch && matchesSeverity;
    });
  }, [alerts, tableSearch, severityFilter]);

  // Top Critical Findings list
  const topCriticalAlerts = useMemo(() => {
    return alerts
      .filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH')
      .slice(0, 3);
  }, [alerts]);

  if (isLoading) {
    return <LoadingSpinner message="Connecting to SHALX NETGUARD SOC Engine..." />;
  }

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* 4.A PAGE HEADER (GuardX layout)                                     */}
      {/* =================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Security Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            Overview of all security findings across all assets
          </p>
        </div>

        {/* Action Buttons: Run Scan, Export, Filter */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {scanMessage && (
            <span className="text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
              {scanMessage}
            </span>
          )}

          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Play size={13} className={isScanning ? 'animate-spin' : ''} />
            <span>{isScanning ? 'Scanning Subnet...' : 'Run Scan'}</span>
          </button>

          <Link
            to="/reports"
            className="bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-medium shadow-2xs flex items-center gap-1.5 transition"
          >
            <Download size={13} />
            <span>Export</span>
          </Link>

          <button
            onClick={fetchDashboardData}
            className="bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-medium shadow-2xs flex items-center gap-1.5 transition"
            title="Refresh operational telemetry"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4.B COMPACT SUMMARY METRICS ROW (4 Cards matching GuardX)            */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Findings */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Findings</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Shield size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold font-sans text-slate-900 mt-2">
            {totalFindingsCount || summary?.total_devices || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-normal">
            Across all monitored assets
          </p>
        </div>

        {/* Card 2: Critical Issues */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Critical Issues</span>
            <div className="w-8 h-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold font-sans text-slate-900 mt-2">
            {summary?.critical_alerts ?? severityBreakdown[0].value}
          </div>
          <p className="text-[11px] text-red-600 font-normal mt-1">
            Require Immediate Action
          </p>
        </div>

        {/* Card 3: Active Threats / Open Incidents */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Alerts</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold font-sans text-slate-900 mt-2">
            {summary?.active_alerts || alerts.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-normal">
            Under active SOC triage
          </p>
        </div>

        {/* Card 4: Perimeter Blocks */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Blocked Threats</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Ban size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold font-sans text-slate-900 mt-2">
            {summary?.blocked_ips_count ?? 0}
          </div>
          <p className="text-[11px] text-emerald-600 font-normal mt-1 flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>Enforced by firewall</span>
          </p>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4.C CHARTS AND ANALYTICS (GuardX 2-Card Layout)                     */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Findings by Severity */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Findings by Severity
            </h3>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      const item = severityBreakdown.find((s) => s.name === data.name);
                      return (
                        <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs shadow-md">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload?.color }} />
                            <span className="font-semibold text-slate-800">{data.name}:</span>
                            <span className="font-bold text-slate-900">{data.value} ({item?.percent || 0}%)</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Severity Dots Legend (matching GuardX) */}
          <div className="flex items-center justify-center gap-5 pt-3 border-t border-slate-100 flex-wrap">
            {severityBreakdown.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 font-medium">{item.name}</span>
                <span className="text-slate-400 font-normal">({item.percent}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Findings by Asset */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Findings by Asset
            </h3>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assetChartData} barSize={36}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs shadow-md space-y-1">
                          <div className="font-bold text-slate-900">{data.fullName}</div>
                          <div className="text-slate-600 flex justify-between gap-4">
                            <span>Findings:</span>
                            <span className="font-semibold text-blue-600">{data.findings}</span>
                          </div>
                          {data.criticalCount > 0 && (
                            <div className="text-red-600 flex justify-between gap-4 font-semibold">
                              <span>Critical Count:</span>
                              <span>{data.criticalCount}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="findings" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-center pt-3 border-t border-slate-100 text-xs text-slate-400">
            Top network nodes ranked by active security findings and IDS detections
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4.D MAIN OPERATIONAL TABLE: SECURITY FINDINGS                       */}
      {/* =================================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        {/* Table Header with Search and Severity Filter (GuardX style) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Security Findings
          </h3>

          <div className="flex items-center gap-3">
            {/* Search findings */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search findings..."
                className="bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition w-44 sm:w-56"
              />
            </div>

            {/* Severity Filter Dropdown */}
            <div className="relative">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer shadow-2xs pr-7 appearance-none"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical Only</option>
                <option value="HIGH">High Only</option>
                <option value="MEDIUM">Medium Only</option>
                <option value="LOW">Low Only</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[11px] font-semibold tracking-wider">
                <th className="pb-3 px-3">Asset</th>
                <th className="pb-3 px-3">Finding</th>
                <th className="pb-3 px-3">Severity</th>
                <th className="pb-3 px-3">Discovered</th>
                <th className="pb-3 px-3 text-right">Action / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.slice(0, 7).map((alert) => {
                  const targetIp = alert.destination_ip || alert.source_ip || '192.168.10.1';
                  const matchedDev = devices.find((d) => d.ip_address === targetIp);
                  const assetName = matchedDev?.hostname || targetIp;

                  return (
                    <tr key={alert.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Asset */}
                      <td className="py-3 px-3 font-semibold text-slate-900 font-sans">
                        <div>{assetName}</div>
                        <div className="text-[11px] font-mono text-slate-400 font-normal">{targetIp}</div>
                      </td>

                      {/* Finding Title & Description */}
                      <td className="py-3 px-3 max-w-md">
                        <div className="font-semibold text-slate-800 line-clamp-1">{alert.title}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {alert.description || alert.signature || 'IDS signature alert generated by telemetry stream.'}
                        </div>
                      </td>

                      {/* Severity Pill */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${
                            alert.severity === 'CRITICAL'
                              ? 'bg-red-500 text-white'
                              : alert.severity === 'HIGH'
                              ? 'bg-orange-500 text-white'
                              : alert.severity === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-500 text-white'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </td>

                      {/* Discovered Timestamp */}
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {formatRelativeTime(alert.created_at)}
                      </td>

                      {/* Action & Status Pill */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/alerts/${alert.id}`}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
                          >
                            Investigate
                          </Link>

                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                              alert.status === 'RESOLVED'
                                ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                                : alert.status === 'INVESTIGATING' || alert.status === 'ACKNOWLEDGED'
                                ? 'border-blue-300 text-blue-700 bg-blue-50'
                                : 'border-red-300 text-red-700 bg-red-50'
                            }`}
                          >
                            {alert.status === 'NEW' ? 'Open' : alert.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs">
                    No security findings matching the current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {Math.min(filteredAlerts.length, 7)} of {filteredAlerts.length} total findings</span>
          <Link to="/alerts" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline">
            <span>View All Findings</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4.E SECONDARY INFORMATION PANELS (GuardX Bottom Grid)               */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Assets with Most Findings */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Assets with Most Findings
            </h3>
            <Link to="/devices" className="text-xs text-blue-600 hover:underline font-medium">
              View All Assets
            </Link>
          </div>

          <div className="space-y-4">
            {topAssetsWithFindings.length > 0 ? (
              topAssetsWithFindings.map((asset, idx) => {
                const maxCount = Math.max(...topAssetsWithFindings.map((a) => a.count), 1);
                const percent = Math.round((asset.count / maxCount) * 100);

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{asset.name}</span>
                      <span className="font-bold text-slate-900">{asset.count}</span>
                    </div>
                    {/* Proportional Progress Bar (GuardX blue bar) */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">
                All discovered assets currently clean and healthy.
              </p>
            )}
          </div>
        </div>

        {/* Panel 2: Top Critical Findings */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Top Critical Findings
            </h3>
            <Link to="/alerts?severity=CRITICAL" className="text-xs text-red-600 hover:underline font-medium">
              View All Critical
            </Link>
          </div>

          <div className="space-y-3.5">
            {topCriticalAlerts.length > 0 ? (
              topCriticalAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold text-xs text-slate-900 line-clamp-1">
                      {alert.title}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">
                      {alert.description || alert.signature || 'IDS alert triggered on active traffic flow.'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Target: {alert.destination_ip || 'Local Node'} &bull; {formatRelativeTime(alert.created_at)}
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white shrink-0 uppercase tracking-wider">
                    Critical
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1.5 opacity-80" />
                <p className="font-semibold text-slate-700">No Critical Vulnerabilities</p>
                <p className="text-[11px] text-slate-400 mt-0.5">All monitored assets are operating within nominal thresholds.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
