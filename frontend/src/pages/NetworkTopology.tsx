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
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Network, Server, Shield, Globe, Cpu, RefreshCw, X, ArrowRight, Laptop } from 'lucide-react';

export const NetworkTopology: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const fetchTopology = async () => {
    try {
      const res = await apiClient.get('/topology');
      const apiNodes = res.data.nodes.map((n: any) => ({
        id: n.id,
        type: 'default',
        position: n.position,
        data: {
          ...n.data,
          label: (
            <div className="px-3 py-2 text-center select-none font-mono">
              <div className="text-[10px] font-bold text-cyan-400 uppercase">{n.data.label}</div>
              <div className="text-[9px] text-slate-300">{n.data.ip}</div>
            </div>
          ),
        },
        style: {
          background: n.type === 'firewall' ? '#1e1b4b' : n.type === 'switch' ? '#0f172a' : '#0f1422',
          border: n.type === 'firewall' ? '1px solid #6366f1' : n.type === 'switch' ? '1px solid #38bdf8' : '1px solid #1e293b',
          borderRadius: '10px',
          color: '#f8fafc',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          minWidth: '130px',
        },
      }));

      const apiEdges = res.data.edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: e.animated || true,
        style: { stroke: '#0284c7', strokeWidth: 1.5 },
        labelStyle: { fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' },
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
  }, []);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data);
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
    return <LoadingSpinner message="Mapping Network Segment Architecture..." />;
  }

  return (
    <div className="space-y-4 h-[calc(100vh-7.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <Network className="w-5 h-5 text-cyan-400" />
            <span>INTERACTIVE NETWORK TOPOLOGY MAP</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Multi-VLAN Segment Visualizer (pfSense, VLAN 10 Users, VLAN 20 Servers, VLAN 30 SOC)
          </p>
        </div>
        <div className="flex items-center gap-3">
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
              nodeColor={(n) => (n.type === 'firewall' ? '#6366f1' : '#00f0ff')}
            />
          </ReactFlow>

          {/* Legend Overlay */}
          <div className="absolute top-4 left-4 bg-[#0f1422]/90 border border-[#1e293b] p-3 rounded-lg backdrop-blur-md text-[11px] font-mono space-y-1 z-10">
            <div className="font-bold text-slate-200 uppercase mb-1">VLAN Segments</div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>Perimeter Gateway (pfSense)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              <span>VLAN 10: Users Subnet</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>VLAN 20: Servers Subnet</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>VLAN 30: SOC & Sensor Subnet</span>
            </div>
          </div>
        </div>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="w-80 bg-[#0f1422] border border-[#1e293b] rounded-xl p-5 shadow-2xl flex flex-col justify-between shrink-0 overflow-y-auto animate-fade-in">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <div className="flex items-center gap-2">
                  <Server size={18} className="text-cyan-400" />
                  <span className="font-mono text-xs font-bold text-slate-100 uppercase">
                    Asset Details
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <div className="text-sm font-mono font-bold text-slate-100">{selectedNode.label}</div>
                <div className="text-xs font-mono text-cyan-400 mt-0.5">{selectedNode.ip}</div>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Node Type:</span>
                  <span className="text-slate-200 uppercase">{selectedNode.type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">MAC Address:</span>
                  <span className="text-slate-200">{selectedNode.mac || '52:54:00:12:34:01'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Vendor:</span>
                  <span className="text-slate-200">{selectedNode.vendor || 'Virtual Network Node'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Operating System:</span>
                  <span className="text-slate-200">{selectedNode.os || 'Linux / FreeBSD'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Status:</span>
                  <Badge variant="online">{selectedNode.status || 'ONLINE'}</Badge>
                </div>
              </div>
            </div>

            {selectedNode.id && (
              <div className="pt-4 border-t border-[#1e293b]">
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
