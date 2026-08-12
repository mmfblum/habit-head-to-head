import { motion } from 'framer-motion';
import { Crown, TrendingUp, TrendingDown, Skull } from 'lucide-react';

export interface LeaderboardUser {
  id: string;
  username: string;
  avatar: string;
  weeklyScore: number;
  seasonScore: number;
  wins: number;
  losses: number;
  ties: number;
  streak: number;
  streakType?: string | null;
  rank: number;
}

interface LeaderboardRowProps {
  user: LeaderboardUser;
  index: number;
  isCurrentUser?: boolean;
  isLowestScorer?: boolean;
  competitionFormat?: 'head_to_head' | 'leaderboard' | 'solo';
}

function Avatar({ value, alt }: { value: string; alt: string }) {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return <img src={value} alt={alt} className="w-full h-full object-cover" />;
  }
  return <span>{value}</span>;
}

export function LeaderboardRow({
  user,
  index,
  isCurrentUser = false,
  isLowestScorer = false,
  competitionFormat = 'head_to_head',
}: LeaderboardRowProps) {
  const getRankDisplay = () => {
    if (user.rank === 1) return <Crown className="w-5 h-5 text-pending" />;
    return <span className="font-bold text-muted-foreground">{user.rank}</span>;
  };

  const getStreakIndicator = () => {
    if (competitionFormat === 'leaderboard' || user.streak <= 0 || !user.streakType) return null;
    if (user.streakType === 'W') return <div className="flex items-center gap-0.5 text-primary"><TrendingUp className="w-3 h-3" /><span className="text-xs font-semibold">{user.streak}W</span></div>;
    return <div className="flex items-center gap-0.5 text-loss"><TrendingDown className="w-3 h-3" /><span className="text-xs font-semibold">{user.streak}L</span></div>;
  };

  const record = user.ties > 0 ? `${user.wins}-${user.losses}-${user.ties}` : `${user.wins}-${user.losses}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
        isCurrentUser ? 'bg-primary/10 ring-1 ring-primary/30' : isLowestScorer ? 'bg-loss/10' : user.rank === 1 ? 'bg-pending/10' : 'hover:bg-muted/50'
      }`}
    >
      <div className="w-8 h-8 flex items-center justify-center">{getRankDisplay()}</div>
      <div className="relative">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl overflow-hidden ${user.rank === 1 ? 'bg-pending/20' : 'bg-muted'}`}>
          <Avatar value={user.avatar} alt={user.username} />
        </div>
        {isLowestScorer && competitionFormat === 'head_to_head' && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-loss rounded-full flex items-center justify-center"><Skull className="w-3 h-3 text-loss-foreground" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2"><span className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-primary' : ''}`}>{user.username}</span>{getStreakIndicator()}</div>
        <p className="text-xs text-muted-foreground">{competitionFormat === 'leaderboard' ? `${user.weeklyScore.toLocaleString()} raw pts this week` : `${record} ${user.ties > 0 ? 'W-L-T' : 'W-L'}`}</p>
      </div>
      <div className="text-right">
        <p className="score-text text-lg">{user.seasonScore.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{competitionFormat === 'leaderboard' ? 'champ pts' : `${user.weeklyScore.toLocaleString()} this week`}</p>
      </div>
    </motion.div>
  );
}
