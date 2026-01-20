import { motion } from 'framer-motion';
import { CheckinCard } from './CheckinCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { TaskWithTemplate } from '@/types/checkin';

interface DailyCheckinListProps {
  tasks: TaskWithTemplate[];
  isLoading: boolean;
}

export function DailyCheckinList({ tasks, isLoading }: DailyCheckinListProps) {
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
        <p className="text-sm text-muted-foreground/70 mt-1">
          Ask your league admin to add tasks.
        </p>
      </div>
    );
  }

  // Group tasks by category
  const groupedTasks = tasks.reduce((acc, task) => {
    const category = task.template?.category || 'custom';
    if (!acc[category]) acc[category] = [];
    acc[category].push(task);
    return acc;
  }, {} as Record<string, TaskWithTemplate[]>);

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
    'productivity', 'wellness', 'nutrition', 'social', 'custom'
  ];

  const sortedCategories = Object.keys(groupedTasks).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <div className="space-y-6">
      {sortedCategories.map((category) => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            {categoryLabels[category] || category}
          </h2>
          <div className="space-y-3">
            {groupedTasks[category].map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <CheckinCard task={task} />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
