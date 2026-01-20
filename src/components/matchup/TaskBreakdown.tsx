import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { TaskProgress } from '@/hooks/useTaskBreakdown';
import { Check, X, Flame } from 'lucide-react';

interface TaskBreakdownProps {
  tasks: TaskProgress[];
  opponentName: string;
  isLoading?: boolean;
}

function TaskComparisonRow({ 
  task, 
  opponentName,
  index 
}: { 
  task: TaskProgress; 
  opponentName: string;
  index: number;
}) {
  const userAhead = task.user_points > task.opponent_points;
  const tied = task.user_points === task.opponent_points;
  const pointsDiff = task.user_points - task.opponent_points;
  
  // Calculate progress percentages (capped at max points)
  const userProgress = Math.min((task.user_points / task.max_points) * 100, 100);
  const opponentProgress = Math.min((task.opponent_points / task.max_points) * 100, 100);
  
  // Determine if this is a "hot" task (big difference)
  const isHot = Math.abs(pointsDiff) >= task.max_points * 0.5;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`
        card-elevated rounded-xl p-4
        ${isHot && userAhead ? 'ring-1 ring-primary/30' : ''}
        ${isHot && !userAhead && !tied ? 'ring-1 ring-loss/30' : ''}
      `}
    >
      {/* Task header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{task.task_icon}</span>
          <span className="font-semibold text-sm">{task.task_name}</span>
          {isHot && (
            <Flame className={`w-3.5 h-3.5 ${userAhead ? 'text-primary' : 'text-loss'}`} />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={userAhead ? 'text-primary font-semibold' : tied ? 'text-muted-foreground' : ''}>
            +{task.user_points}
          </span>
          <span className="text-muted-foreground">vs</span>
          <span className={!userAhead && !tied ? 'text-loss font-semibold' : 'text-muted-foreground'}>
            +{task.opponent_points}
          </span>
          {!tied && (
            <span className={`
              px-1.5 py-0.5 rounded text-[10px] font-bold
              ${userAhead ? 'bg-primary/20 text-primary' : 'bg-loss/20 text-loss'}
            `}>
              {pointsDiff > 0 ? '+' : ''}{pointsDiff}
            </span>
          )}
        </div>
      </div>

      {/* Dual progress bars */}
      <div className="space-y-2">
        {/* User progress */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 w-12">
            {task.user_completed ? (
              <Check className="w-3 h-3 text-primary" />
            ) : (
              <X className="w-3 h-3 text-muted-foreground/50" />
            )}
            <span className="text-[10px] text-muted-foreground">You</span>
          </div>
          <div className="flex-1">
            <Progress 
              value={userProgress} 
              className="h-2"
              indicatorClassName={userProgress >= 100 ? 'bg-primary' : 'bg-primary/70'}
            />
          </div>
          <span className="text-[10px] text-muted-foreground w-10 text-right">
            {Math.round(userProgress)}%
          </span>
        </div>

        {/* Opponent progress */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 w-12">
            {task.opponent_completed ? (
              <Check className="w-3 h-3 text-loss" />
            ) : (
              <X className="w-3 h-3 text-muted-foreground/50" />
            )}
            <span className="text-[10px] text-muted-foreground truncate">
              {opponentName.split(' ')[0]}
            </span>
          </div>
          <div className="flex-1">
            <Progress 
              value={opponentProgress} 
              className="h-2"
              indicatorClassName="bg-muted-foreground/50"
            />
          </div>
          <span className="text-[10px] text-muted-foreground w-10 text-right">
            {Math.round(opponentProgress)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function TaskBreakdown({ tasks, opponentName, isLoading }: TaskBreakdownProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <div className="text-3xl mb-2">📋</div>
        <p className="text-sm">No tasks configured yet</p>
      </div>
    );
  }

  // Summary stats
  const userWinningTasks = tasks.filter(t => t.user_points > t.opponent_points).length;
  const opponentWinningTasks = tasks.filter(t => t.opponent_points > t.user_points).length;
  const tiedTasks = tasks.filter(t => t.user_points === t.opponent_points).length;

  return (
    <div className="space-y-3">
      {/* Summary badges */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
          Leading: {userWinningTasks}
        </span>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium">
          Tied: {tiedTasks}
        </span>
        <span className="text-xs bg-loss/20 text-loss px-2 py-1 rounded-full font-medium">
          Behind: {opponentWinningTasks}
        </span>
      </div>

      {/* Task list */}
      {tasks.map((task, index) => (
        <TaskComparisonRow
          key={task.task_instance_id}
          task={task}
          opponentName={opponentName}
          index={index}
        />
      ))}
    </div>
  );
}
