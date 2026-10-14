import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import apiClient from '../api/client';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { DeviceActivity, TopologySummary } from '../types';
import { 
  Network, Server, Shield, Globe, RefreshCw, X, ArrowRight, 
  Laptop, Smartphone, Monitor, Printer, Router, Tv, HelpCircle, 
  Layers, Eye, EyeOff, Activity, Ban
} from 'lucide-react';

export const NetworkTopology: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'specs' | 'activity'>('specs');
  const [deviceActivity, setDeviceActivity] = useState<DeviceActivity | null>(null);
  const [loadingActivity, setLoadingActivity] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [showOffline, setShowOffline] = useState<boolean>(true);
  const [summary, setSummary] = useState<TopologySummary>({
    total_devices: 0,
    online_devices: 0,
    offline_devices: 0,
  });

  const getDeviceIcon = (type?: string) => {
    const t = (type || 'unknown').toLowerCase();
    switch (t) {
      case 'laptop':
        return <Laptop size={14} className="text-blue-600" />;
      case 'desktop':
      case 'workstation':
        return <Monitor size={14} className="text-slate-600" />;
      case 'mobile':
        return <Smartphone size={14} className="text-emerald-600" />;
      case 'server':
        return <Server size={14} className="text-indigo-600" />;
      case 'router':
        return <Router size={14} className="text-violet-600" />;
      case 'switch':
        return <Network size={14} className="text-blue-600" />;
      case 'firewall':
        return <Shield size={14} className="text-rose-600" />;
      case 'printer':
        return <Printer size={14} className="text-amber-600" />;
      case 'iot':
        return <Tv size={14} className="text-slate-500" />;
      case 'internet':
        return <Globe size={14} className="text-amber-600" />;
      default:
        return <HelpCircle size={14} className="text-slate-400" />;
    }
  };

  const getNodeStyles = (type: string, status: string) => {
    const t = (type || '').toLowerCase();
    const isOffline = status === 'OFFLINE';

    let bg = '#ffffff';
    let border = '1px solid #cbd5e1';

    if (t === 'internet') {
      bg = '#fffbeb';
      border = '1px solid #f59e0b';
    } else if (t === 'firewall') {
      bg = '#fef2f2';
      border = '1px solid #ef4444';
    } else if (t === 'router') {
      bg = '#f5f3ff';
      border = '1px solid #8b5cf6';
    } else if (t === 'switch') {
      bg = '#eff6ff';
      border = '1px solid #3b82f6';
    } else if (t === 'server') {
      bg = '#eef2ff';
      border = '1px solid #6366f1';
    } else if (t === 'laptop' || t === 'desktop' || t === 'workstation') {
      bg = '#ffffff';
      border = '1px solid #94a3b8';
    } else if (t === 'mobile') {
      bg = '#f0fdf4';
      border = '1px solid #10b981';
    }

    if (isOffline) {
      return {
        background: '#f8fafc',
        border: '1px dashed #cbd5e1',
        borderRadius: '6px',
        color: '#94a3b8',
        boxShadow: 'none',
        minWidth: '135px',
        opacity: 0.65,
      };
    }

    return {
      background: bg,
      border: border,
      borderRadius: '6px',
      color: '#0f172a',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      minWidth: '135px',
      opacity: 1,
    };
  };

  const fetchTopology = async () => {
    try {
      const res = await apiClient.get(`/topology?include_offline=${showOffline}`);
      if (res.data.summary) {
        setSummary(res.data.summary);
      }

      const apiNodes = res.data.nodes.map((n: any) => {
        const isOffline = (n.data.status || '').toUpperCase() === 'OFFLINE';
        const nodeType = n.type || n.data.type || 'unknown';

        return {
          id: n.id,
          type: 'default',
          position: n.position,
          data: {
            ...n.data,
            label: (
              <div className="px-2.5 py-1.5 text-center select-none font-mono">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  {getDeviceIcon(nodeType)}
                  <span className={`text-[10px] font-semibold truncate max-w-[110px] ${isOffline ? 'text-slate-400' : 'text-slate-800'}`}>
                    {n.data.label}
                  </span>
                </div>
                <div className="text-[9px] text-slate-500 flex items-center justify-center gap-1">
                  <span className="font-mono">{n.data.ip}</span>
                  {isOffline && (
                    <span className="text-[8px] px-1 bg-red-50 text-red-700 border border-red-200 rounded">
                      OFFLINE
                    </span>
                  )}
                </div>
              </div>
            ),
          },
          style: getNodeStyles(nodeType, n.data.status),
        };
      });

      const apiEdges = res.data.edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: e.animated !== undefined ? e.animated : true,
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        labelStyle: { fill: '#64748b', fontSize: 9, fontFamily: 'monospace' },
      }));

      setNodes(apiNodes);
      setEdges(apiEdges);
    } catch (err) {
      console.error('Error loading network topology:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopology();
  }, [showOffline]);

  const handleNodeClick = async (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data);
    setActiveDrawerTab('specs');
    setDeviceActivity(null);

    if (node.data.id) {
      setLoadingActivity(true);
      try {
        const actRes = await apiClient.get(`/devices/${node.data.id}/activity`);
        setDeviceActivity(actRes.data);
      } catch (e) {
        console.error('Error loading device activity:', e);
      } finally {
        setLoadingActivity(false);
      }
    }
  };

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      await apiClient.post('/devices/scan');
      await fetchTopology();
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Generating Hierarchical Network Topology..." />;
  }

  return (
    <div className="space-y-4 h-[calc(100vh-6.5rem)] flex flex-col">
      {/* Header & Stats Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            <span>Asset Management</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Topology Map</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Network className="w-5 h-5 text-blue-600" />
            <span>Network Topology &amp; Infrastructure Hierarchy</span>
          </h1>
        </div>

        {/* Action Controls & Metric Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Metrics */}
          <div className="flex items-center gap-2.5 font-mono text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Total:</span>
              <span className="font-semibold text-slate-800">{summary.total_devices}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-slate-500">Online:</span>
              <span className="font-semibold text-emerald-700">{summary.online_devices}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="text-slate-500">Offline:</span>
              <span className="font-semibold text-slate-600">{summary.offline_devices}</span>
            </div>
          </div>

          {/* Show/Hide Offline Toggle */}
          <Button
            variant={showOffline ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowOffline(!showOffline)}
            icon={showOffline ? <Eye size={13} /> : <EyeOff size={13} />}
          >
            {showOffline ? 'Showing Offline' : 'Hiding Offline'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRescan}
            isLoading={isScanning}
            icon={<RefreshCw size={13} />}
          >
            Rescan Subnets
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchTopology}
            icon={<RefreshCw size={13} />}
          >
            Reset View
          </Button>
        </div>
      </div>

      {/* Main Canvas & Detail Drawer */}
      <div className="flex-1 flex gap-4 overflow-hidden relative">
        {/* Canvas */}
        <div className="flex-1 bg-slate-50 border border-slate-200/90 rounded-lg overflow-hidden relative shadow-sm">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            attributionPosition="bottom-left"
          >
            <Background color="#cbd5e1" gap={20} size={1} />
            <Controls className="!bg-white !border-slate-200 !fill-slate-700 !shadow-sm" />
            <MiniMap
              className="!bg-white !border-slate-200 !shadow-sm"
              nodeColor={(n) => (n.type === 'firewall' ? '#dc2626' : n.type === 'switch' ? '#2563eb' : '#3b82f6')}
            />
          </ReactFlow>

          {/* Legend Overlay */}
          <div className="absolute top-3 left-3 bg-white/95 border border-slate-200/90 p-3 rounded-lg text-[11px] font-mono space-y-1.5 z-10 shadow-md">
            <div className="font-semibold text-slate-800 uppercase mb-1 flex items-center gap-1.5 text-[10px]">
              <Layers size={12} className="text-blue-600" />
              <span>Hierarchy Legend</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>WAN / Internet</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-violet-600" />
              <span>Gateway / Firewall</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>Subnet / Switch</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>End Hosts</span>
            </div>
          </div>
        </div>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="w-96 bg-white border border-slate-200 rounded-lg p-4 shadow-xl flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-3.5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  {getDeviceIcon(selectedNode.type)}
                  <span className="font-mono text-xs font-semibold text-slate-800 uppercase">
                    Asset Forensics
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Title & IP */}
              <div>
                <div className="text-sm font-mono font-bold text-slate-900 truncate">{selectedNode.label}</div>
                <div className="text-xs font-mono text-blue-600 font-semibold mt-0.5">{selectedNode.ip}</div>
              </div>

              {/* Drawer Navigation Tabs */}
              <div className="flex border-b border-slate-200 gap-4 text-xs font-mono">
                <button
                  onClick={() => setActiveDrawerTab('specs')}
                  className={`pb-1.5 transition border-b-2 font-medium ${
                    activeDrawerTab === 'specs'
                      ? 'border-blue-600 text-blue-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Specifications
                </button>
                <button
                  onClick={() => setActiveDrawerTab('activity')}
                  className={`pb-1.5 transition border-b-2 font-medium flex items-center gap-1.5 ${
                    activeDrawerTab === 'activity'
                      ? 'border-blue-600 text-blue-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Activity size={12} />
                  <span>Network Activity</span>
                </button>
              </div>

              {/* TAB 1: Specifications */}
              {activeDrawerTab === 'specs' && (
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Device Type:</span>
                    <span className="text-blue-600 font-semibold uppercase">{selectedNode.type}</span>
                  </div>
                  {selectedNode.device_type_confidence && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Type Confidence:</span>
                      <span className="text-slate-700">{selectedNode.device_type_confidence}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">MAC Address:</span>
                    <span className="text-slate-700">{selectedNode.mac || 'Not available'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Vendor:</span>
                    <span className="text-slate-700 truncate max-w-[170px]">{selectedNode.vendor || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Operating System:</span>
                    <span className="text-slate-700">{selectedNode.os || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Subnet Segment:</span>
                    <span className="text-slate-700">{selectedNode.subnet || 'Auto-Detected'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">VLAN Segment:</span>
                    <span className="text-slate-700">{selectedNode.vlan || 'VLAN 1 (Default)'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Status:</span>
                    <Badge variant={selectedNode.status === 'ONLINE' ? 'online' : 'critical'}>
                      {selectedNode.status || 'ONLINE'}
                    </Badge>
                  </div>

                  {/* Open Ports & Services Badges */}
                  {selectedNode.open_ports && selectedNode.open_ports.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] text-slate-500 mb-1 font-semibold">Open Ports:</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.open_ports.map((p: number) => (
                          <span key={p} className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded text-[10px] font-semibold">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNode.detected_services && selectedNode.detected_services.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] text-slate-500 mb-1 font-semibold">Detected Services:</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.detected_services.map((s: string) => (
                          <span key={s} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Activity */}
              {activeDrawerTab === 'activity' && (
                <div className="space-y-3 text-xs font-mono">
                  {loadingActivity ? (
                    <div className="py-6 text-center text-slate-500">Loading flow telemetry...</div>
                  ) : !deviceActivity ? (
                    <div className="py-6 text-center text-slate-500">No active traffic reported for this host.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-slate-50 rounded border border-slate-200">
                          <div className="text-[10px] text-slate-500">DNS Requests</div>
                          <div className="text-base font-bold text-blue-600">{deviceActivity.summary.total_dns_queries}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded border border-slate-200">
                          <div className="text-[10px] text-slate-500">Active Flows</div>
                          <div className="text-base font-bold text-emerald-600">{deviceActivity.summary.total_connections}</div>
                        </div>
                      </div>

                      {deviceActivity.destination_domains.length > 0 && (
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Top Visited Domains</div>
                          <div className="space-y-1">
                            {deviceActivity.destination_domains.slice(0, 4).map((d, i) => (
                              <div key={i} className="flex justify-between py-0.5 border-b border-slate-100 text-[11px]">
                                <span className="text-slate-700 truncate max-w-[190px]">{d.domain}</span>
                                <span className="text-slate-500">{d.count}x</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-3 border-t border-slate-200 mt-4 space-y-2">
              {selectedNode.id && (
                <Link to={`/devices/${selectedNode.id}`} className="w-full block">
                  <Button variant="primary" size="sm" className="w-full justify-center" icon={<ArrowRight size={13} />}>
                    Open Host Profile
                  </Button>
                </Link>
              )}
              {selectedNode.ip && (
                <Link to={`/blocked-ips?target=${selectedNode.ip}`} className="w-full block">
                  <Button variant="outline" size="sm" className="w-full justify-center text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" icon={<Ban size={13} />}>
                    Quarantine Host IP
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
