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
  Shield,
  LogOut,
  X,
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

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpenMobile, onCloseMobile }) => {
  const { user, logout, canReviewRegistrations } = useAuth();
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

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Top Brand Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Shield size={18} />
          </div>
          <div>
            <div className="font-mono font-bold tracking-tight text-sm text-slate-900 leading-none">
              SHALX <span className="text-blue-600">NETGUARD</span>
            </div>
            <span className="text-[10px] font-sans text-slate-400 font-normal leading-tight">
              Enterprise SOC Platform
            </span>
          </div>
        </div>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="p-3 space-y-4 flex-1 overflow-y-auto">
        {sections.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => !item.reviewerOnly || canReviewRegistrations);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-0.5">
              <h4 className="px-3 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {section.title}
              </h4>
              <div className="space-y-0.5">
                {visibleItems.map((item, iIdx) => (
                  <NavLink
                    key={iIdx}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-2 rounded-xl text-xs transition-all duration-150 active:scale-[0.99] ${
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs shadow-blue-500/20'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-normal'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="shrink-0">{item.icon}</span>
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.path === '/users' && pendingCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-mono font-bold rounded-full">
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

      {/* Footer System Status & Logout */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/60">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-sans font-medium text-slate-700">Target Lab Scope</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-500">192.168.0.0/16</span>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-2xs hover:text-red-600 active:scale-[0.99]"
        >
          <LogOut size={13} />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col h-screen sticky top-0 z-30 hidden lg:flex shrink-0 shadow-[1px_0_3px_rgba(0,0,0,0.02)]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
