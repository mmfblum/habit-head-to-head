import { Activity, Footprints, Smartphone, TimerReset } from 'lucide-react';
import { hasNativeHealthBridge, getHealthIntegrationLabel } from '@/lib/nativeHealthBridge';

export function DeviceSyncCard() {
  const nativeReady = hasNativeHealthBridge();

  return (
    <div className={`rounded-2xl border p-4 mb-4 ${
      nativeReady ? 'border-primary/30 bg-primary/5' : 'border-border bg-card/60'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          nativeReady ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm">Automatic tracking</p>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${nativeReady ? 'text-primary' : 'text-muted-foreground'}`}>
              {nativeReady ? 'Device ready' : 'Mobile app'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {nativeReady
              ? getHealthIntegrationLabel()
              : 'The web app stays manual. The native mobile bridge is prepared for protected device data.'}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground">
              <Footprints className="w-3 h-3" /> Steps
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground">
              <Activity className="w-3 h-3" /> Workouts & runs
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground">
              <TimerReset className="w-3 h-3" /> Screen time
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
