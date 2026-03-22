/**
 * Badge component for status indicators and notifications
 */
import { ReactNode } from 'react';

type BadgeVariant = 
  | 'default' 
  | 'success' 
  | 'warning' 
  | 'danger' 
  | 'info'
  | 'cyan';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  pulse?: boolean;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-cyber-border/50 text-cyber-muted',
  success: 'bg-accent-success/20 text-accent-success border-accent-success/30',
  warning: 'bg-accent-warning/20 text-accent-warning border-accent-warning/30',
  danger: 'bg-accent-danger/20 text-accent-danger border-accent-danger/30',
  info: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30',
  cyan: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'sm',
  pulse = false,
  dot = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium border
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {dot && (
        <span 
          className={`w-1.5 h-1.5 rounded-full ${
            pulse ? 'animate-pulse' : ''
          } ${variant === 'success' ? 'bg-accent-success' : 
             variant === 'warning' ? 'bg-accent-warning' : 
             variant === 'danger' ? 'bg-accent-danger' : 
             'bg-neon-cyan'}`} 
        />
      )}
      {children}
    </span>
  );
}

/** Status dot indicator */
export function StatusDot({ 
  status, 
  pulse = false 
}: { 
  status: 'online' | 'offline' | 'away' | 'busy';
  pulse?: boolean;
}) {
  const colors = {
    online: 'bg-neon-green',
    offline: 'bg-cyber-muted',
    away: 'bg-accent-warning',
    busy: 'bg-accent-danger',
  };

  return (
    <span className="relative flex h-3 w-3">
      {pulse && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-75`} />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${colors[status]}`} />
    </span>
  );
}

/** Notification badge (red dot with count) */
export function NotificationBadge({ 
  count 
}: { 
  count?: number;
}) {
  if (!count || count <= 0) return null;
  
  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent-danger text-white text-xs font-bold">
      {count > 99 ? '99+' : count}
    </span>
  );
}
