import { motion } from 'framer-motion';
import { Trophy, Target, Flame, TrendingUp } from 'lucide-react';

interface Stat {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  color: 'primary' | 'secondary' | 'streak' | 'accent';
}

interface StatsGridProps {
  stats: Stat[];
}

const colorClasses = {
  primary: 'bg-primary/20 text-primary',
  secondary: 'bg-secondary/20 text-secondary',
  streak: 'bg-streak/20 text-streak',
  accent: 'bg-accent/20 text-accent',
};

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card-elevated rounded-xl p-4"
          >
            <div className={`w-8 h-8 rounded-lg ${colorClasses[stat.color]} flex items-center justify-center mb-2`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="score-text text-xl">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            {stat.subtext && (
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stat.subtext}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export function QuickStats() {
  const stats: Stat[] = [
    { icon: Trophy, label: 'Season Rank', value: '#2', subtext: 'of 6 players', color: 'primary' },
    { icon: Target, label: 'Weekly Score', value: '847', subtext: '+55 from tasks', color: 'secondary' },
    { icon: Flame, label: 'Win Streak', value: '3', subtext: 'Personal best: 5', color: 'streak' },
    { icon: TrendingUp, label: 'Season Pts', value: '3,420', subtext: 'Week 5 of 8', color: 'accent' },
  ];

  return <StatsGrid stats={stats} />;
}
