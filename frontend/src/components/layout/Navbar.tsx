import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { 
  Shield, Bell, LogOut, Play, Search, Menu, RefreshCw
} from 'lucide-react';
import apiClient from '../../api/client';

interface NavbarProps {
  onToggleMobileSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar }) => {
  const { user, logout, canReviewRegistrations } = useAuth();
  const { isConnected } = useWebSocket();
  const [time, setTime] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [quickMessage, setQuickMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
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

  const triggerSimulatedAttack = async () => {
    setIsSimulating(true);
    try {
      const attacks = ['port_scan', 'brute_force', 'dns_anomaly', 'sqli_attack'];
      const randomAttack = attacks[Math.floor(Math.random() * attacks.length)];
      await apiClient.post('/dev/simulate-attack', { attack_type: randomAttack });
      setQuickMessage(`Simulation dispatched: ${randomAttack}`);
      setTimeout(() => setQuickMessage(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Get user initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return 'OP';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20 select-none shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {/* Left: Mobile Toggle & Operator Greeting */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden"
            aria-label="Toggle Navigation Menu"
          >
            <Menu size={20} />
          </button>
        )}

        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight">
            Hi {user?.full_name ? user.full_name.split(' ')[0] : (user?.username || 'Operator')}!
          </h2>
          <p className="text-[11px] text-slate-400 font-normal leading-tight hidden sm:block">
            Your system is secure and monitored
          </p>
        </div>

        {quickMessage && (
          <div className="hidden md:inline-flex text-xs font-mono text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 truncate">
            {quickMessage}
          </div>
        )}
      </div>

      {/* Center: Global Search Bar */}
      <div className="hidden md:flex items-center justify-center flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
            <Search size={15} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for anything..."
            className="w-full bg-slate-50/80 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
          />
        </div>
      </div>

      {/* Right Controls: Attack Simulator, Live Stream, Clock, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Lab Simulator Trigger */}
        <button
          onClick={triggerSimulatedAttack}
          disabled={isSimulating}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-mono transition disabled:opacity-50 active:scale-[0.99] shadow-2xs"
          title="Trigger a realistic test attack event (safe lab simulation)"
        >
          <Play size={11} className={isSimulating ? 'animate-spin text-blue-600' : 'text-blue-600'} />
          <span>Simulate Attack</span>
        </button>

        {/* Live WebSocket Beacon */}
        <div
          className={`flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-xl border transition-colors ${
            isConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium'
              : 'bg-red-50 border-red-200 text-red-700 font-medium'
          }`}
          title={isConnected ? 'Live WebSocket Stream Active' : 'WebSocket Disconnected - Reconnecting...'}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="hidden sm:inline">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>

        {/* Live UTC Clock */}
        <div className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 hidden lg:block">
          {time}
        </div>

        {/* Pending Registration Notifications (Admin/Senior Analyst) */}
        {canReviewRegistrations && (
          <a
            href="/users"
            className={`relative p-2 rounded-xl transition border ${
              pendingCount > 0
                ? 'text-amber-700 bg-amber-50 border-amber-300 hover:bg-amber-100 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200'
            }`}
            title={pendingCount > 0 ? `${pendingCount} pending user registration request(s) awaiting review` : 'No pending registration requests'}
          >
            <Bell size={15} />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-amber-500 text-white text-[9px] font-mono font-bold rounded-full">
                {pendingCount}
              </span>
            )}
          </a>
        )}

        {/* Operator Profile Chip (GuardX style) */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center border border-blue-200 shrink-0">
            {getInitials(user?.full_name || user?.username)}
          </div>
          <div className="text-left hidden md:block">
            <div className="text-xs font-semibold text-slate-800 leading-tight">
              {user?.full_name || user?.username}
            </div>
            <div className="text-[10px] font-mono text-slate-400 font-medium">
              {user?.role}
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
            title="Log Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
};
