import { motion } from 'framer-motion';
import { MatchupCard } from '@/components/MatchupCard';
import { QuickStats } from '@/components/StatsGrid';
import { TaskCard } from '@/components/TaskCard';
import { currentMatchup, tasks, currentLeague, currentUser } from '@/lib/mockData';
import { ChevronRight, Zap, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const todayTasks = tasks.slice(0, 3);
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Week {currentLeague.week} • Season {currentLeague.season}</p>
            <h1 className="font-display font-bold text-lg">{currentLeague.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <Bell className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-lg">
              {currentUser.avatar}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Current Matchup */}
        <section>
          <div 
            className="flex items-center justify-between mb-3 cursor-pointer"
            onClick={() => navigate('/matchup')}
          >
            <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Current Matchup
            </h2>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <MatchupCard matchup={currentMatchup} compact />
        </section>

        {/* Quick Stats */}
        <section>
          <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
            Your Stats
          </h2>
          <QuickStats />
        </section>

        {/* Today's Tasks */}
        <section>
          <div 
            className="flex items-center justify-between mb-3 cursor-pointer"
            onClick={() => navigate('/tasks')}
          >
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Today's Tasks
              </h2>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                {completedCount}/{tasks.length}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {todayTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
          {tasks.length > 3 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/tasks')}
              className="w-full mt-3 py-3 rounded-xl bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              View all {tasks.length} tasks
            </motion.button>
          )}
        </section>

        {/* Power-up Hint */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-2xl bg-gradient-to-r from-secondary/20 to-accent/20 border border-secondary/30"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">2x Multiplier Available</p>
              <p className="text-xs text-muted-foreground">Use it on any task before Sunday</p>
            </div>
            <button className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold">
              Use
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
