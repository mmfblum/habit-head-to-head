import { motion } from 'framer-motion';
import { MatchupCard } from '@/components/MatchupCard';
import { QuickStats } from '@/components/StatsGrid';
import { TaskCard } from '@/components/TaskCard';
import { ChevronRight, Zap, Bell, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useTasksWithCheckins } from '@/hooks/useTasksWithCheckins';
import { useCurrentMatchup } from '@/hooks/useCurrentMatchup';
import { useAuth } from '@/hooks/useAuth';
import { TASK_ICONS } from '@/types/checkin';
import { Skeleton } from '@/components/ui/skeleton';
import type { User, Matchup, Task } from '@/lib/mockData';

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-9 h-9 rounded-full" />
          </div>
        </div>
      </header>
      <main className="px-4 py-4 space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: leagueDetails, isLoading: leagueLoading } = useUserPrimaryLeague();

  const currentWeek = leagueDetails?.current_week;
  const { data: scheduledMatchup, isLoading: matchupLoading } = useCurrentMatchup(currentWeek?.id);

  const hasActiveSeason = leagueDetails?.current_season?.status === 'active';
  const seasonId = hasActiveSeason ? leagueDetails?.current_season?.id : undefined;
  const { data: realTasks = [], isLoading: tasksLoading } = useTasksWithCheckins(seasonId, new Date());

  if (leagueLoading || matchupLoading) {
    return <DashboardSkeleton />;
  }

  if (!leagueDetails) {
    return <DashboardSkeleton />;
  }

  const currentMember = leagueDetails.members.find(m => m.user_id === user?.id);
  const opponentId = scheduledMatchup
    ? scheduledMatchup.user1_id === user?.id
      ? scheduledMatchup.user2_id
      : scheduledMatchup.user1_id
    : undefined;
  const opponentMember = leagueDetails.members.find(m => m.user_id === opponentId);
  const totalMembers = leagueDetails.members.length;

  const displayUser: User = {
    id: currentMember?.user_id ?? user?.id ?? '',
    username: currentMember?.display_name || 'You',
    avatar: currentMember?.avatar_url || currentMember?.display_name?.charAt(0).toUpperCase() || '🏆',
    weeklyScore: currentMember?.weekly_points ?? 0,
    seasonScore: currentMember?.total_points ?? 0,
    wins: currentMember?.wins ?? 0,
    losses: currentMember?.losses ?? 0,
    streak: currentMember?.current_streak ?? 0,
    rank: currentMember?.current_rank ?? 1,
  };

  const displayOpponent: User | null = opponentMember ? {
    id: opponentMember.user_id,
    username: opponentMember.display_name ?? 'Opponent',
    avatar: opponentMember.avatar_url || opponentMember.display_name?.charAt(0).toUpperCase() || '⚡',
    weeklyScore: opponentMember.weekly_points,
    seasonScore: opponentMember.total_points,
    wins: opponentMember.wins,
    losses: opponentMember.losses,
    streak: opponentMember.current_streak,
    rank: opponentMember.current_rank ?? 2,
  } : null;

  const displayMatchup: Matchup | null = scheduledMatchup && displayOpponent ? {
    id: scheduledMatchup.id,
    week: currentWeek?.week_number ?? 1,
    user: displayUser,
    opponent: displayOpponent,
    userScore: currentMember?.weekly_points ?? 0,
    opponentScore: opponentMember?.weekly_points ?? 0,
    status: scheduledMatchup.status === 'completed' ? 'completed' : 'in_progress',
  } : null;

  const transformedTasks: Task[] = realTasks.map(task => {
    const config = task.config as { target?: number; threshold?: number; max_points?: number; points_per_unit?: number } | null;
    const target = config?.target ?? config?.threshold ?? 1;
    const numericValue = task.todayCheckin?.numeric_value;
    const durationValue = task.todayCheckin?.duration_minutes;
    const booleanValue = task.todayCheckin?.boolean_value;
    const currentValue = numericValue ?? durationValue ?? (booleanValue ? 1 : 0);

    return {
      id: task.id,
      name: task.task_name,
      icon: TASK_ICONS[task.template?.icon ?? 'activity'] ?? '📊',
      description: task.template?.description ?? '',
      type: 'custom' as const,
      target,
      unit: task.template?.unit ?? 'count',
      pointsPerUnit: config?.points_per_unit ?? 1,
      maxPoints: config?.max_points ?? 100,
      currentValue,
      completed: !!task.todayCheckin?.boolean_value || currentValue >= target,
      streakDays: 0,
    };
  });

  const todayTasks = transformedTasks.slice(0, 3);
  const completedCount = transformedTasks.filter(t => t.completed).length;

  const statsProps = {
    rank: currentMember?.current_rank ?? 1,
    totalMembers: Math.max(totalMembers, 1),
    weeklyScore: currentMember?.weekly_points ?? 0,
    streak: currentMember?.current_streak ?? 0,
    seasonPoints: currentMember?.total_points ?? 0,
    weekNumber: currentWeek?.week_number ?? 1,
    weeksCount: leagueDetails.current_season?.weeks_count ?? 1,
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {leagueDetails.current_season
                ? `Week ${currentWeek?.week_number ?? 1} • Season ${leagueDetails.current_season.season_number}`
                : 'League setup'}
            </p>
            <h1 className="font-display font-bold text-lg">{leagueDetails.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/notifications')}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-lg overflow-hidden"
              aria-label="Profile"
            >
              {displayUser.avatar}
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        <section>
          {displayMatchup ? (
            <>
              <div
                className="flex items-center justify-between mb-3 cursor-pointer"
                onClick={() => navigate('/matchup')}
              >
                <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Current Matchup
                </h2>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <MatchupCard matchup={displayMatchup} compact />
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {totalMembers > 1 ? 'Bye Week' : 'Invite Opponents'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {totalMembers > 1
                      ? 'No head-to-head matchup is scheduled for you this week.'
                      : `Share code: ${leagueDetails.invite_code ?? 'N/A'}`}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/league')}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                >
                  {totalMembers > 1 ? 'League' : 'Invite'}
                </button>
              </div>
            </motion.div>
          )}
        </section>

        <section>
          <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
            Your Stats
          </h2>
          <QuickStats {...statsProps} />
        </section>

        <section>
          <div
            className="flex items-center justify-between mb-3 cursor-pointer"
            onClick={() => navigate('/tasks')}
          >
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Today's Tasks
              </h2>
              {hasActiveSeason && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                  {completedCount}/{transformedTasks.length}
                </span>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>

          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : todayTasks.length > 0 ? (
            <div className="space-y-3">
              {todayTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          ) : (
            <button
              onClick={() => navigate('/tasks')}
              className="w-full p-5 rounded-xl bg-muted/40 text-left"
            >
              <p className="font-semibold text-sm">
                {hasActiveSeason ? 'No tasks configured' : 'Season not active yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveSeason
                  ? 'Open Tasks to review your league setup.'
                  : 'Finish league setup to begin earning points.'}
              </p>
            </button>
          )}

          {transformedTasks.length > 3 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/tasks')}
              className="w-full mt-3 py-3 rounded-xl bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              View all {transformedTasks.length} tasks
            </motion.button>
          )}
        </section>

        {displayMatchup && currentWeek && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/matchup')}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-secondary/20 to-accent/20 border border-secondary/30 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Power Play</p>
                <p className="text-xs text-muted-foreground">Open your matchup to choose a weekly boost</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </motion.button>
        )}
      </main>
    </div>
  );
}
