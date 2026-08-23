import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useWebSocket } from '../../context/WebSocketContext';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { Alert } from '../../types';

export const Layout: React.FC = () => {
  const { latestAlert } = useWebSocket();
  const [activeAlertToast, setActiveAlertToast] = useState<Alert | null>(null);

  useEffect(() => {
    if (latestAlert && (latestAlert.severity === 'CRITICAL' || latestAlert.severity === 'HIGH')) {
      setActiveAlertToast(latestAlert);
      const timer = setTimeout(() => {
        setActiveAlertToast(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [latestAlert]);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col">
      <Navbar />

      {/* Real-time Alert Toast Banner */}
      {activeAlertToast && (
        <div className="bg-rose-950/90 border-b border-rose-600/80 px-6 py-2.5 flex items-center justify-between z-40 sticky top-16 shadow-lg shadow-rose-950/50 animate-bounce">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-mono text-xs font-bold text-rose-300 mr-2 uppercase tracking-wide">
                [{activeAlertToast.severity} ALERT DETECTED]
              </span>
              <span className="text-xs text-slate-100 font-medium">
                {activeAlertToast.title} ({activeAlertToast.source_ip} &rarr; {activeAlertToast.destination_ip})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/alerts/${activeAlertToast.id || ''}`}
              className="text-xs font-mono bg-rose-800 hover:bg-rose-700 text-white px-2.5 py-1 rounded transition"
            >
              Investigate Now
            </Link>
            <button
              onClick={() => setActiveAlertToast(null)}
              className="text-rose-400 hover:text-white p-1 rounded transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
