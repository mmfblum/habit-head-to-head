import { motion, AnimatePresence } from 'framer-motion';
import { Clock, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { differenceInSeconds, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';

interface Participant {
  id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
}

interface MatchupScoreboardProps {
  user: Participant;
  opponent: Participant;
  weekNumber: number;
  weekEndDate?: string;
  isLive?: boolean;
}

function CountdownTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const end = new Date(endDate);
      const now = new Date();
      
      if (now >= end) {
        setTimeLeft('Week ended');
        return;
      }

      const days = differenceInDays(end, now);
      const hours = differenceInHours(end, now) % 24;
      const minutes = differenceInMinutes(end, now) % 60;
      
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h remaining`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeLeft(`${minutes}m remaining`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Clock className="w-4 h-4" />
      <span className="text-xs">{timeLeft}</span>
    </div>
  );
}

function ScoreDisplay({ 
  score, 
  isWinning, 
  isUser 
}: { 
  score: number; 
  isWinning: boolean; 
  isUser: boolean;
}) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.p
        key={score}
        initial={{ scale: 1.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className={`
          score-text text-4xl font-bold
          ${isWinning && isUser ? 'text-primary' : ''}
          ${isWinning && !isUser ? 'text-loss' : ''}
        `}
      >
        {score}
      </motion.p>
    </AnimatePresence>
  );
}

export function MatchupScoreboard({
  user,
  opponent,
  weekNumber,
  weekEndDate,
  isLive = true,
}: MatchupScoreboardProps) {
  const scoreDiff = user.score - opponent.score;
  const isWinning = scoreDiff > 0;
  const isTied = scoreDiff === 0;

  return (
    <header className="relative overflow-hidden safe-top">
      {/* Background gradient */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{ background: 'var(--gradient-hero)' }}
      />
      
      {/* Momentum indicator overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: Math.min(Math.abs(scoreDiff) / 100, 0.3),
          x: isWinning ? '-20%' : '20%'
        }}
        className={`
          absolute inset-0 
          ${isWinning ? 'bg-gradient-to-r from-primary/40 to-transparent' : ''}
          ${!isWinning && !isTied ? 'bg-gradient-to-l from-loss/40 to-transparent' : ''}
        `}
      />

      <div className="relative px-4 py-6">
        {/* Week header */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Week {weekNumber} Matchup
          </span>
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pending/20 text-pending text-xs font-semibold">
              <motion.span 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-1.5 h-1.5 rounded-full bg-pending"
              />
              Live
            </span>
          )}
        </div>

        {/* Score Display */}
        <div className="flex items-center justify-center gap-8">
          {/* User */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`
                w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-2 mx-auto
                ${isWinning ? 'bg-primary/20 ring-2 ring-primary/50' : 'bg-muted'}
              `}
            >
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt={user.display_name}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                <span>{user.display_name.charAt(0).toUpperCase()}</span>
              )}
            </motion.div>
            <p className="font-semibold text-sm">You</p>
            <ScoreDisplay score={user.score} isWinning={isWinning} isUser />
          </div>

          {/* VS / Diff indicator */}
          <div className="flex flex-col items-center gap-1">
            <motion.div 
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: isWinning ? [0, 5, 0] : [0, -5, 0]
              }}
              transition={{ repeat: Infinity, duration: 3 }}
              className={`
                w-12 h-12 rounded-full flex items-center justify-center
                ${isWinning ? 'bg-primary/20' : isTied ? 'bg-muted' : 'bg-loss/20'}
              `}
            >
              {isWinning ? (
                <TrendingUp className="w-6 h-6 text-primary" />
              ) : isTied ? (
                <Minus className="w-6 h-6 text-muted-foreground" />
              ) : (
                <TrendingDown className="w-6 h-6 text-loss" />
              )}
            </motion.div>
            <motion.span 
              key={scoreDiff}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`
                text-sm font-bold
                ${isWinning ? 'text-primary' : isTied ? 'text-muted-foreground' : 'text-loss'}
              `}
            >
              {scoreDiff > 0 ? '+' : ''}{scoreDiff}
            </motion.span>
          </div>

          {/* Opponent */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              className={`
                w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-2 mx-auto
                ${!isWinning && !isTied ? 'bg-loss/20 ring-2 ring-loss/50' : 'bg-muted'}
              `}
            >
              {opponent.avatar_url ? (
                <img 
                  src={opponent.avatar_url} 
                  alt={opponent.display_name}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                <span>{opponent.display_name.charAt(0).toUpperCase()}</span>
              )}
            </motion.div>
            <p className="font-semibold text-sm">{opponent.display_name}</p>
            <ScoreDisplay score={opponent.score} isWinning={!isWinning && !isTied} isUser={false} />
          </div>
        </div>

        {/* Countdown */}
        {weekEndDate && (
          <div className="mt-4">
            <CountdownTimer endDate={weekEndDate} />
          </div>
        )}
      </div>
    </header>
  );
}
