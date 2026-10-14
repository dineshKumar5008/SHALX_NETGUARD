import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'outline' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const sizeStyles = {
    xs: 'px-2 py-1 text-[11px] gap-1.5',
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-xs font-medium gap-2',
    lg: 'px-4 py-2.5 text-sm gap-2',
  };

  const variantStyles = {
    primary:
      'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium shadow-sm border border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/40 active:scale-[0.99] transition-all duration-150',
    secondary:
      'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 shadow-sm focus-visible:ring-2 focus-visible:ring-slate-300 active:scale-[0.99] transition-all duration-150',
    danger:
      'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium shadow-sm border border-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40 active:scale-[0.99] transition-all duration-150',
    warning:
      'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-medium shadow-sm border border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/40 active:scale-[0.99] transition-all duration-150',
    outline:
      'bg-transparent hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 active:scale-[0.99] transition-all duration-150',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent active:scale-[0.99] transition-all duration-150',
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-sans transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-0.5 mr-1.5 h-3.5 w-3.5 text-current shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
