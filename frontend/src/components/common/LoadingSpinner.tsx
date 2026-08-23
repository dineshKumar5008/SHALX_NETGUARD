import React from 'react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading SOC telemetry...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-rose-500/20 border-b-rose-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>
      <span className="text-xs font-mono tracking-wider uppercase text-cyan-400/80 animate-pulse">{message}</span>
    </div>
  );
};
