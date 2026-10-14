import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useWebSocket } from '../../context/WebSocketContext';
import { X, ShieldAlert } from 'lucide-react';
import { Alert } from '../../types';

export const Layout: React.FC = () => {
  const { latestAlert } = useWebSocket();
  const [activeAlertToast, setActiveAlertToast] = useState<Alert | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    if (latestAlert && (latestAlert.severity === 'CRITICAL' || latestAlert.severity === 'HIGH')) {
      setActiveAlertToast(latestAlert);
      const timer = setTimeout(() => {
        setActiveAlertToast(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [latestAlert]);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900 flex flex-row">
      {/* Sidebar: persistent on desktop, responsive drawer on mobile */}
      <Sidebar isOpenMobile={isMobileOpen} onCloseMobile={() => setIsMobileOpen(false)} />

      {/* Main Content Area Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <Navbar onToggleMobileSidebar={() => setIsMobileOpen((prev) => !prev)} />

        {/* Real-time Enterprise Incident Banner (Clean, High-Contrast) */}
        {activeAlertToast && (
          <div
            role="alert"
            className="bg-red-50 border-b border-red-200 px-5 sm:px-6 py-2.5 flex items-center justify-between z-20 sticky top-0 shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-6 h-6 rounded bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              </div>
              <div className="truncate">
                <span className="font-mono text-[11px] font-bold text-red-800 mr-2 uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 border border-red-200">
                  {activeAlertToast.severity}
                </span>
                <span className="text-xs text-slate-900 font-medium">
                  {activeAlertToast.title}
                </span>
                <span className="text-xs font-mono text-slate-500 ml-2 hidden md:inline">
                  ({activeAlertToast.source_ip} &rarr; {activeAlertToast.destination_ip})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <Link
                to={`/alerts/${activeAlertToast.id || ''}`}
                className="text-xs font-mono bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg transition font-medium shadow-sm active:scale-[0.99]"
              >
                Triage Incident
              </Link>
              <button
                onClick={() => setActiveAlertToast(null)}
                aria-label="Dismiss alert"
                className="text-slate-400 hover:text-slate-600 p-1 rounded transition"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Main Routed Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1720px] w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
