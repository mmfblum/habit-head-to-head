import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BinaryCheckinInput, 
  NumericCheckinInput, 
  TimeCheckinInput, 
  DurationCheckinInput 
} from '@/components/checkin';
import { Progress } from '@/components/ui/progress';
import { Check, Flame, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

// Demo task data
const demoTasks = [
  {
    id: 'demo-journal',
    name: 'Journaling',
    icon: '📝',
    description: 'Write in your journal for at least 5 minutes',
    inputType: 'binary' as const,
    category: 'mindfulness',
    config: { points_per_completion: 3 },
    streakDays: 12,
  },
  {
    id: 'demo-steps',
    name: 'Steps',
    icon: '👟',
    description: 'Walk 10,000 steps today',
    inputType: 'numeric' as const,
    category: 'fitness',
    config: { points_per_unit: 1, unit_size: 1000, daily_cap: 10 },
    unit: 'steps',
    streakDays: 7,
  },
  {
    id: 'demo-pushups',
    name: 'Pushups',
    icon: '💪',
    description: 'Do pushups and earn points for every rep',
    inputType: 'numeric' as const,
    category: 'fitness',
    config: { points_per_unit: 0.1, unit_size: 1, daily_cap: 5 },
    unit: 'reps',
    streakDays: 3,
  },
  {
    id: 'demo-workout',
    name: 'Workout',
    icon: '🏋️',
    description: 'Complete at least 30 minutes of exercise',
    inputType: 'duration' as const,
    category: 'fitness',
    config: { threshold: 30, points_for_threshold: 5 },
    streakDays: 5,
  },
  {
    id: 'demo-reading',
    name: 'Reading',
    icon: '📚',
    description: 'Read for at least 20 minutes',
    inputType: 'duration' as const,
    category: 'learning',
    config: { threshold: 20, points_for_threshold: 4 },
    streakDays: 14,
  },
  {
    id: 'demo-meditation',
    name: 'Meditation',
    icon: '🧘',
    description: 'Meditate and earn points per 5 minutes',
    inputType: 'duration' as const,
    category: 'mindfulness',
    config: { points_per_unit: 0.2, unit_size: 5, daily_cap: 5 },
    streakDays: 8,
  },
  {
    id: 'demo-bedtime',
    name: 'Bedtime',
    icon: '🌙',
    description: 'Get to bed before 11 PM',
    inputType: 'time' as const,
    category: 'sleep',
    config: { target_time: '23:00', points_for_success: 3 },
    isBefore: true,
    streakDays: 4,
  },
  {
    id: 'demo-waketime',
    name: 'Wake Time',
    icon: '☀️',
    description: 'Wake up before 7 AM',
    inputType: 'time' as const,
    category: 'sleep',
    config: { target_time: '07:00', points_for_success: 3 },
    isBefore: true,
    streakDays: 2,
  },
  {
    id: 'demo-screentime',
    name: 'Screen Time',
    icon: '📱',
    description: 'Keep screen time under 2 hours',
    inputType: 'numeric' as const,
    category: 'productivity',
    config: { 
      tiers: [
        { min: 0, max: 60, points: 5 },
        { min: 60, max: 120, points: 3 },
        { min: 120, max: 180, points: 0 },
        { min: 180, max: null, points: -3 }
      ]
    },
    unit: 'min',
    streakDays: 0,
  },
];

interface DemoTaskState {
  binaryValue: boolean;
  numericValue: number;
  timeValue: string;
  durationValue: number;
}

export default function CheckinDemo() {
  const [taskStates, setTaskStates] = useState<Record<string, DemoTaskState>>(() => {
    const initial: Record<string, DemoTaskState> = {};
    demoTasks.forEach(task => {
      initial[task.id] = {
        binaryValue: false,
        numericValue: 0,
        timeValue: '',
        durationValue: 0,
      };
    });
    return initial;
  });

  const updateTaskState = (taskId: string, key: keyof DemoTaskState, value: any) => {
    setTaskStates(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], [key]: value },
    }));
  };

  // Calculate points for each task
  const calculatePoints = (task: typeof demoTasks[0], state: DemoTaskState): { points: number; isComplete: boolean; progress: number } => {
    const config = task.config as Record<string, unknown>;
    
    switch (task.inputType) {
      case 'binary': {
        const pts = state.binaryValue ? (config.points_per_completion as number || 10) : 0;
        return { points: pts, isComplete: state.binaryValue, progress: state.binaryValue ? 100 : 0 };
      }
      case 'numeric': {
        if (config.tiers) {
          // Tiered scoring (screen time)
          const tiers = config.tiers as Array<{ min: number; max: number | null; points: number }>;
          let pts = 0;
          for (const tier of tiers) {
            if (state.numericValue >= tier.min && (tier.max === null || state.numericValue < tier.max)) {
              pts = tier.points;
              break;
            }
          }
          return { points: pts, isComplete: pts > 0, progress: pts > 0 ? 100 : (state.numericValue > 0 ? 50 : 0) };
        } else {
          // Linear scoring
          const unitSize = (config.unit_size as number) || 1;
          const ptsPerUnit = (config.points_per_unit as number) || 1;
          const cap = (config.daily_cap as number) || 100;
          const pts = Math.min((state.numericValue / unitSize) * ptsPerUnit, cap);
          const prog = Math.min((pts / cap) * 100, 100);
          return { points: pts, isComplete: pts >= cap, progress: prog };
        }
      }
      case 'time': {
        if (!state.timeValue) return { points: 0, isComplete: false, progress: 0 };
        const targetTime = (config.target_time as string) || '23:00';
        const ptsForSuccess = (config.points_for_success as number) || 3;
        const [valH, valM] = state.timeValue.split(':').map(Number);
        const [tarH, tarM] = targetTime.split(':').map(Number);
        const met = task.isBefore 
          ? valH * 60 + valM <= tarH * 60 + tarM
          : valH * 60 + valM >= tarH * 60 + tarM;
        return { points: met ? ptsForSuccess : 0, isComplete: met, progress: met ? 100 : 50 };
      }
      case 'duration': {
        if (config.threshold) {
          // Threshold scoring
          const threshold = config.threshold as number;
          const ptsForThreshold = (config.points_for_threshold as number) || 5;
          const met = state.durationValue >= threshold;
          return { 
            points: met ? ptsForThreshold : 0, 
            isComplete: met, 
            progress: Math.min((state.durationValue / threshold) * 100, 100) 
          };
        } else {
          // Linear scoring
          const unitSize = (config.unit_size as number) || 5;
          const ptsPerUnit = (config.points_per_unit as number) || 0.2;
          const cap = (config.daily_cap as number) || 5;
          const pts = Math.min((state.durationValue / unitSize) * ptsPerUnit, cap);
          const prog = Math.min((pts / cap) * 100, 100);
          return { points: pts, isComplete: pts >= cap, progress: prog };
        }
      }
      default:
        return { points: 0, isComplete: false, progress: 0 };
    }
  };

  // Calculate totals
  const totalPoints = demoTasks.reduce((sum, task) => {
    const { points } = calculatePoints(task, taskStates[task.id]);
    return sum + points;
  }, 0);

  const completedCount = demoTasks.filter(task => 
    calculatePoints(task, taskStates[task.id]).isComplete
  ).length;

  const categoryLabels: Record<string, string> = {
    fitness: '💪 Fitness',
    learning: '📚 Learning',
    productivity: '🎯 Productivity',
    sleep: '😴 Sleep',
    mindfulness: '🧘 Mindfulness',
  };

  // Group tasks by category
  const groupedTasks = demoTasks.reduce((acc, task) => {
    if (!acc[task.category]) acc[task.category] = [];
    acc[task.category].push(task);
    return acc;
  }, {} as Record<string, typeof demoTasks>);

  const categoryOrder = ['fitness', 'sleep', 'mindfulness', 'learning', 'productivity'];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/tasks">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-display font-bold text-xl">Check-in Demo</h1>
              <p className="text-xs text-muted-foreground">All input types showcased</p>
            </div>
          </div>
          
          {/* Daily Progress */}
          <div className="bg-card rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Demo Progress</span>
              <span className="text-sm font-semibold">
                {completedCount}/{demoTasks.length} Complete
              </span>
            </div>
            <Progress value={(completedCount / demoTasks.length) * 100} className="h-2" />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">Points earned</span>
              <span className="score-text text-sm text-primary">
                +{totalPoints.toFixed(1)} pts
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {/* Input Type Legend */}
        <div className="bg-card rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold mb-3">Input Types</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span>Binary (Yes/No)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-secondary" />
              <span>Numeric (Count)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <span>Time (Clock)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pending" />
              <span>Duration (Minutes)</span>
            </div>
          </div>
        </div>

        {/* Tasks by Category */}
        <div className="space-y-6">
          {categoryOrder.map(category => {
            const tasks = groupedTasks[category];
            if (!tasks) return null;

            return (
              <div key={category}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                  {categoryLabels[category] || category}
                </h2>
                <div className="space-y-3">
                  {tasks.map((task, index) => {
                    const state = taskStates[task.id];
                    const { points, isComplete, progress } = calculatePoints(task, state);
                    const config = task.config as Record<string, unknown>;

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          'task-card relative',
                          isComplete && 'ring-1 ring-primary/50'
                        )}
                      >
                        {/* Input type badge */}
                        <div className={cn(
                          'absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase',
                          task.inputType === 'binary' && 'bg-primary/20 text-primary',
                          task.inputType === 'numeric' && 'bg-secondary/20 text-secondary',
                          task.inputType === 'time' && 'bg-accent/20 text-accent',
                          task.inputType === 'duration' && 'bg-pending/20 text-pending',
                        )}>
                          {task.inputType}
                        </div>

                        <div className="flex items-start gap-3 mb-4">
                          {/* Icon & Streak */}
                          <div className="relative">
                            <div className={cn(
                              'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                              isComplete ? 'bg-primary/20' : 'bg-muted'
                            )}>
                              {task.icon}
                            </div>
                            {task.streakDays > 0 && (
                              <div className="absolute -top-1 -right-1 streak-badge px-1.5 py-0.5 text-[10px]">
                                <Flame className="w-3 h-3" />
                                {task.streakDays}
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pr-16">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm">{task.name}</h3>
                              {isComplete && (
                                <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="w-3 h-3 text-primary-foreground" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {task.description}
                            </p>
                          </div>

                          {/* Points */}
                          <div className="text-right absolute right-4 top-10">
                            <span className={cn(
                              'score-text text-lg',
                              isComplete ? 'text-primary' : points < 0 ? 'text-loss' : 'text-muted-foreground'
                            )}>
                              {points >= 0 ? '+' : ''}{points.toFixed(1)}
                            </span>
                            <span className="text-xs text-muted-foreground block">pts</span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mb-4">
                          <Progress value={progress} className="h-1.5" />
                        </div>

                        {/* Input component based on type */}
                        {task.inputType === 'binary' && (
                          <BinaryCheckinInput
                            value={state.binaryValue}
                            onChange={(v) => updateTaskState(task.id, 'binaryValue', v)}
                          />
                        )}

                        {task.inputType === 'numeric' && (
                          <NumericCheckinInput
                            value={state.numericValue}
                            onChange={(v) => updateTaskState(task.id, 'numericValue', v)}
                            unit={task.unit}
                            step={task.unit === 'steps' ? 1000 : 1}
                          />
                        )}

                        {task.inputType === 'time' && (
                          <TimeCheckinInput
                            value={state.timeValue}
                            onChange={(v) => updateTaskState(task.id, 'timeValue', v)}
                            label={task.name}
                            targetTime={config.target_time as string}
                            isBefore={task.isBefore}
                          />
                        )}

                        {task.inputType === 'duration' && (
                          <DurationCheckinInput
                            value={state.durationValue}
                            onChange={(v) => updateTaskState(task.id, 'durationValue', v)}
                            threshold={config.threshold as number | undefined}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
