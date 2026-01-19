import { motion } from 'framer-motion';
import { User } from '@/lib/mockData';
import { Crown, TrendingUp, TrendingDown, Skull } from 'lucide-react';

interface LeaderboardRowProps {
  user: User;
  index: number;
  isCurrentUser?: boolean;
  isLowestScorer?: boolean;
}

export function LeaderboardRow({ user, index, isCurrentUser = false, isLowestScorer = false }: LeaderboardRowProps) {
  const getRankDisplay = () => {
    if (user.rank === 1) return <Crown className="w-5 h-5 text-pending" />;
    return <span className="font-bold text-muted-foreground">{user.rank}</span>;
  };

  const getStreakIndicator = () => {
    if (user.streak >= 3) {
      return (
        <div className="flex items-center gap-0.5 text-primary">
          <TrendingUp className="w-3 h-3" />
          <span className="text-xs font-semibold">{user.streak}</span>
        </div>
      );
    }
    if (user.losses > user.wins) {
      return <TrendingDown className="w-3 h-3 text-loss" />;
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
        isCurrentUser ? 'bg-primary/10 ring-1 ring-primary/30' : 
        isLowestScorer ? 'bg-loss/10' :
        user.rank === 1 ? 'bg-pending/10' : 
        'hover:bg-muted/50'
      }`}
    >
      {/* Rank */}
      <div className="w-8 h-8 flex items-center justify-center">
        {getRankDisplay()}
      </div>

      {/* Avatar */}
      <div className="relative">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
          user.rank === 1 ? 'bg-pending/20' : 'bg-muted'
        }`}>
          {user.avatar}
        </div>
        {isLowestScorer && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-loss rounded-full flex items-center justify-center">
            <Skull className="w-3 h-3 text-loss-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-primary' : ''}`}>
            {user.username}
          </span>
          {getStreakIndicator()}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="win-badge text-[10px] py-0.5 px-1.5">{user.wins}W</span>
          <span className="loss-badge text-[10px] py-0.5 px-1.5">{user.losses}L</span>
        </div>
      </div>

      {/* Scores */}
      <div className="text-right">
        <p className="score-text text-lg">{user.seasonScore.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">
          +{user.weeklyScore} this week
        </p>
      </div>
    </motion.div>
  );
}
