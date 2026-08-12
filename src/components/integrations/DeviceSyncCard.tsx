import { useEffect, useMemo, useRef, useState } from 'react';
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

const HEALTH_CONNECTED_KEY = 'zrizin:native-health-connected';

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

function isHealthConnected() {
  try {
    return localStorage.getItem(HEALTH_CONNECTED_KEY) === 'true';
  } catch {
    return false;
  }
}

function rememberHealthConnection() {
  try {
    localStorage.setItem(HEALTH_CONNECTED_KEY, 'true');
  } catch {
    // Storage failure must never prevent a successful device sync.
  }
}

export function DeviceSyncCard({ tasks, date = new Date() }: DeviceSyncCardProps) {
  const nativeReady = hasNativeHealthBridge();
  const submitCheckin = useSubmitCheckin();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const autoSyncStarted = useRef(false);

  const mappedTasks = useMemo(() => ({
    steps: tasks.find(isStepsTask),
    workout: tasks.find(isWorkoutTask),
  }), [tasks]);

  const mappedCount = Number(Boolean(mappedTasks.steps)) + Number(Boolean(mappedTasks.workout));

  const syncSnapshot = async ({ requestPermission, announce }: { requestPermission: boolean; announce: boolean }) => {
    const bridge = getNativeHealthBridge();
    if (!bridge || mappedCount === 0) return;

    setIsSyncing(true);
    try {
      if (requestPermission) {
        const requested = await bridge.requestAuthorization(['steps', 'workouts']);
        if (requested.granted.length === 0) {
          if (announce) toast.info('Health access was not granted. Manual scoring is still available.');
          return;
        }
      }

      const snapshot = await bridge.readDailySnapshot(formatLocalDate(date));
      const source = snapshot.sources.includes('apple_health') ? 'apple_health' : 'health_connect';
      const importedAt = new Date().toISOString();
      let changed = 0;
      let available = 0;

      if (mappedTasks.steps && typeof snapshot.steps === 'number') {
        available += 1;
        const value = Math.max(0, Math.round(snapshot.steps));
        if (mappedTasks.steps.todayCheckin?.numeric_value !== value) {
          await submitCheckin.mutateAsync({
            taskInstanceId: mappedTasks.steps.id,
            date,
            value: {
              numeric_value: value,
              metadata: {
                source,
                imported: true,
                imported_at: importedAt,
                native_metric: 'steps',
              },
            },
          });
          changed += 1;
        }
      }

      if (mappedTasks.workout && typeof snapshot.workoutMinutes === 'number') {
        available += 1;
        const value = Math.max(0, Math.round(snapshot.workoutMinutes));
        if (mappedTasks.workout.todayCheckin?.duration_minutes !== value) {
          await submitCheckin.mutateAsync({
            taskInstanceId: mappedTasks.workout.id,
            date,
            value: {
              duration_minutes: value,
              metadata: {
                source,
                imported: true,
                imported_at: importedAt,
                native_metric: 'workouts',
                workout_count: snapshot.workouts?.length ?? 0,
              },
            },
          });
          changed += 1;
        }
      }

      if (requestPermission && available > 0) rememberHealthConnection();
      setLastSync(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));

      if (!announce) return;
      if (available === 0) {
        toast.info('No device data was available for the tracked tasks today.');
      } else if (changed === 0) {
        toast.success('Device data is already up to date');
      } else {
        toast.success(`Updated ${changed} scorecard ${changed === 1 ? 'task' : 'tasks'} from ${bridge.platform === 'ios' ? 'Apple Health' : 'Health Connect'}`);
      }
    } catch (error) {
      console.error('Device health sync failed', error);
      if (announce) toast.error(error instanceof Error ? error.message : 'Device sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!nativeReady || mappedCount === 0 || autoSyncStarted.current || !isHealthConnected()) return;
    autoSyncStarted.current = true;
    void syncSnapshot({ requestPermission: false, announce: false });
    // mapped tasks are intentionally the trigger: wait until the scorecard is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeReady, mappedCount]);

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
                onClick={() => void syncSnapshot({ requestPermission: true, announce: true })}
                disabled={isSyncing || mappedCount === 0}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing…' : isHealthConnected() ? 'Refresh device data' : 'Connect & sync'}
              </Button>
              {lastSync && <span className="text-[11px] text-muted-foreground">Updated {lastSync}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
