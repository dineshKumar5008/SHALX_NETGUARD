import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { 
  Shield, Bell, Wifi, WifiOff, LogOut, User as UserIcon, AlertTriangle, Play
} from 'lucide-react';
import apiClient from '../../api/client';

export const Navbar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { isConnected } = useWebSocket();
  const [time, setTime] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [quickMessage, setQuickMessage] = useState<string | null>(null);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerSimulatedAttack = async () => {
    setIsSimulating(true);
    try {
      const attacks = ['port_scan', 'brute_force', 'dns_anomaly', 'sqli_attack'];
      const randomAttack = attacks[Math.floor(Math.random() * attacks.length)];
      const res = await apiClient.post('/dev/simulate-attack', { attack_type: randomAttack });
      setQuickMessage(`Attack simulation triggered: ${randomAttack}`);
      setTimeout(() => setQuickMessage(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <header className="h-16 bg-[#0f1422] border-b border-[#1e293b] px-6 flex items-center justify-between sticky top-0 z-30 shadow-md">
      {/* Left: Branding & Dev Mode Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-cyan-950 to-slate-900 border border-cyan-500/40 rounded-lg shadow-lg shadow-cyan-950/50">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold tracking-wider text-base bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
                SHALX NETGUARD
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-semibold">
                SOC v1.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
              Intelligent Network Security Monitoring &amp; Response Platform
            </p>
          </div>
        </div>

        {/* Development Mode Badge */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-950/50 border border-amber-800/60 text-amber-400 text-xs font-mono font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>DEVELOPMENT MODE</span>
        </div>

        {quickMessage && (
          <div className="text-xs font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded border border-cyan-700 animate-fade-in">
            {quickMessage}
          </div>
        )}
      </div>

      {/* Right: SOC Stream Pulse, Clock, Lab Simulator Button, User Menu */}
      <div className="flex items-center gap-4">
        {/* Lab Simulator Quick Trigger */}
        <button
          onClick={triggerSimulatedAttack}
          disabled={isSimulating}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 text-xs font-mono transition shadow-sm disabled:opacity-50"
          title="Trigger a realistic test attack event (safe lab simulation)"
        >
          <Play size={13} className={isSimulating ? 'animate-spin' : 'text-indigo-400'} />
          <span>Simulate Lab Event</span>
        </button>

        {/* WebSocket Stream Status */}
        <div
          className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md border ${
            isConnected
              ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-400'
              : 'bg-rose-950/50 border-rose-800/60 text-rose-400'
          }`}
          title={isConnected ? 'Live WebSocket Stream Active' : 'WebSocket Disconnected - Reconnecting...'}
        >
          {isConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span className="hidden sm:inline">{isConnected ? 'LIVE STREAM' : 'DISCONNECTED'}</span>
        </div>

        {/* Live UTC Clock */}
        <div className="text-xs font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800 hidden md:block">
          {time}
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium text-slate-200">{user?.full_name || user?.username}</div>
            <div className="text-[10px] font-mono text-cyan-400 tracking-wide">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition border border-transparent hover:border-slate-700"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
