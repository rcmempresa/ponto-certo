import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
}

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = 'default' 
}: StatsCardProps) {
  const variants = {
    default: {
      bg: 'bg-card',
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
    },
    primary: {
      bg: 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent',
      iconBg: 'bg-primary/20',
      iconColor: 'text-primary',
    },
    success: {
      bg: 'bg-gradient-to-br from-success/10 via-success/5 to-transparent',
      iconBg: 'bg-success/20',
      iconColor: 'text-success',
    },
    warning: {
      bg: 'bg-gradient-to-br from-warning/10 via-warning/5 to-transparent',
      iconBg: 'bg-warning/20',
      iconColor: 'text-warning',
    },
    destructive: {
      bg: 'bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent',
      iconBg: 'bg-destructive/20',
      iconColor: 'text-destructive',
    },
  };

  const styles = variants[variant];

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border border-border/50 p-6 transition-all duration-300 hover:shadow-lg hover:border-border',
      styles.bg
    )}>
      {/* Decorative gradient blob */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-2xl" />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold tracking-tight">{value}</p>
            {trend && (
              <span className={cn(
                'text-sm font-semibold',
                trend.value >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl',
          styles.iconBg
        )}>
          <Icon className={cn('h-7 w-7', styles.iconColor)} />
        </div>
      </div>
    </div>
  );
}
