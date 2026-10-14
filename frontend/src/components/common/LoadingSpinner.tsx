import React from 'react';

export const LoadingSpinner: React.FC<{ message?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  message = 'Loading telemetry stream...',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border',
    md: 'w-7 h-7 border-2',
    lg: 'w-10 h-10 border-2',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-slate-500 gap-3 select-none">
      <div
        className={`${sizeClasses[size]} rounded-full border-slate-200 border-t-blue-600 animate-spin shrink-0`}
      />
      {message && (
        <span className="text-xs font-mono tracking-wide text-slate-600 font-medium">
          {message}
        </span>
      )}
    </div>
  );
};
