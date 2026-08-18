import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSubmitCheckin } from '@/hooks/useTasksWithCheckins';
import { buildVerifiedMetadata, getVerificationConfig } from '@/lib/verification';
import { TASK_ICONS } from '@/types/checkin';
import type { CheckinValue, TaskWithTemplate } from '@/types/checkin';
import { toast } from 'sonner';

interface FinishMyCardProps {
  tasks: TaskWithTemplate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function numberFrom(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function isQuickTask(task: TaskWithTemplate) {
  if (task.todayCheckin) return false;
  const config = (task.config || {}) as Record<string, unknown>;
  const verification = getVerificationConfig(config);
  const scoringMode = typeof config.scoring_mode === 'string' ? config.scoring_mode : 'detailed';
  if (scoringMode !== 'binary') return false;
  if (verification?.auto_import_only || verification?.captures_timestamp || verification?.method === 'timer_based') return false;
  if (config.prefer_exact_entry === true || config.daily_limit_minutes !== undefined || task.template?.unit === 'steps') return false;
  if (task.task_name.toLowerCase().includes('screen time')) return false;
  return task.input_type === 'binary' || task.input_type === 'numeric' || task.input_type === 'duration';
}

function quickValue(task: TaskWithTemplate, hitGoal: boolean): CheckinValue | null {
  if (task.input_type === 'binary') return { boolean_value: hitGoal };
  const config = (task.config || {}) as Record<string, unknown>;
  const defaults = (task.template?.default_config || {}) as Record<string, unknown>;
  const target = numberFrom(config, 'target', 'threshold') ?? numberFrom(defaults, 'target', 'threshold');
  if (target === undefined) return null;
  if (task.input_type === 'duration') return { duration_minutes: hitGoal ? target : 0 };
  if (task.input_type === 'numeric') return { numeric_value: hitGoal ? target : 0 };
  return null;
}

export function FinishMyCard({ tasks, open, onOpenChange }: FinishMyCardProps) {
  const submit = useSubmitCheckin();
  const quickTasks = useMemo(() => tasks.filter(isQuickTask), [tasks]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(0);
  const current = quickTasks[index];
  const total = quickTasks.length;
  const progress = total > 0 ? (answered / total) * 100 : 100;

  const resetAndClose = () => {
    setIndex(0);
    setAnswered(0);
    onOpenChange(false);
  };

  const score = async (hitGoal: boolean) => {
    if (!current) return;
    const value = quickValue(current, hitGoal);
    if (!value) return;
    try {
      await submit.mutateAsync({
        taskInstanceId: current.id,
        value: {
          ...value,
          metadata: buildVerifiedMetadata('manual', true, {}),
        },
      });
      const nextAnswered = answered + 1;
      setAnswered(nextAnswered);
      if (index + 1 >= total) {
        toast.success('Card finished. Every quick decision is logged.');
        resetAndClose();
      } else {
        setIndex(index + 1);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not score this task');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) resetAndClose();
      else onOpenChange(true);
    }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Finish My Card</DialogTitle>
          <DialogDescription>Clear the simple Done/Missed decisions. Exact-value and timestamp tasks stay on the main scorecard.</DialogDescription>
        </DialogHeader>

        {total === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <p className="font-semibold mt-3">Nothing quick left</p>
            <p className="text-xs text-muted-foreground mt-1">Finish any remaining exact-value tasks from the scorecard.</p>
            <Button className="w-full mt-5" onClick={resetAndClose}>Back to Scorecard</Button>
          </div>
        ) : current ? (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>{answered + 1} of {total}</span>
                <span>{Math.round(progress)}% cleared</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mx-auto">
                {TASK_ICONS[current.template?.icon ?? 'activity'] ?? '🎯'}
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-4">Did you hit it?</p>
              <h3 className="font-display font-bold text-xl mt-1">{current.task_name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{current.template?.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-14 gap-2" onClick={() => score(false)} disabled={submit.isPending}>
                <X className="w-4 h-4" /> Missed
              </Button>
              <Button className="h-14 gap-2 font-bold" onClick={() => score(true)} disabled={submit.isPending}>
                Done <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function countFinishableTasks(tasks: TaskWithTemplate[]) {
  return tasks.filter(isQuickTask).length;
}
