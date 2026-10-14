import { motion } from 'framer-motion';
import { Trophy, Target, Flame, Swords } from 'lucide-react';

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
            transition={{ delay: index * 0.08 }}
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

interface QuickStatsProps {
  rank: number;
  totalMembers: number;
  weeklyScore: number;
  wins: number;
  losses: number;
  ties: number;
  streak: number;
  streakType?: string | null;
  weekNumber: number;
  weeksCount: number;
}

export function QuickStats({
  rank,
  totalMembers,
  weeklyScore,
  wins,
  losses,
  ties,
  streak,
  streakType,
  weekNumber,
  weeksCount,
}: QuickStatsProps) {
  const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
  const streakValue = streak > 0 && streakType ? `${streak}${streakType}` : '—';
  const streakSubtext = streak > 0 && streakType
    ? `${streakType === 'W' ? 'Win' : 'Loss'} streak`
    : 'No active streak';

  const stats: Stat[] = [
    {
      icon: Trophy,
      label: 'Season Rank',
      value: `#${rank}`,
      subtext: `of ${totalMembers} players`,
      color: 'primary',
    },
    {
      icon: Swords,
      label: 'Record',
      value: record,
      subtext: ties > 0 ? 'W-L-T' : 'W-L',
      color: 'accent',
    },
    {
      icon: Target,
      label: 'Weekly Points',
      value: weeklyScore.toLocaleString(),
      subtext: `Week ${weekNumber} of ${weeksCount}`,
      color: 'secondary',
    },
    {
      icon: Flame,
      label: 'Current Streak',
      value: streakValue,
      subtext: streakSubtext,
      color: 'streak',
    },
  ];

  return <StatsGrid stats={stats} />;
}
