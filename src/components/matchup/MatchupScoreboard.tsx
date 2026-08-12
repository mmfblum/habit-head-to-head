import { motion, AnimatePresence } from 'framer-motion';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';

interface Participant {
  id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
}

type GameStatus = 'scheduled' | 'in_progress' | 'completed';

interface MatchupScoreboardProps {
  user: Participant;
  opponent: Participant;
  weekNumber: number;
  weekStartDate?: string;
  weekEndDate?: string;
  status: GameStatus;
}

function MatchupClock({ status, startDate, endDate }: { status: GameStatus; startDate?: string; endDate?: string }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      if (status === 'completed') {
        setLabel('Final');
        return;
      }

      const targetDate = status === 'scheduled' ? startDate : endDate;
      if (!targetDate) {
        setLabel(status === 'scheduled' ? 'Scheduled' : 'Live');
        return;
      }

      const target = status === 'scheduled'
        ? new Date(`${targetDate}T00:00:00`)
        : new Date(`${targetDate}T23:59:59`);
      const diffMs = target.getTime() - Date.now();

      if (diffMs <= 0) {
        setLabel(status === 'scheduled' ? `Starts ${format(parseISO(targetDate), 'EEE')}` : 'Final');
        return;
      }

      const totalMinutes = Math.floor(diffMs / 60_000);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;
      const prefix = status === 'scheduled' ? 'Starts in ' : '';
      const suffix = status === 'in_progress' ? ' remaining' : '';

      if (days > 0) setLabel(`${prefix}${days}d ${hours}h${suffix}`);
      else if (hours > 0) setLabel(`${prefix}${hours}h ${minutes}m${suffix}`);
      else setLabel(`${prefix}${minutes}m${suffix}`);
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 60_000);
    return () => window.clearInterval(interval);
  }, [status, startDate, endDate]);

  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Clock className="w-4 h-4" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

function ScoreDisplay({ score, highlighted }: { score: number; highlighted: boolean }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.p
        key={score}
        initial={{ scale: 1.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className={`score-text text-4xl font-bold ${highlighted ? 'text-primary' : ''}`}
      >
        {score.toLocaleString()}
      </motion.p>
    </AnimatePresence>
  );
}

export function MatchupScoreboard({
  user,
  opponent,
  weekNumber,
  weekStartDate,
  weekEndDate,
  status,
}: MatchupScoreboardProps) {
  const scoreDiff = user.score - opponent.score;
  const isWinning = scoreDiff > 0;
  const isTied = scoreDiff === 0;
  const isLive = status === 'in_progress';
  const isScheduled = status === 'scheduled';

  return (
    <header className="relative overflow-hidden safe-top">
      <div className="absolute inset-0 opacity-30" style={{ background: 'var(--gradient-hero)' }} />

      {isLive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: Math.min(Math.abs(scoreDiff) / 100, 0.3), x: isWinning ? '-20%' : '20%' }}
          className={`absolute inset-0 ${
            isWinning ? 'bg-gradient-to-r from-primary/40 to-transparent' :
            !isTied ? 'bg-gradient-to-l from-loss/40 to-transparent' : ''
          }`}
        />
      )}

      <div className="relative px-4 py-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Week {weekNumber} Matchup</span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
            isLive ? 'bg-pending/20 text-pending' : isScheduled ? 'bg-secondary/20 text-secondary' : 'bg-muted text-muted-foreground'
          }`}>
            {isLive && (
              <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 rounded-full bg-pending" />
            )}
            {isLive ? 'Live' : isScheduled ? 'Scheduled' : 'Final'}
          </span>
        </div>

        <div className="flex items-center justify-center gap-8">
          <div className="text-center min-w-0">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-2 mx-auto overflow-hidden ${
                isLive && isWinning ? 'bg-primary/20 ring-2 ring-primary/50' : 'bg-muted'
              }`}
            >
              {user.avatar_url ? <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" /> : <span>{user.display_name.charAt(0).toUpperCase()}</span>}
            </motion.div>
            <p className="font-semibold text-sm">You</p>
            <ScoreDisplay score={user.score} highlighted={!isScheduled && isWinning} />
          </div>

          <div className="flex flex-col items-center gap-1">
            <motion.div
              animate={isLive ? { scale: [1, 1.05, 1], rotate: isWinning ? [0, 5, 0] : [0, -5, 0] } : undefined}
              transition={isLive ? { repeat: Infinity, duration: 3 } : undefined}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isScheduled ? 'bg-secondary/20' : isWinning ? 'bg-primary/20' : isTied ? 'bg-muted' : 'bg-loss/20'
              }`}
            >
              {isScheduled ? <Clock className="w-6 h-6 text-secondary" /> : isWinning ? <TrendingUp className="w-6 h-6 text-primary" /> : isTied ? <Minus className="w-6 h-6 text-muted-foreground" /> : <TrendingDown className="w-6 h-6 text-loss" />}
            </motion.div>
            <span className={`text-sm font-bold ${
              isScheduled ? 'text-secondary' : isWinning ? 'text-primary' : isTied ? 'text-muted-foreground' : 'text-loss'
            }`}>
              {isScheduled ? 'VS' : `${scoreDiff > 0 ? '+' : ''}${scoreDiff}`}
            </span>
          </div>

          <div className="text-center min-w-0">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-2 mx-auto overflow-hidden ${
                isLive && !isWinning && !isTied ? 'bg-loss/20 ring-2 ring-loss/50' : 'bg-muted'
              }`}
            >
              {opponent.avatar_url ? <img src={opponent.avatar_url} alt={opponent.display_name} className="w-full h-full object-cover" /> : <span>{opponent.display_name.charAt(0).toUpperCase()}</span>}
            </motion.div>
            <p className="font-semibold text-sm truncate max-w-28">{opponent.display_name}</p>
            <ScoreDisplay score={opponent.score} highlighted={!isScheduled && !isWinning && !isTied} />
          </div>
        </div>

        {(weekStartDate || weekEndDate) && (
          <div className="mt-4">
            <MatchupClock status={status} startDate={weekStartDate} endDate={weekEndDate} />
          </div>
        )}
      </div>
    </header>
  );
}
