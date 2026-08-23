import React from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Shield, Network, Terminal, FileText, Cpu, CheckCircle2, Flame, Ban, Server } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-cyan-400" />
          <span>ABOUT SHALX NETGUARD SOC PLATFORM</span>
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          Intelligent Network Security Monitoring &amp; Response Platform
        </p>
      </div>

      {/* Overview & Architecture Card */}
      <Card title="Platform Architecture &amp; Objectives">
        <div className="space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
          <p>
            <strong className="text-cyan-400">SHALX NETGUARD</strong> is a production-quality educational mini-SOC platform designed for college capstone demonstrations, laboratory research, and professional portfolio showcases. It aggregates IDS logs, host health telemetry, and flow counters into a centralized event correlation and threat response pipeline.
          </p>

          <div className="bg-[#090d16] p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="text-slate-200 font-bold uppercase mb-1 flex items-center gap-2">
              <Network size={16} className="text-indigo-400" />
              <span>Event Correlation & Response Pipeline</span>
            </div>
            <div className="text-[11px] text-cyan-300">
              Suricata EVE JSON / Host Agents &rarr; Collector Ingest &rarr; Normalizer &rarr; Threat Detection Engine &rarr; Database &rarr; WebSocket Broadcast &rarr; SOC Dashboard &rarr; Analyst Triage &rarr; pfSense Firewall Block
            </div>
          </div>
        </div>
      </Card>

      {/* Technology Stack Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Backend & Security Core">
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Framework:</span>
              <span className="text-slate-200 font-bold">FastAPI (Async Python 3.10+)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">ORM & Database:</span>
              <span className="text-slate-200 font-bold">SQLAlchemy 2.0 (PostgreSQL / SQLite)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">IDS Engine:</span>
              <span className="text-cyan-400 font-bold">Suricata EVE JSON & Zeek</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Firewall Provider:</span>
              <span className="text-indigo-400 font-bold">pfSense REST / XML-RPC + Mock</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Report Engine:</span>
              <span className="text-emerald-400 font-bold">ReportLab PDF Compiler</span>
            </div>
          </div>
        </Card>

        <Card title="Frontend & Visualization">
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">UI Framework:</span>
              <span className="text-slate-200 font-bold">React 18 + TypeScript + Vite</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Styling & Theme:</span>
              <span className="text-slate-200 font-bold">Tailwind CSS (Dark Cyber SOC)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Network Topology:</span>
              <span className="text-cyan-400 font-bold">React Flow Canvas</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Telemetry Charts:</span>
              <span className="text-indigo-400 font-bold">Recharts Data Visualizations</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Real-time Stream:</span>
              <span className="text-emerald-400 font-bold">Native WebSockets (/ws/soc)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Network Lab Architecture */}
      <Card title="Standard Virtualized Network Lab Topology">
        <div className="space-y-3 text-xs font-mono text-slate-300">
          <p>
            SHALX NETGUARD is architected to operate within an isolated 3-VLAN virtualized network environment:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-slate-900 rounded-lg border border-cyan-800/40">
              <div className="font-bold text-cyan-400 mb-1">VLAN 10: USERS</div>
              <div className="text-[11px] text-slate-400 font-mono">
                Subnet: 192.168.10.0/24<br />
                Workstations (Windows 11, Kali Linux Testbox)
              </div>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-emerald-800/40">
              <div className="font-bold text-emerald-400 mb-1">VLAN 20: SERVERS</div>
              <div className="text-[11px] text-slate-400 font-mono">
                Subnet: 192.168.20.0/24<br />
                Production Web &amp; Database Hosts
              </div>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-amber-800/40">
              <div className="font-bold text-amber-400 mb-1">VLAN 30: SECURITY</div>
              <div className="text-[11px] text-slate-400 font-mono">
                Subnet: 192.168.30.0/24<br />
                SHALX NETGUARD SOC Server &amp; Suricata Sensor
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Demonstration Scenarios Checklist */}
      <Card title="Verified Demonstration Scenarios">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 bg-[#090d16] rounded-lg border border-slate-800 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Demo 1 &mdash; Subnet Device Discovery</div>
              <div className="text-[11px] text-slate-400">ARP/ICMP network sweeps detect assets, hostnames, and MAC OUIs.</div>
            </div>
          </div>

          <div className="p-3 bg-[#090d16] rounded-lg border border-slate-800 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Demo 2 &mdash; Port Scan & Threat Detection</div>
              <div className="text-[11px] text-slate-400">Ingestion of Nmap / SYN flood signatures creates instant live SOC alerts.</div>
            </div>
          </div>

          <div className="p-3 bg-[#090d16] rounded-lg border border-slate-800 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Demo 3 &mdash; Firewall Containment</div>
              <div className="text-[11px] text-slate-400">Analyst review initiates pfSense firewall block with allowlist safeguards.</div>
            </div>
          </div>

          <div className="p-3 bg-[#090d16] rounded-lg border border-slate-800 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Demo 4 &mdash; Host Health Telemetry</div>
              <div className="text-[11px] text-slate-400">Authenticated agent reports CPU/RAM spikes and triggers health gauges.</div>
            </div>
          </div>

          <div className="p-3 bg-[#090d16] rounded-lg border border-slate-800 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Demo 5 &mdash; Incident Lifecycle</div>
              <div className="text-[11px] text-slate-400">Alert escalation creates incident case with forensic notes and timeline.</div>
            </div>
          </div>

          <div className="p-3 bg-[#090d16] rounded-lg border border-slate-800 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Demo 6 &mdash; PDF Executive Reporting</div>
              <div className="text-[11px] text-slate-400">Compiles real database data into a publication-ready PDF security posture report.</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
