import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Device } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Server, Search, Filter, RefreshCw, Eye, ShieldCheck, Laptop, Router, HardDrive } from 'lucide-react';

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
    switch (type.toLowerCase()) {
      case 'server':
        return <Server size={15} className="text-cyan-400" />;
      case 'firewall':
      case 'router':
        return <Router size={15} className="text-indigo-400" />;
      case 'workstation':
        return <Laptop size={15} className="text-emerald-400" />;
      default:
        return <HardDrive size={15} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <Server className="w-5 h-5 text-cyan-400" />
            <span>DISCOVERED NETWORK ASSETS & HOST INVENTORY</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time ARP/ICMP Monitored Infrastructure across Monitored Subnets
          </p>
        </div>
        <div className="flex items-center gap-3">
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
      <div className="bg-[#0f1422] p-4 rounded-xl border border-[#1e293b] flex flex-wrap gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by hostname, IP address, MAC, or vendor..."
            className="w-full bg-[#0a0d14] border border-[#1e293b] focus:border-cyan-500 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-100 font-mono outline-none"
          />
        </form>

        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#0a0d14] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none"
          >
            <option value="">All Asset Types</option>
            <option value="server">Servers</option>
            <option value="workstation">Workstations</option>
            <option value="firewall">Firewalls & Gateways</option>
            <option value="soc">SOC Sensors</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0a0d14] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none"
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
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-400 border-b border-[#1e293b]">
                <tr>
                  <th className="pb-3">Hostname / Asset</th>
                  <th className="pb-3">IP Address</th>
                  <th className="pb-3">MAC Address</th>
                  <th className="pb-3">Vendor / Platform</th>
                  <th className="pb-3">Operating System</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Last Seen</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-slate-100 flex items-center gap-2">
                      {getDeviceIcon(device.device_type)}
                      <span>{device.hostname || 'Unnamed Host'}</span>
                    </td>
                    <td className="py-3 font-mono text-cyan-400">{device.ip_address}</td>
                    <td className="py-3 text-slate-400">{device.mac_address || '52:54:00:12:34:01'}</td>
                    <td className="py-3 text-slate-300">{device.vendor || 'Generic Device'}</td>
                    <td className="py-3 text-slate-300">
                      {device.os_type} {device.os_version || ''}
                    </td>
                    <td className="py-3">
                      <Badge variant={device.status.toLowerCase() as any}>{device.status}</Badge>
                    </td>
                    <td className="py-3 text-slate-400">
                      {new Date(device.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/devices/${device.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium"
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
