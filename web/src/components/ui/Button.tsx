/**
 * Button Component
 */
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-neon-cyan text-cyber-black hover:bg-neon-cyan/90',
    secondary: 'bg-cyber-card text-white border border-cyber-border hover:border-neon-cyan/50',
    outline: 'bg-transparent text-white border border-cyber-border hover:border-neon-cyan/50',
    danger: 'bg-accent-danger text-white hover:bg-accent-danger/90',
    ghost: 'bg-transparent text-cyber-muted hover:text-white',
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={18} className="animate-spin mr-2" />}
      {children}
    </button>
  );
}
