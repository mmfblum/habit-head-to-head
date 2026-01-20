import { Shield, ShieldCheck, ShieldAlert, Clock, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VerificationConfig, VerificationMetadata } from '@/lib/verification';

interface VerificationBadgeProps {
  verificationConfig: VerificationConfig | null;
  metadata: VerificationMetadata | null;
  isVerified: boolean;
  className?: string;
}

/**
 * VerificationBadge - Shows verification status for a check-in
 * 
 * Displays:
 * - Verified: Green shield with checkmark
 * - Pending: Yellow shield indicating confirmation needed
 * - Auto-import: Blue badge showing data source
 * - Flagged: Orange badge for manual overrides on auto-import tasks
 */
export function VerificationBadge({
  verificationConfig,
  metadata,
  isVerified,
  className,
}: VerificationBadgeProps) {
  if (!verificationConfig) return null;

  const source = metadata?.source;
  const isAutoImport = verificationConfig.method === 'auto_import';
  const isFlagged = isAutoImport && metadata?.manual_override;
  const isTimerBased = verificationConfig.method === 'timer_based';

  // Determine badge type
  if (isFlagged) {
    return (
      <div className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
        'bg-warning/10 text-warning border border-warning/20',
        className
      )}>
        <ShieldAlert className="w-3 h-3" />
        <span>Manual Entry</span>
      </div>
    );
  }

  if (isAutoImport && source && source !== 'manual') {
    const sourceLabels: Record<string, string> = {
      apple_health: 'Apple Health',
      google_fit: 'Google Fit',
      screen_time: 'Screen Time',
      whoop: 'WHOOP',
    };
    
    return (
      <div className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
        'bg-blue-500/10 text-blue-500 border border-blue-500/20',
        className
      )}>
        <Smartphone className="w-3 h-3" />
        <span>{sourceLabels[source] || source}</span>
      </div>
    );
  }

  if (isTimerBased && metadata?.duration_seconds) {
    const minutes = Math.floor(metadata.duration_seconds / 60);
    return (
      <div className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
        'bg-primary/10 text-primary border border-primary/20',
        className
      )}>
        <Clock className="w-3 h-3" />
        <span>{minutes}m timed</span>
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
        'bg-primary/10 text-primary border border-primary/20',
        className
      )}>
        <ShieldCheck className="w-3 h-3" />
        <span>Verified</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
      'bg-muted text-muted-foreground border border-border',
      className
    )}>
      <Shield className="w-3 h-3" />
      <span>Pending</span>
    </div>
  );
}
