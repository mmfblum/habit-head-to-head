import { motion } from 'framer-motion';
import { Task } from '@/lib/mockData';
import { Progress } from '@/components/ui/progress';
import { Check, Flame, Plus, Minus } from 'lucide-react';
import { useState } from 'react';

interface TaskCardProps {
  task: Task;
  onUpdate?: (taskId: string, value: number) => void;
}

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  const [value, setValue] = useState(task.currentValue);
  const progress = Math.min((value / task.target) * 100, 100);
  const earnedPoints = Math.min(value * task.pointsPerUnit, task.maxPoints);
  const isCompleted = value >= task.target;

  const handleIncrement = () => {
    const increment = task.type === 'steps' ? 1000 : task.type === 'reading' ? 5 : 1;
    const newValue = Math.min(value + increment, task.target * 1.5);
    setValue(newValue);
    onUpdate?.(task.id, newValue);
  };

  const handleDecrement = () => {
    const decrement = task.type === 'steps' ? 1000 : task.type === 'reading' ? 5 : 1;
    const newValue = Math.max(value - decrement, 0);
    setValue(newValue);
    onUpdate?.(task.id, newValue);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.98 }}
      className={`task-card ${isCompleted ? 'ring-1 ring-primary/50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon & Streak */}
        <div className="relative">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
            isCompleted ? 'bg-primary/20' : 'bg-muted'
          }`}>
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{task.name}</h3>
            {isCompleted && (
              <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
          
          {/* Progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">
                {value.toLocaleString()} / {task.target.toLocaleString()} {task.unit}
              </span>
              <span className={`font-semibold ${isCompleted ? 'text-primary' : ''}`}>
                +{Math.round(earnedPoints)} pts
              </span>
            </div>
            <Progress 
              value={progress} 
              className="h-1.5"
              indicatorClassName={isCompleted ? 'bg-primary' : undefined}
            />
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-col gap-1">
          <button
            onClick={handleIncrement}
            className="w-8 h-8 rounded-lg bg-muted hover:bg-primary/20 hover:text-primary flex items-center justify-center transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleDecrement}
            className="w-8 h-8 rounded-lg bg-muted hover:bg-loss/20 hover:text-loss flex items-center justify-center transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
