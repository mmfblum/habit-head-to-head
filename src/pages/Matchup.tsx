import { motion } from 'framer-motion';
import { currentMatchup, tasks, currentUser, opponent } from '@/lib/mockData';
import { Progress } from '@/components/ui/progress';
import { MessageCircle, TrendingUp, Clock, Zap } from 'lucide-react';

export default function Matchup() {
  const { userScore, opponentScore, week } = currentMatchup;
  const isWinning = userScore > opponentScore;
  const scoreDiff = Math.abs(userScore - opponentScore);
  
  // Simulated opponent task progress
  const opponentTasks = tasks.map(task => ({
    ...task,
    currentValue: Math.floor(task.target * (0.5 + Math.random() * 0.5)),
  }));

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header with VS display */}
      <header className="relative overflow-hidden safe-top">
        <div 
          className="absolute inset-0 opacity-30"
          style={{ background: 'var(--gradient-hero)' }}
        />
        <div className="relative px-4 py-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Week {week} Matchup
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pending/20 text-pending text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-pending animate-pulse" />
              Live
            </span>
          </div>

          {/* Score Display */}
          <div className="flex items-center justify-center gap-6">
            {/* User */}
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl mb-2 mx-auto ring-2 ring-primary/50"
              >
                {currentUser.avatar}
              </motion.div>
              <p className="font-semibold text-sm">{currentUser.username}</p>
              <motion.p
                key={userScore}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className={`score-text text-3xl ${isWinning ? 'text-primary' : ''}`}
              >
                {userScore}
              </motion.p>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center">
              <span className="text-2xl font-display font-bold text-muted-foreground">VS</span>
              <span className={`text-sm font-bold mt-1 ${isWinning ? 'text-primary' : 'text-loss'}`}>
                {isWinning ? '+' : '-'}{scoreDiff}
              </span>
            </div>

            {/* Opponent */}
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
                className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-3xl mb-2 mx-auto"
              >
                {opponent.avatar}
              </motion.div>
              <p className="font-semibold text-sm">{opponent.username}</p>
              <p className={`score-text text-3xl ${!isWinning ? 'text-loss' : ''}`}>
                {opponentScore}
              </p>
            </div>
          </div>

          {/* Time remaining */}
          <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-xs">2 days, 14 hours remaining</span>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Task Comparison */}
        <section>
          <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
            Task Breakdown
          </h2>
          
          <div className="space-y-3">
            {tasks.map((task, index) => {
              const opponentTask = opponentTasks[index];
              const userProgress = (task.currentValue / task.target) * 100;
              const opponentProgress = (opponentTask.currentValue / opponentTask.target) * 100;
              const userPoints = Math.round(Math.min(task.currentValue * task.pointsPerUnit, task.maxPoints));
              const opponentPoints = Math.round(Math.min(opponentTask.currentValue * opponentTask.pointsPerUnit, opponentTask.maxPoints));
              const isUserAhead = userPoints > opponentPoints;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card-elevated rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{task.icon}</span>
                      <span className="font-semibold text-sm">{task.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={isUserAhead ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                        +{userPoints}
                      </span>
                      <span className="text-muted-foreground">vs</span>
                      <span className={!isUserAhead ? 'text-loss font-semibold' : 'text-muted-foreground'}>
                        +{opponentPoints}
                      </span>
                    </div>
                  </div>

                  {/* Dual progress bars */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-8">You</span>
                      <div className="flex-1">
                        <Progress 
                          value={userProgress} 
                          className="h-1.5"
                          indicatorClassName={userProgress >= 100 ? 'bg-primary' : undefined}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-12 text-right">
                        {Math.round(userProgress)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-8">{opponent.username.split(' ')[0]}</span>
                      <div className="flex-1">
                        <Progress 
                          value={opponentProgress} 
                          className="h-1.5"
                          indicatorClassName="bg-muted-foreground/50"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-12 text-right">
                        {Math.round(opponentProgress)}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="p-4 rounded-xl bg-secondary/20 border border-secondary/30 flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5 text-secondary" />
            <span className="font-semibold text-sm">Use Power-Up</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="p-4 rounded-xl bg-muted flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold text-sm text-muted-foreground">Send Taunt</span>
          </motion.button>
        </div>

        {/* Head-to-head history */}
        <section className="card-elevated rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Head-to-Head History</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="win-badge">2W</span>
                <span className="text-sm">vs {opponent.username}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">67% win rate</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
