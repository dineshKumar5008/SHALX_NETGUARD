import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mb-3.5 shadow-sm">
        {icon || <ShieldCheck size={24} className="text-slate-500" />}
      </div>
      <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-800">{title}</h4>
      <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
