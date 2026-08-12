import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Matchup } from '@/lib/mockData';
import { ChevronRight, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MatchupCardProps {
  matchup: Matchup;
  compact?: boolean;
  weekEndDate?: string;
  onClick?: () => void;
}

function getTimeRemaining(endDate?: string) {
  if (!endDate) return null;
  const end = new Date(`${endDate}T23:59:59`);
  const diffMs = end.getTime() - Date.now();
  if (diffMs <= 0) return 'Final';

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function MatchupCard({ matchup, compact = false, weekEndDate, onClick }: MatchupCardProps) {
  const { user, opponent, userScore, opponentScore, week, status } = matchup;
  const [timeRemaining, setTimeRemaining] = useState(() => getTimeRemaining(weekEndDate));
  const isWinning = userScore > opponentScore;
  const isTied = userScore === opponentScore;
  const scoreDiff = userScore - opponentScore;
  const totalScore = userScore + opponentScore;
  const userShare = totalScore > 0 ? (userScore / totalScore) * 100 : 50;
  const opponentShare = totalScore > 0 ? (opponentScore / totalScore) * 100 : 50;

  useEffect(() => {
    setTimeRemaining(getTimeRemaining(weekEndDate));
    if (!weekEndDate) return;
    const interval = window.setInterval(() => setTimeRemaining(getTimeRemaining(weekEndDate)), 60_000);
    return () => window.clearInterval(interval);
  }, [weekEndDate]);

  const gameMessage = status === 'completed'
    ? isTied ? 'Matchup tied' : isWinning ? `You won by ${Math.abs(scoreDiff)}` : `Lost by ${Math.abs(scoreDiff)}`
    : isTied ? 'Dead even' : isWinning ? `You lead by ${Math.abs(scoreDiff)}` : `Down ${Math.abs(scoreDiff)} — game on`;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      onClick={onClick}
      className={`matchup-card w-full text-left ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Week {week}
          </span>
          <span className={`stat-badge ${
            status === 'in_progress' ? 'bg-pending/20 text-pending' :
            status === 'completed' ? 'bg-muted text-muted-foreground' :
            'bg-secondary/20 text-secondary'
          }`}>
            {status === 'in_progress' ? 'Live' : status === 'completed' ? 'Final' : 'Upcoming'}
          </span>
        </div>
        {timeRemaining && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeRemaining}</span>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className={`font-display font-bold text-lg ${
            isWinning ? 'text-primary' : isTied ? '' : 'text-loss'
          }`}>
            {gameMessage}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status === 'completed' ? 'Week complete' : 'Every check-in moves the scoreboard'}
          </p>
        </div>
        {onClick && <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-center min-w-0">
          <div className="w-12 h-12 rounded-xl bg-primary/15 mx-auto mb-2 flex items-center justify-center text-2xl overflow-hidden">
            {user.avatar}
          </div>
          <p className="font-semibold text-sm truncate">You</p>
          <p className={`score-text text-3xl mt-1 ${isWinning ? 'text-primary' : ''}`}>
            {userScore.toLocaleString()}
          </p>
          {!compact && (
            <p className="text-xs text-muted-foreground mt-1">
              {user.wins}-{user.losses}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
            isWinning ? 'bg-primary/20' : isTied ? 'bg-muted' : 'bg-loss/20'
          }`}>
            {isWinning ? (
              <TrendingUp className="w-5 h-5 text-primary" />
            ) : isTied ? (
              <Minus className="w-5 h-5 text-muted-foreground" />
            ) : (
              <TrendingDown className="w-5 h-5 text-loss" />
            )}
          </div>
          <span className={`text-xs font-bold ${
            isWinning ? 'text-primary' : isTied ? 'text-muted-foreground' : 'text-loss'
          }`}>
            {scoreDiff > 0 ? '+' : ''}{scoreDiff}
          </span>
        </div>

        <div className="flex-1 text-center min-w-0">
          <div className="w-12 h-12 rounded-xl bg-loss/10 mx-auto mb-2 flex items-center justify-center text-2xl overflow-hidden">
            {opponent.avatar}
          </div>
          <p className="font-semibold text-sm truncate">{opponent.username}</p>
          <p className={`score-text text-3xl mt-1 ${!isWinning && !isTied ? 'text-loss' : ''}`}>
            {opponentScore.toLocaleString()}
          </p>
          {!compact && (
            <p className="text-xs text-muted-foreground mt-1">
              {opponent.wins}-{opponent.losses}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden flex">
          <motion.div
            className="bg-gradient-primary"
            animate={{ width: `${userShare}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
          <motion.div
            className="bg-loss/60"
            animate={{ width: `${opponentShare}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </div>
      </div>
    </motion.button>
  );
}
