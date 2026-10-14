import React from 'react';

interface CardProps {
  title?: string | React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
  headerClassName = '',
}) => {
  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-lg shadow-sm overflow-hidden transition-all duration-150 ${className}`}
    >
      {(title || action) && (
        <div
          className={`px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-4 ${headerClassName}`}
        >
          <div className="min-w-0 flex-1">
            {typeof title === 'string' ? (
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2 truncate">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
};
