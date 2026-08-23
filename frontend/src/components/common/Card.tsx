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
    <div className={`bg-[#0f1422] border border-[#1e293b] rounded-xl shadow-lg backdrop-blur-md overflow-hidden ${className}`}>
      {(title || action) && (
        <div className={`px-5 py-4 border-b border-[#1e293b] flex items-center justify-between ${headerClassName}`}>
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
