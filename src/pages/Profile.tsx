import { motion } from 'framer-motion';
import { currentUser, leagueMembers } from '@/lib/mockData';
import { Settings, Trophy, Target, Flame, Calendar, ChevronRight, LogOut, Bell, Shield } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function Profile() {
  const seasonProgress = (currentUser.wins / (currentUser.wins + currentUser.losses)) * 100;

  const stats = [
    { label: 'Season Wins', value: currentUser.wins, icon: Trophy, color: 'text-primary' },
    { label: 'Season Losses', value: currentUser.losses, icon: Target, color: 'text-loss' },
    { label: 'Best Streak', value: 5, icon: Flame, color: 'text-streak' },
    { label: 'Seasons Played', value: 3, icon: Calendar, color: 'text-secondary' },
  ];

  const menuItems = [
    { label: 'Notifications', icon: Bell },
    { label: 'Privacy & Security', icon: Shield },
    { label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="relative overflow-hidden safe-top">
        <div 
          className="absolute inset-0 opacity-20"
          style={{ background: 'var(--gradient-primary)' }}
        />
        <div className="relative px-4 py-8 text-center">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-24 h-24 rounded-3xl bg-primary/20 flex items-center justify-center text-5xl mx-auto mb-4 ring-4 ring-primary/30"
          >
            {currentUser.avatar}
          </motion.div>
          
          <h1 className="font-display font-bold text-2xl">{currentUser.username}</h1>
          <p className="text-muted-foreground text-sm">Rank #{currentUser.rank} in Productivity Pros</p>
          
          {/* Season record */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="win-badge">
              <Trophy className="w-3 h-3" />
              {currentUser.wins} Wins
            </div>
            <div className="loss-badge">
              {currentUser.losses} Losses
            </div>
            {currentUser.streak > 0 && (
              <div className="streak-badge">
                <Flame className="w-3 h-3" />
                {currentUser.streak} Streak
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Season Stats Card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-elevated rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Season 3 Stats</h2>
            <span className="text-xs text-muted-foreground">Week 5 of 8</span>
          </div>
          
          {/* Win rate progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Win Rate</span>
              <span className="font-semibold">{Math.round(seasonProgress)}%</span>
            </div>
            <Progress value={seasonProgress} className="h-2" />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center p-2">
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                  <p className="score-text text-lg">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Total Points */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-elevated rounded-2xl p-4"
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Season Points</p>
            <p className="score-text text-4xl gradient-text">{currentUser.seasonScore.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              +{currentUser.weeklyScore} this week
            </p>
          </div>
        </motion.section>

        {/* Achievements Preview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Achievements
            </h2>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {['🏆', '🔥', '📚', '💪', '🎯', '⚡'].map((emoji, i) => (
              <div
                key={i}
                className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
                  i < 4 ? 'bg-primary/20 ring-1 ring-primary/30' : 'bg-muted opacity-40'
                }`}
              >
                {emoji}
              </div>
            ))}
          </div>
        </motion.section>

        {/* Menu Items */}
        <section className="space-y-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-card hover:bg-muted/50 transition-colors"
              >
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-left font-medium">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            );
          })}
        </section>

        {/* Logout */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-loss/30 text-loss hover:bg-loss/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </motion.button>
      </main>
    </div>
  );
}
