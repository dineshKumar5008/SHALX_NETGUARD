import React from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Shield, Network, Terminal, FileText, Cpu, CheckCircle2, Flame, Ban, Server } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-blue-600" />
          <span>About SHALX NETGUARD Platform</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Enterprise Network Security Operations, Automated Threat Response & Incident Management Architecture
        </p>
      </div>

      {/* Overview & Architecture Card */}
      <Card title="Platform Architecture & Objectives" subtitle="Educational SOC engineering reference implementation">
        <div className="space-y-4 text-xs font-mono text-slate-600 leading-relaxed">
          <p className="font-sans text-xs text-slate-700 leading-relaxed">
            <strong className="text-blue-600 font-mono">SHALX NETGUARD</strong> is a production-engineered network security operations platform designed for security operations centers, laboratory threat research, and automated perimeter containment. It unifies IDS telemetry, host resource counters, and flow forensics into an integrated event correlation and threat response pipeline.
          </p>

          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="text-slate-800 font-semibold uppercase text-[11px] flex items-center gap-2">
              <Network size={15} className="text-blue-600" />
              <span>Event Correlation & Response Pipeline</span>
            </div>
            <div className="text-[11px] text-blue-700 font-mono leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
              Suricata EVE JSON / Host Agents &rarr; Ingestion Collector &rarr; Normalizer &rarr; Threat Detection Engine &rarr; PostgreSQL / Neon &rarr; Native WebSocket Broadcast &rarr; SOC Dashboard &rarr; Analyst Triage &rarr; pfSense Firewall Enforcement
            </div>
          </div>
        </div>
      </Card>

      {/* Technology Stack Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Backend & Security Core" subtitle="High-throughput ingestion & analysis services">
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Framework:</span>
              <span className="text-slate-800 font-semibold">FastAPI (Async Python 3.10+)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-sans">ORM & Database:</span>
              <span className="text-slate-800 font-semibold">SQLAlchemy 2.0 (PostgreSQL / Neon)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-sans">IDS Engine:</span>
              <span className="text-blue-600 font-semibold">Suricata EVE JSON & Zeek</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Firewall Provider:</span>
              <span className="text-indigo-600 font-semibold">pfSense REST / XML-RPC + Mock</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500 font-sans">Report Engine:</span>
              <span className="text-emerald-700 font-semibold">ReportLab PDF Compiler</span>
            </div>
          </div>
        </Card>

        <Card title="Frontend & Visualization" subtitle="Dense analytical user interface">
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-sans">UI Framework:</span>
              <span className="text-slate-800 font-semibold">React 18 + TypeScript + Vite</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Styling & Theme:</span>
              <span className="text-slate-800 font-semibold">Tailwind CSS (Light Enterprise SOC)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Network Topology:</span>
              <span className="text-blue-600 font-semibold">React Flow Canvas</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Telemetry Charts:</span>
              <span className="text-indigo-600 font-semibold">Recharts Visualizations</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500 font-sans">Real-time Stream:</span>
              <span className="text-emerald-700 font-semibold">Native WebSockets (/ws/soc)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Network Lab Architecture */}
      <Card title="Standard Virtualized Lab Topology" subtitle="Isolated VLAN segmentation model">
        <div className="space-y-3.5 text-xs font-mono text-slate-700">
          <p className="font-sans text-xs text-slate-600">
            SHALX NETGUARD operates across a segregated 3-VLAN lab environment:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/80">
              <div className="font-bold text-blue-700 mb-1 text-[11px]">VLAN 10: USERS</div>
              <div className="text-[11px] text-slate-600 font-mono leading-relaxed">
                Subnet: 192.168.10.0/24<br />
                Workstations (Windows 11, Kali Linux Testbox)
              </div>
            </div>
            <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200/80">
              <div className="font-bold text-emerald-700 mb-1 text-[11px]">VLAN 20: SERVERS</div>
              <div className="text-[11px] text-slate-600 font-mono leading-relaxed">
                Subnet: 192.168.20.0/24<br />
                Production Web &amp; Database Hosts
              </div>
            </div>
            <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-200/80">
              <div className="font-bold text-purple-700 mb-1 text-[11px]">VLAN 30: SECURITY</div>
              <div className="text-[11px] text-slate-600 font-mono leading-relaxed">
                Subnet: 192.168.30.0/24<br />
                NETGUARD SOC Server &amp; Suricata Sensor
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Demonstration Scenarios Checklist */}
      <Card title="Verified Verification & Demonstration Scenarios" subtitle="Core operational capabilities tested end-to-end">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/90 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-800">Scenario 1 &mdash; Subnet Asset Discovery</div>
              <div className="text-[11px] text-slate-500 font-sans mt-0.5">ARP sweeps and ICMP scans discover hosts, open ports, and MAC OUIs.</div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/90 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-800">Scenario 2 &mdash; Threat Detection & IDS Ingestion</div>
              <div className="text-[11px] text-slate-500 font-sans mt-0.5">Real-time Suricata EVE signatures generate alerts with MITRE context.</div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/90 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-800">Scenario 3 &mdash; Automated Firewall Containment</div>
              <div className="text-[11px] text-slate-500 font-sans mt-0.5">Analyst triage initiates pfSense perimeter blocks with allowlist protection.</div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/90 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-800">Scenario 4 &mdash; Host Telemetry Monitoring</div>
              <div className="text-[11px] text-slate-500 font-sans mt-0.5">System agents report CPU/RAM telemetry with historical time-series gauges.</div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/90 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-800">Scenario 5 &mdash; Incident Response Case Lifecycle</div>
              <div className="text-[11px] text-slate-500 font-sans mt-0.5">Alert escalation opens incident cases with timeline tracking and forensic notes.</div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/90 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-800">Scenario 6 &mdash; Executive Security Posture Reporting</div>
              <div className="text-[11px] text-slate-500 font-sans mt-0.5">Compiles live security data into formal executive PDF posture reports.</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
