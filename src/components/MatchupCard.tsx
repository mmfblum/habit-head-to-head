import { motion } from 'framer-motion';
import { Matchup } from '@/lib/mockData';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MatchupCardProps {
  matchup: Matchup;
  compact?: boolean;
}

export function MatchupCard({ matchup, compact = false }: MatchupCardProps) {
  const { user, opponent, userScore, opponentScore, week, status } = matchup;
  const isWinning = userScore > opponentScore;
  const isTied = userScore === opponentScore;
  const scoreDiff = userScore - opponentScore;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="matchup-card"
    >
      {/* Week indicator */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Matchup content */}
      <div className="flex items-center justify-between gap-4">
        {/* User side */}
        <div className="flex-1 text-center">
          <div className="text-3xl mb-2">{user.avatar}</div>
          <p className="font-semibold text-sm truncate">{user.username}</p>
          <p className={`score-text text-2xl mt-1 ${isWinning ? 'text-primary' : isTied ? 'text-muted-foreground' : ''}`}>
            {userScore}
          </p>
          {!compact && (
            <p className="text-xs text-muted-foreground mt-1">
              {user.wins}-{user.losses}
            </p>
          )}
        </div>

        {/* VS / Score indicator */}
        <div className="flex flex-col items-center gap-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
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

        {/* Opponent side */}
        <div className="flex-1 text-center">
          <div className="text-3xl mb-2">{opponent.avatar}</div>
          <p className="font-semibold text-sm truncate">{opponent.username}</p>
          <p className={`score-text text-2xl mt-1 ${!isWinning && !isTied ? 'text-loss' : ''}`}>
            {opponentScore}
          </p>
          {!compact && (
            <p className="text-xs text-muted-foreground mt-1">
              {opponent.wins}-{opponent.losses}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar showing score comparison */}
      <div className="mt-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden flex">
          <div 
            className="bg-gradient-primary transition-all duration-500"
            style={{ width: `${(userScore / (userScore + opponentScore)) * 100}%` }}
          />
          <div 
            className="bg-loss/60 transition-all duration-500"
            style={{ width: `${(opponentScore / (userScore + opponentScore)) * 100}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}
