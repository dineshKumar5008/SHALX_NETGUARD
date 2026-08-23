import React from 'react';
import { ShieldAlert } from 'lucide-react';

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
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl text-slate-400 mb-3">
        {icon || <ShieldAlert size={28} className="text-cyan-400" />}
      </div>
      <h4 className="text-sm font-medium font-mono text-slate-200">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
