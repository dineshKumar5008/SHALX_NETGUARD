import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge
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
  Layers, Eye, EyeOff, Activity, Wifi, Radio, Lock, HardDrive, CheckCircle2
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
        return <Laptop size={14} className="text-cyan-400" />;
      case 'desktop':
      case 'workstation':
        return <Monitor size={14} className="text-sky-400" />;
      case 'mobile':
        return <Smartphone size={14} className="text-emerald-400" />;
      case 'server':
        return <Server size={14} className="text-indigo-400" />;
      case 'router':
        return <Router size={14} className="text-violet-400" />;
      case 'switch':
        return <Network size={14} className="text-blue-400" />;
      case 'firewall':
        return <Shield size={14} className="text-rose-400" />;
      case 'printer':
        return <Printer size={14} className="text-amber-400" />;
      case 'iot':
        return <Tv size={14} className="text-fuchsia-400" />;
      case 'internet':
        return <Globe size={14} className="text-yellow-400" />;
      default:
        return <HelpCircle size={14} className="text-slate-400" />;
    }
  };

  const getNodeStyles = (type: string, status: string) => {
    const t = (type || '').toLowerCase();
    const isOffline = status === 'OFFLINE';

    let bg = '#0f1422';
    let border = '1px solid #1e293b';

    if (t === 'internet') {
      bg = '#1c1917';
      border = '1px solid #eab308';
    } else if (t === 'firewall') {
      bg = '#2a1215';
      border = '1px solid #f43f5e';
    } else if (t === 'router') {
      bg = '#1e1b4b';
      border = '1px solid #8b5cf6';
    } else if (t === 'switch') {
      bg = '#0f172a';
      border = '1px solid #0284c7';
    } else if (t === 'server') {
      bg = '#111827';
      border = '1px solid #6366f1';
    } else if (t === 'laptop') {
      bg = '#06202a';
      border = '1px solid #06b6d4';
    } else if (t === 'mobile') {
      bg = '#062419';
      border = '1px solid #10b981';
    }

    if (isOffline) {
      return {
        background: '#0d111a',
        border: '1px dashed #475569',
        borderRadius: '10px',
        color: '#64748b',
        boxShadow: 'none',
        minWidth: '135px',
        opacity: 0.55,
      };
    }

    return {
      background: bg,
      border: border,
      borderRadius: '10px',
      color: '#f8fafc',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
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
              <div className="px-3 py-2 text-center select-none font-mono">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  {getDeviceIcon(nodeType)}
                  <span className={`text-[10px] font-bold uppercase truncate max-w-[110px] ${isOffline ? 'text-slate-400' : 'text-cyan-300'}`}>
                    {n.data.label}
                  </span>
                </div>
                <div className="text-[9px] text-slate-300 flex items-center justify-center gap-1">
                  <span>{n.data.ip}</span>
                  {isOffline && (
                    <span className="text-[8px] px-1 bg-red-950/80 text-red-400 border border-red-800/60 rounded">
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
        style: { stroke: '#0284c7', strokeWidth: 1.5 },
        labelStyle: { fill: '#94a3b8', fontSize: 9, fontFamily: 'monospace' },
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
    <div className="space-y-4 h-[calc(100vh-7.5rem)] flex flex-col">
      {/* Header & Stats Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <Network className="w-5 h-5 text-cyan-400" />
            <span>REAL NETWORK TOPOLOGY HIERARCHY</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Gateway &bull; Verified Subnet Segments &bull; Dynamic Discovered Device Inventory
          </p>
        </div>

        {/* Action Controls & Metric Badges */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Metrics */}
          <div className="flex items-center gap-2 font-mono text-xs bg-[#0f1422] border border-[#1e293b] px-3 py-1.5 rounded-lg">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Total:</span>
              <span className="font-bold text-slate-200">{summary.total_devices}</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">Online:</span>
              <span className="font-bold text-emerald-400">{summary.online_devices}</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span className="text-slate-400">Offline:</span>
              <span className="font-bold text-slate-400">{summary.offline_devices}</span>
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
        <div className="flex-1 bg-[#090d16] border border-[#1e293b] rounded-xl overflow-hidden shadow-2xl relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            attributionPosition="bottom-left"
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls className="!bg-[#0f1422] !border-[#1e293b] !fill-slate-200" />
            <MiniMap
              className="!bg-[#0f1422] !border-[#1e293b]"
              nodeColor={(n) => (n.type === 'firewall' ? '#f43f5e' : n.type === 'switch' ? '#0284c7' : '#00f0ff')}
            />
          </ReactFlow>

          {/* Legend Overlay */}
          <div className="absolute top-4 left-4 bg-[#0f1422]/95 border border-[#1e293b] p-3 rounded-lg backdrop-blur-md text-[11px] font-mono space-y-1.5 z-10 shadow-xl">
            <div className="font-bold text-slate-200 uppercase mb-1 flex items-center gap-1.5">
              <Layers size={13} className="text-cyan-400" />
              <span>Network Hierarchy</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span>WAN Uplink (Internet)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span>Perimeter Gateway / Router</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              <span>Subnet / VLAN Hub</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Discovered Endpoints</span>
            </div>
          </div>
        </div>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="w-96 bg-[#0f1422] border border-[#1e293b] rounded-xl p-4 shadow-2xl flex flex-col justify-between shrink-0 overflow-y-auto animate-fade-in">
            <div className="space-y-3.5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <div className="flex items-center gap-2">
                  {getDeviceIcon(selectedNode.type)}
                  <span className="font-mono text-xs font-bold text-slate-100 uppercase">
                    Asset Forensics
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Title & IP */}
              <div>
                <div className="text-sm font-mono font-bold text-slate-100 truncate">{selectedNode.label}</div>
                <div className="text-xs font-mono text-cyan-400 mt-0.5">{selectedNode.ip}</div>
              </div>

              {/* Drawer Navigation Tabs */}
              <div className="flex border-b border-[#1e293b] gap-4 text-xs font-mono">
                <button
                  onClick={() => setActiveDrawerTab('specs')}
                  className={`pb-2 transition border-b-2 font-medium ${
                    activeDrawerTab === 'specs'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Specifications
                </button>
                <button
                  onClick={() => setActiveDrawerTab('activity')}
                  className={`pb-2 transition border-b-2 font-medium flex items-center gap-1.5 ${
                    activeDrawerTab === 'activity'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity size={12} />
                  <span>Network Activity</span>
                </button>
              </div>

              {/* TAB 1: Specifications */}
              {activeDrawerTab === 'specs' && (
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Device Type:</span>
                    <span className="text-cyan-400 font-bold uppercase">{selectedNode.type}</span>
                  </div>
                  {selectedNode.device_type_confidence && (
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Type Confidence:</span>
                      <span className="text-slate-200">{selectedNode.device_type_confidence}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">MAC Address:</span>
                    <span className="text-slate-200">{selectedNode.mac || 'Not available'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Vendor:</span>
                    <span className="text-slate-200 truncate max-w-[170px]">{selectedNode.vendor || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Operating System:</span>
                    <span className="text-slate-200">{selectedNode.os || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Subnet Segment:</span>
                    <span className="text-slate-200">{selectedNode.subnet || 'Auto-Detected'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">VLAN Segment:</span>
                    <span className="text-slate-200">{selectedNode.vlan || 'VLAN 1 (Default)'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Status:</span>
                    <Badge variant={selectedNode.status === 'ONLINE' ? 'online' : 'critical'}>
                      {selectedNode.status || 'ONLINE'}
                    </Badge>
                  </div>

                  {/* Open Ports & Services Badges */}
                  {selectedNode.open_ports && selectedNode.open_ports.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] text-slate-400 mb-1">Open Ports:</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.open_ports.map((p: number) => (
                          <span key={p} className="px-1.5 py-0.5 bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 rounded text-[10px]">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNode.detected_services && selectedNode.detected_services.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] text-slate-400 mb-1">Detected Services:</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.detected_services.map((s: string) => (
                          <span key={s} className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded text-[10px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Network Activity & Forensics */}
              {activeDrawerTab === 'activity' && (
                <div className="space-y-3 text-xs font-mono">
                  {loadingActivity ? (
                    <div className="py-8 text-center text-slate-400">Loading live endpoint activity...</div>
                  ) : deviceActivity ? (
                    <div className="space-y-3">
                      {/* Activity Summary Counters */}
                      <div className="grid grid-cols-2 gap-2 bg-[#0a0d14] p-2.5 rounded-lg border border-slate-800">
                        <div>
                          <div className="text-[10px] text-slate-400">DNS Queries</div>
                          <div className="text-sm font-bold text-cyan-400">{deviceActivity.summary.total_dns_queries}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Active Flows</div>
                          <div className="text-sm font-bold text-emerald-400">{deviceActivity.summary.total_connections}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">IDS Events</div>
                          <div className="text-sm font-bold text-amber-400">{deviceActivity.summary.total_security_events}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Traffic In/Out</div>
                          <div className="text-[11px] font-bold text-slate-300 truncate">
                            {(deviceActivity.summary.bytes_uploaded / 1024).toFixed(1)}K / {(deviceActivity.summary.bytes_downloaded / 1024).toFixed(1)}K
                          </div>
                        </div>
                      </div>

                      {/* Top Destination Domains */}
                      {deviceActivity.destination_domains.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-slate-300 mb-1.5">Destination Domains:</div>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {deviceActivity.destination_domains.slice(0, 5).map((d, i) => (
                              <div key={i} className="flex justify-between items-center py-1 px-1.5 bg-slate-900/60 rounded border border-slate-800/60 text-[10px]">
                                <span className="text-cyan-300 truncate max-w-[180px]">{d.domain}</span>
                                <span className="text-slate-400 font-bold">{d.count}x</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* DNS Queries */}
                      {deviceActivity.dns_queries.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-slate-300 mb-1.5">Recent DNS Queries:</div>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {deviceActivity.dns_queries.slice(0, 5).map((q, i) => (
                              <div key={i} className="flex justify-between items-center py-1 px-1.5 bg-slate-900/60 rounded border border-slate-800/60 text-[10px]">
                                <span className="text-slate-200 truncate max-w-[170px]">{q.query}</span>
                                <span className="text-slate-400 text-[9px]">
                                  {new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Connection Flows */}
                      {deviceActivity.recent_connections.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-slate-300 mb-1.5">Active Socket Flows:</div>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {deviceActivity.recent_connections.slice(0, 5).map((f, i) => (
                              <div key={i} className="flex justify-between items-center py-1 px-1.5 bg-slate-900/60 rounded border border-slate-800/60 text-[10px]">
                                <span className="text-slate-300 truncate">
                                  {f.protocol} &rarr; {f.destination_ip}:{f.destination_port}
                                </span>
                                <span className="text-emerald-400 text-[9px]">{f.status || 'ACTIVE'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400">
                      No network traffic recorded for this node yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Deep Dive Action Button */}
            {selectedNode.id && (
              <div className="pt-3 border-t border-[#1e293b]">
                <Link to={`/devices/${selectedNode.id}`} className="block w-full">
                  <Button variant="primary" size="sm" className="w-full" icon={<ArrowRight size={14} />}>
                    Open Device Deep Dive
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

