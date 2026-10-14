import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Device } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { 
  Server, Search, RefreshCw, Eye, ShieldCheck, Network,
  Laptop, Smartphone, Monitor, Printer, Router, Tv, HelpCircle
} from 'lucide-react';

export const Devices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      let url = '/devices?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (typeFilter) url += `device_type=${encodeURIComponent(typeFilter)}&`;
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;

      const res = await apiClient.get(url);
      setDevices(res.data);
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [typeFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDevices();
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await apiClient.post('/devices/scan');
      await fetchDevices();
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'laptop':
        return <Laptop size={14} className="text-blue-600" />;
      case 'mobile':
        return <Smartphone size={14} className="text-emerald-600" />;
      case 'desktop':
      case 'workstation':
        return <Monitor size={14} className="text-slate-600" />;
      case 'server':
        return <Server size={14} className="text-indigo-600" />;
      case 'router':
        return <Router size={14} className="text-violet-600" />;
      case 'switch':
        return <Network size={14} className="text-blue-600" />;
      case 'firewall':
        return <ShieldCheck size={14} className="text-rose-600" />;
      case 'printer':
        return <Printer size={14} className="text-amber-600" />;
      case 'iot':
        return <Tv size={14} className="text-slate-500" />;
      default:
        return <HelpCircle size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            <span>Asset Management</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Device Inventory</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Server className="w-5 h-5 text-blue-600" />
            <span>Discovered Network Assets &amp; Host Inventory</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleScan}
            isLoading={isScanning}
            icon={<RefreshCw size={13} />}
          >
            Trigger Subnet Sweep
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchDevices} icon={<RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by hostname, IP address, MAC, or vendor..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded pl-9 pr-3 py-1.5 text-xs text-slate-900 font-mono outline-none transition-colors"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono rounded px-2.5 py-1.5 outline-none focus:border-blue-500"
          >
            <option value="">All Device Types</option>
            <option value="Laptop">Laptop</option>
            <option value="Desktop">Desktop</option>
            <option value="Mobile">Mobile</option>
            <option value="Server">Server</option>
            <option value="Router">Router / Gateway</option>
            <option value="Switch">Switch</option>
            <option value="Firewall">Firewall</option>
            <option value="Printer">Printer</option>
            <option value="IoT">IoT Device</option>
            <option value="Unknown">Unknown</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono rounded px-2.5 py-1.5 outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="WARNING">Warning</option>
          </select>
        </div>
      </div>

      {/* Devices Table */}
      <Card>
        {isLoading ? (
          <LoadingSpinner message="Querying Network Device Inventory..." />
        ) : devices.length === 0 ? (
          <EmptyState
            title="No Network Devices Found"
            description="No devices matched your query or discovery sweep has not been run yet."
            action={
              <Button variant="primary" size="sm" onClick={handleScan}>
                Start Network Discovery Scan
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Hostname / Asset</th>
                  <th>IP Address</th>
                  <th>MAC Address</th>
                  <th>Device Type</th>
                  <th>Vendor / Hardware</th>
                  <th>Subnet / VLAN</th>
                  <th>Operating System</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td className="font-medium text-slate-900 flex items-center gap-2">
                      {getDeviceIcon(device.device_type)}
                      <span className="truncate max-w-[150px] font-sans font-semibold">{device.hostname || 'Unknown'}</span>
                    </td>
                    <td className="font-mono text-blue-600 font-semibold">{device.ip_address}</td>
                    <td className="text-slate-500">{device.mac_address || 'Unknown'}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800 capitalize font-sans">{device.device_type}</span>
                        {device.device_type_confidence && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-medium ${
                            device.device_type_confidence === 'High' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            device.device_type_confidence === 'Medium' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {device.device_type_confidence}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-slate-600 truncate max-w-[140px]">{device.vendor || 'Unknown'}</td>
                    <td className="text-slate-600">
                      <div>{device.subnet || '192.168.1.0/24'}</div>
                      <div className="text-[10px] text-blue-600 font-semibold">{device.vlan || 'VLAN 1'}</div>
                    </td>
                    <td className="text-slate-600 truncate max-w-[120px]">
                      {device.os_type && device.os_type !== 'Unknown' ? `${device.os_type} ${device.os_version || ''}`.trim() : 'Unknown'}
                    </td>
                    <td>
                      <Badge variant={device.status.toLowerCase() as any}>{device.status}</Badge>
                    </td>
                    <td className="text-slate-500 text-[11px]">
                      {new Date(device.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/devices/${device.id}`}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition font-medium text-xs border border-slate-200 inline-flex items-center gap-1 active:scale-[0.99]"
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
