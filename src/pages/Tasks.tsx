import { useState } from 'react';
import { motion } from 'framer-motion';
import { TaskCard } from '@/components/TaskCard';
import { tasks as initialTasks, Task } from '@/lib/mockData';
import { Progress } from '@/components/ui/progress';
import { Plus, Filter } from 'lucide-react';

export default function Tasks() {
  const [taskList, setTaskList] = useState<Task[]>(initialTasks);
  
  const completedCount = taskList.filter(t => t.currentValue >= t.target).length;
  const totalPoints = taskList.reduce((sum, task) => {
    const earned = Math.min(task.currentValue * task.pointsPerUnit, task.maxPoints);
    return sum + earned;
  }, 0);
  const maxPossiblePoints = taskList.reduce((sum, task) => sum + task.maxPoints, 0);
  const progress = (completedCount / taskList.length) * 100;

  const handleTaskUpdate = (taskId: string, value: number) => {
    setTaskList(prev => prev.map(task => 
      task.id === taskId ? { ...task, currentValue: value, completed: value >= task.target } : task
    ));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-display font-bold text-xl">Today's Tasks</h1>
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <Filter className="w-4 h-4 text-muted-foreground" />
              </button>
              <button className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                <Plus className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>
          </div>
          
          {/* Daily Progress */}
          <div className="bg-card rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Daily Progress</span>
              <span className="text-sm font-semibold">
                {completedCount}/{taskList.length} Complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">Points earned today</span>
              <span className="score-text text-sm text-primary">
                +{Math.round(totalPoints)} / {maxPossiblePoints}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {/* Task Categories */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
          {['All', 'Fitness', 'Wellness', 'Custom'].map((category, i) => (
            <button
              key={category}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                i === 0 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {taskList.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <TaskCard task={task} onUpdate={handleTaskUpdate} />
            </motion.div>
          ))}
        </div>

        {/* Add Custom Task Prompt */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.98 }}
          className="w-full mt-6 p-4 rounded-xl border-2 border-dashed border-muted hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Custom Task</span>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-1">
            1 of 2 custom task slots remaining
          </p>
        </motion.button>
      </main>
    </div>
  );
}
