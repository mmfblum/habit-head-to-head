import { Scale } from 'lucide-react';
import { PunishmentWheelCard } from '@/components/matchup/PunishmentWheelCard';
import type { LeagueMemberWithProfile } from '@/hooks/useLeagueDetails';

interface LeaderboardConsequenceCardProps {
  weekId: string;
  isLocked: boolean;
  members: LeagueMemberWithProfile[];
  currentUserId?: string;
}

export function LeaderboardConsequenceCard({ weekId, isLocked, members, currentUserId }: LeaderboardConsequenceCardProps) {
  if (!isLocked || members.length < 2) return null;

  const sorted = [...members].sort((a, b) => a.weekly_points - b.weekly_points);
  const lowestScore = sorted[0]?.weekly_points ?? 0;
  const bottom = sorted.filter((member) => member.weekly_points === lowestScore);

  if (bottom.length !== 1) {
    return (
      <section className="rounded-2xl border border-secondary/20 bg-secondary/5 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center"><Scale className="w-5 h-5 text-secondary" /></div>
        <div><p className="font-semibold text-sm">Tie for last — wheel canceled</p><p className="text-xs text-muted-foreground">No unique last-place finisher means no punishment this week.</p></div>
      </section>
    );
  }

  const loser = bottom[0];
  return (
    <PunishmentWheelCard
      weekId={weekId}
      didLose={loser.user_id === currentUserId}
      opponentName={loser.user_id === currentUserId ? 'Last place' : loser.display_name || 'Last place'}
      context="leaderboard"
    />
  );
}
