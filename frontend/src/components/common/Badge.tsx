import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | 'low'
    | 'medium'
    | 'high'
    | 'critical'
    | 'online'
    | 'offline'
    | 'warning'
    | 'default'
    | 'cyan'
    | 'info'
    | 'success'
    | 'primary';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', dot = false, className = '' }) => {
  const variantStyles: Record<string, { badge: string; dot: string }> = {
    critical: {
      badge: 'bg-red-50 text-red-700 border-red-200',
      dot: 'bg-red-600',
    },
    high: {
      badge: 'bg-orange-50 text-orange-700 border-orange-200',
      dot: 'bg-orange-600',
    },
    medium: {
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-600',
    },
    low: {
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-600',
    },
    online: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-600',
    },
    success: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-600',
    },
    offline: {
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
    },
    warning: {
      badge: 'bg-yellow-50 text-yellow-800 border-yellow-200',
      dot: 'bg-yellow-600',
    },
    cyan: {
      badge: 'bg-sky-50 text-sky-700 border-sky-200',
      dot: 'bg-sky-600',
    },
    info: {
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-600',
    },
    primary: {
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-600',
    },
    default: {
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-500',
    },
  };

  const selectedVariant = (variant || 'default').toLowerCase();
  const currentConfig = variantStyles[selectedVariant] || variantStyles.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border leading-tight ${currentConfig.badge} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentConfig.dot}`} />}
      {children}
    </span>
  );
};
