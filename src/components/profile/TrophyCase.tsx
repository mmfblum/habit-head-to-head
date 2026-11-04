import { Award } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAchievements } from '@/hooks/useAchievements';

interface TrophyCaseProps {
  userId?: string;
  seasonId?: string;
  wins?: number;
  currentStreak?: number;
  streakType?: string | null;
}

export function TrophyCase({ userId, seasonId, wins = 0, currentStreak = 0, streakType }: TrophyCaseProps) {
  const { data: achievements = [], isLoading } = useAchievements(userId, seasonId, wins, currentStreak, streakType);
  const earnedCount = achievements.filter((achievement) => achievement.earned).length;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">Trophy Case</h3>
        </div>
        {!isLoading && <span className="text-xs text-muted-foreground">{earnedCount}/{achievements.length} unlocked</span>}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">{[1,2,3,4,5,6].map((item)=><Skeleton key={item} className="h-24 rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              title={achievement.description}
              className={`rounded-xl border p-3 text-center transition-all ${achievement.earned ? 'border-primary/25 bg-primary/5' : 'border-border bg-muted/20 opacity-45 grayscale'}`}
            >
              <div className="text-2xl">{achievement.earned ? achievement.emoji : '🔒'}</div>
              <p className="text-[11px] font-semibold mt-2 leading-tight">{achievement.name}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
