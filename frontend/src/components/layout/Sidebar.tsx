import React from 'react';
import { NavLink } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Flame,
  Binary,
  Network,
  Server,
  Radio,
  ShieldCheck,
  Ban,
  FileText,
  BellRing,
  ScrollText,
  Users,
  Sliders,
  Info,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  reviewerOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { isAdmin, canReviewRegistrations } = useAuth();
  const [pendingCount, setPendingCount] = React.useState<number>(0);

  React.useEffect(() => {
    if (!canReviewRegistrations) return;
    const fetchPending = async () => {
      try {
        const res = await apiClient.get('/users/registration-requests/count');
        setPendingCount(res.data?.pending_count || 0);
      } catch (err) {
        // Silently ignore
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, [canReviewRegistrations]);

  const sections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={17} /> },
        { name: 'System Health', path: '/health', icon: <Activity size={17} /> },
      ],
    },
    {
      title: 'Operations',
      items: [
        { name: 'Security Alerts', path: '/alerts', icon: <AlertTriangle size={17} /> },
        { name: 'Incidents', path: '/incidents', icon: <Flame size={17} /> },
        { name: 'Security Events', path: '/events', icon: <Binary size={17} /> },
      ],
    },
    {
      title: 'Network & Assets',
      items: [
        { name: 'Network Topology', path: '/topology', icon: <Network size={17} /> },
        { name: 'Discovered Devices', path: '/devices', icon: <Server size={17} /> },
        { name: 'Traffic Analysis', path: '/traffic', icon: <Radio size={17} /> },
      ],
    },
    {
      title: 'Response & Defense',
      items: [
        { name: 'Firewall Control', path: '/firewall', icon: <ShieldCheck size={17} /> },
        { name: 'Blocked IPs', path: '/blocked-ips', icon: <Ban size={17} /> },
      ],
    },
    {
      title: 'Intelligence & Logs',
      items: [
        { name: 'PDF Reports', path: '/reports', icon: <FileText size={17} /> },
        { name: 'Notifications', path: '/notifications', icon: <BellRing size={17} /> },
        { name: 'Audit Logs', path: '/audit-logs', icon: <ScrollText size={17} /> },
      ],
    },
    {
      title: 'System',
      items: [
        { name: 'User Management', path: '/users', icon: <Users size={17} />, reviewerOnly: true },
        { name: 'Settings', path: '/settings', icon: <Sliders size={17} /> },
        { name: 'About SOC', path: '/about', icon: <Info size={17} /> },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[#0a0d14] border-r border-[#1e293b] flex flex-col h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto z-20">
      <nav className="p-4 space-y-6 flex-1">
        {sections.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => !item.reviewerOnly || canReviewRegistrations);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              <h4 className="px-3 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </h4>
              <div className="space-y-0.5 pt-1">
                {visibleItems.map((item, iIdx) => (
                  <NavLink
                    key={iIdx}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="shrink-0">{item.icon}</span>
                      <span className="truncate font-mono">{item.name}</span>
                    </div>
                    {item.path === '/users' && pendingCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-amber-500 text-black text-[9px] font-mono font-bold rounded-full animate-pulse">
                        {pendingCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-[#1e293b] bg-slate-950/60">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Target Lab</span>
          <span className="text-emerald-400 font-semibold">192.168.0.0/16</span>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
          <span>Engine</span>
          <span className="text-cyan-400 font-semibold">Suricata EVE</span>
        </div>
      </div>
    </aside>
  );
};
