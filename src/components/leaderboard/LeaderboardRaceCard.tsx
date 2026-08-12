import { motion } from 'framer-motion';
import { ChevronRight, Crown, TrendingUp } from 'lucide-react';
import type { LeagueMemberWithProfile } from '@/hooks/useLeagueDetails';

interface LeaderboardRaceCardProps {
  members: LeagueMemberWithProfile[];
  currentUserId?: string;
  weekNumber?: number;
  onOpen: () => void;
}

function getRank(sorted: LeagueMemberWithProfile[], userId?: string) {
  if (!userId) return undefined;
  const index = sorted.findIndex((member) => member.user_id === userId);
  if (index < 0) return undefined;
  const score = sorted[index].weekly_points;
  return sorted.findIndex((member) => member.weekly_points === score) + 1;
}

export function LeaderboardRaceCard({ members, currentUserId, weekNumber = 1, onOpen }: LeaderboardRaceCardProps) {
  const sorted = [...members].sort((a, b) => b.weekly_points - a.weekly_points);
  const current = sorted.find((member) => member.user_id === currentUserId);
  const rank = getRank(sorted, currentUserId);
  const leader = sorted[0];
  const playerIndex = sorted.findIndex((member) => member.user_id === currentUserId);
  const playerAhead = playerIndex > 0 ? sorted[playerIndex - 1] : undefined;
  const gapToNext = current && playerAhead ? Math.max(playerAhead.weekly_points - current.weekly_points + 1, 0) : 0;
  const gapToLead = current && leader ? Math.max(leader.weekly_points - current.weekly_points, 0) : 0;

  const statusText = !current || !rank
    ? 'Score your first task to enter the race.'
    : rank === 1
      ? sorted.length > 1
        ? `You lead by ${Math.max(current.weekly_points - sorted[1].weekly_points, 0)} pts.`
        : 'You are setting the pace.'
      : gapToNext <= 1
        ? 'Your next point moves you up.'
        : `${gapToNext} pts to move into #${rank - 1}.`;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.99 }}
      onClick={onOpen}
      className="w-full rounded-2xl border border-pending/25 bg-gradient-to-br from-pending/10 via-card to-primary/5 p-5 text-left"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-pending font-bold">Week {weekNumber} Leaderboard</p>
          <div className="flex items-end gap-2 mt-2">
            <span className="font-display text-4xl font-black leading-none">{rank ? `#${rank}` : '—'}</span>
            <span className="text-sm text-muted-foreground pb-0.5">of {members.length}</span>
          </div>
          <p className="text-sm font-semibold mt-3">{statusText}</p>
          {rank && rank > 1 && gapToLead > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{gapToLead} pts behind the weekly lead</p>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl bg-pending/20 flex items-center justify-center shrink-0">
          {rank === 1 ? <Crown className="w-5 h-5 text-pending" /> : <TrendingUp className="w-5 h-5 text-pending" />}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {sorted.slice(0, 3).map((member, index) => (
          <div key={member.user_id} className={`rounded-xl p-2.5 ${member.user_id === currentUserId ? 'bg-primary/10 ring-1 ring-primary/25' : 'bg-background/60'}`}>
            <p className="text-[10px] text-muted-foreground">#{index + 1}</p>
            <p className="text-xs font-semibold truncate mt-0.5">{member.user_id === currentUserId ? 'You' : member.display_name || 'Player'}</p>
            <p className="score-text text-sm mt-1">{member.weekly_points.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 text-xs font-semibold text-primary">
        <span>View full leaderboard</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </motion.button>
  );
}
