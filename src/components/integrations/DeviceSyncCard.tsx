import { useMemo, useState } from 'react';
import { Activity, Footprints, RefreshCw, Smartphone, TimerReset } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSubmitCheckin } from '@/hooks/useTasksWithCheckins';
import {
  getNativeHealthBridge,
  getHealthIntegrationLabel,
  hasNativeHealthBridge,
} from '@/lib/nativeHealthBridge';
import type { TaskWithTemplate } from '@/types/checkin';

interface DeviceSyncCardProps {
  tasks: TaskWithTemplate[];
  date?: Date;
}

function normalizedTaskName(task: TaskWithTemplate) {
  return (task.template?.name ?? '').trim().toLowerCase();
}

function isStepsTask(task: TaskWithTemplate) {
  return /(^|\b)steps?(\b|$)/i.test(normalizedTaskName(task));
}

function isWorkoutTask(task: TaskWithTemplate) {
  return /workout|exercise/i.test(normalizedTaskName(task));
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DeviceSyncCard({ tasks, date = new Date() }: DeviceSyncCardProps) {
  const nativeReady = hasNativeHealthBridge();
  const submitCheckin = useSubmitCheckin();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const mappedTasks = useMemo(() => ({
    steps: tasks.find(isStepsTask),
    workout: tasks.find(isWorkoutTask),
  }), [tasks]);

  const mappedCount = Number(Boolean(mappedTasks.steps)) + Number(Boolean(mappedTasks.workout));

  const syncHealth = async () => {
    const bridge = getNativeHealthBridge();
    if (!bridge) return;

    setIsSyncing(true);
    try {
      const requested = await bridge.requestAuthorization(['steps', 'workouts']);
      if (requested.granted.length === 0) {
        toast.info('Health access was not granted. Manual scoring is still available.');
        return;
      }

      const snapshot = await bridge.readDailySnapshot(formatLocalDate(date));
      const source = snapshot.sources.includes('apple_health') ? 'apple_health' : 'health_connect';
      const importedAt = new Date().toISOString();
      let synced = 0;

      if (mappedTasks.steps && typeof snapshot.steps === 'number') {
        await submitCheckin.mutateAsync({
          taskInstanceId: mappedTasks.steps.id,
          date,
          value: {
            numeric_value: Math.max(0, Math.round(snapshot.steps)),
            metadata: {
              source,
              imported: true,
              imported_at: importedAt,
              native_metric: 'steps',
            },
          },
        });
        synced += 1;
      }

      if (mappedTasks.workout && typeof snapshot.workoutMinutes === 'number') {
        await submitCheckin.mutateAsync({
          taskInstanceId: mappedTasks.workout.id,
          date,
          value: {
            duration_minutes: Math.max(0, Math.round(snapshot.workoutMinutes)),
            metadata: {
              source,
              imported: true,
              imported_at: importedAt,
              native_metric: 'workouts',
              workout_count: snapshot.workouts?.length ?? 0,
            },
          },
        });
        synced += 1;
      }

      if (synced === 0) {
        toast.info(mappedCount === 0
          ? 'This scorecard has no Steps or Workout task to sync.'
          : 'No device data was available for the tracked tasks today.');
        return;
      }

      setLastSync(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      toast.success(`Synced ${synced} scorecard ${synced === 1 ? 'task' : 'tasks'} from ${bridge.platform === 'ios' ? 'Apple Health' : 'Health Connect'}`);
    } catch (error) {
      console.error('Device health sync failed', error);
      toast.error(error instanceof Error ? error.message : 'Device sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

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
              ? `${getHealthIntegrationLabel()}. Sync verified Steps and Workout data into today's scorecard.`
              : 'Web scoring stays manual. Install the native app to connect Apple Health or Health Connect.'}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground">
              <Footprints className="w-3 h-3" /> Steps
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground">
              <Activity className="w-3 h-3" /> Workouts
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground opacity-70">
              <TimerReset className="w-3 h-3" /> Screen time · manual for now
            </span>
          </div>
          {nativeReady && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={syncHealth}
                disabled={isSyncing || mappedCount === 0}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing…' : 'Sync today'}
              </Button>
              {lastSync && <span className="text-[11px] text-muted-foreground">Updated {lastSync}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
