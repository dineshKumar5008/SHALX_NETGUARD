import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'low' | 'medium' | 'high' | 'critical' | 'online' | 'offline' | 'warning' | 'default' | 'cyan';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
  const variantStyles = {
    low: 'bg-blue-950/60 text-blue-400 border-blue-800/60',
    medium: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    high: 'bg-orange-950/60 text-orange-400 border-orange-800/60',
    critical: 'bg-rose-950/70 text-rose-300 border-rose-700/80 animate-pulse',
    online: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    offline: 'bg-slate-800/60 text-slate-400 border-slate-700/60',
    warning: 'bg-yellow-950/60 text-yellow-400 border-yellow-800/60',
    cyan: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60',
    default: 'bg-slate-800 text-slate-300 border-slate-700',
  };

  const selectedVariant = variant.toLowerCase() as keyof typeof variantStyles;
  const currentStyle = variantStyles[selectedVariant] || variantStyles.default;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium border ${currentStyle} ${className}`}
    >
      {children}
    </span>
  );
};
