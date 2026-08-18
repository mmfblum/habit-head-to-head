import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { CheckinCard } from './CheckinCard';
import { ReadingSharePrompt } from './ReadingSharePrompt';
import { Skeleton } from '@/components/ui/skeleton';
import { usePowerUps } from '@/hooks/usePowerUps';
import type { TaskWithTemplate } from '@/types/checkin';

interface DailyCheckinListProps {
  tasks: TaskWithTemplate[];
  date?: Date;
  isLoading: boolean;
  weekId?: string;
  powerPlayEnabled?: boolean;
}

const categoryLabels: Record<string, string> = {
  fitness: '💪 Fitness',
  wellness: '🌿 Wellness',
  learning: '📚 Learning',
  productivity: '🎯 Productivity',
  sleep: '😴 Sleep',
  nutrition: '🥗 Nutrition',
  mindfulness: '🧘 Mindfulness',
  social: '👥 Social',
  custom: '✨ Custom',
};

const categoryOrder = [
  'fitness', 'sleep', 'mindfulness', 'learning',
  'productivity', 'wellness', 'nutrition', 'social', 'custom',
];

function groupTasks(tasks: TaskWithTemplate[]) {
  const grouped = tasks.reduce((acc, task) => {
    const category = task.template?.category || 'custom';
    if (!acc[category]) acc[category] = [];
    acc[category].push(task);
    return acc;
  }, {} as Record<string, TaskWithTemplate[]>);

  return Object.keys(grouped)
    .sort((a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b))
    .map((category) => ({ category, tasks: grouped[category] }));
}

export function DailyCheckinList({ tasks, date, isLoading, weekId, powerPlayEnabled = false }: DailyCheckinListProps) {
  const {
    availablePowerups,
    armedPowerups,
    activatePowerUp,
  } = usePowerUps(powerPlayEnabled ? weekId : undefined);

  const availablePowerPlay = availablePowerups.find((powerup) => powerup.powerup_type === 'multiplier');
  const hasArmedPowerPlay = armedPowerups.some((powerup) => powerup.powerup_type === 'multiplier');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="task-card">
            <div className="flex items-start gap-3">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-2 w-full mt-4" />
            <Skeleton className="h-10 w-full mt-4" />
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No tasks configured for this season.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Ask your league admin to add tasks.</p>
      </div>
    );
  }

  const activeTasks = tasks.filter((task) => !task.todayCheckin);
  const completedTasks = tasks.filter((task) => !!task.todayCheckin);

  const renderGroups = (taskList: TaskWithTemplate[], completed = false) => (
    <div className="space-y-6">
      {groupTasks(taskList).map(({ category, tasks: categoryTasks }) => (
        <div key={`${completed ? 'completed' : 'active'}-${category}`}>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            {categoryLabels[category] || category}
          </h2>
          <div className="space-y-3">
            {categoryTasks.map((task, index) => {
              const armedForTask = armedPowerups.some(
                (powerup) => powerup.powerup_type === 'multiplier' && powerup.task_instance_id === task.id
              );
              const canArmPowerPlay = !completed
                && powerPlayEnabled
                && !!availablePowerPlay
                && !hasArmedPowerPlay;

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.035 }}
                >
                  <CheckinCard
                    task={task}
                    powerPlayAvailable={canArmPowerPlay}
                    powerPlayArmed={armedForTask}
                    powerPlayPending={activatePowerUp.isPending}
                    onArmPowerPlay={availablePowerPlay && !completed
                      ? () => activatePowerUp.mutate({ powerup: availablePowerPlay, taskInstanceId: task.id })
                      : undefined}
                  />
                  <ReadingSharePrompt task={task} date={date} />
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {activeTasks.length > 0 ? (
        renderGroups(activeTasks)
      ) : (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 text-center">
          <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
          <p className="font-display font-bold mt-2">Today’s active card is clear</p>
          <p className="text-xs text-muted-foreground mt-1">Everything you logged has moved into Completed below.</p>
        </div>
      )}

      {completedTasks.length > 0 && (
        <details className="group rounded-2xl border border-border bg-card/45 overflow-hidden">
          <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Completed</span>
              <span className="text-xs text-muted-foreground">{completedTasks.length}</span>
            </div>
            <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
            <span className="text-xs text-muted-foreground hidden group-open:inline">Hide</span>
          </summary>
          <div className="border-t border-border px-3 py-4 opacity-80">
            {renderGroups(completedTasks, true)}
          </div>
        </details>
      )}
    </div>
  );
}
