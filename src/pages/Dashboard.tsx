import { motion } from 'framer-motion';
import { MatchupCard } from '@/components/MatchupCard';
import { QuickStats } from '@/components/StatsGrid';
import { TaskCard } from '@/components/TaskCard';
import { currentMatchup, tasks, currentLeague, currentUser, opponent } from '@/lib/mockData';
import { ChevronRight, Zap, Bell, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useTasksWithCheckins } from '@/hooks/useTasksWithCheckins';
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
  const { data: leagueDetails, isLoading } = useUserPrimaryLeague();
  
  // Determine if we have a real league
  const hasLeague = !!leagueDetails;
  const hasActiveSeason = hasLeague && leagueDetails.current_season?.status === 'active';
  
  // Fetch real tasks only when we have an active season
  const seasonId = hasActiveSeason ? leagueDetails.current_season?.id : undefined;
  const { data: realTasks = [] } = useTasksWithCheckins(seasonId, new Date());

  // Show loading state
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // === DATA TRANSFORMATION LAYER ===
  
  // League info
  const displayLeague = hasLeague ? {
    name: leagueDetails.name,
    week: leagueDetails.current_week?.week_number ?? 1,
    season: leagueDetails.current_season?.season_number ?? 1,
  } : {
    name: currentLeague.name,
    week: currentLeague.week,
    season: currentLeague.season,
  };

  // Find current user and opponent from members
  const currentMember = leagueDetails?.members.find(m => m.user_id === user?.id);
  const opponentMember = leagueDetails?.members.find(m => m.user_id !== user?.id);
  const totalMembers = leagueDetails?.members.length ?? 6;

  // User data
  const displayUser: User = hasLeague && currentMember ? {
    id: currentMember.user_id,
    username: 'You',
    avatar: currentMember.display_name?.charAt(0).toUpperCase() ?? '🏆',
    weeklyScore: currentMember.weekly_points,
    seasonScore: currentMember.total_points,
    wins: currentMember.wins,
    losses: currentMember.losses,
    streak: currentMember.current_streak,
    rank: currentMember.current_rank ?? 1,
  } : currentUser;

  // Opponent data
  const displayOpponent: User = hasLeague && opponentMember ? {
    id: opponentMember.user_id,
    username: opponentMember.display_name ?? 'Opponent',
    avatar: opponentMember.display_name?.charAt(0).toUpperCase() ?? '⚡',
    weeklyScore: opponentMember.weekly_points,
    seasonScore: opponentMember.total_points,
    wins: opponentMember.wins,
    losses: opponentMember.losses,
    streak: opponentMember.current_streak,
    rank: opponentMember.current_rank ?? 2,
  } : opponent;

  // Matchup data
  const displayMatchup: Matchup = hasLeague && opponentMember ? {
    id: 'real-matchup',
    week: leagueDetails.current_week?.week_number ?? 1,
    user: displayUser,
    opponent: displayOpponent,
    userScore: currentMember?.weekly_points ?? 0,
    opponentScore: opponentMember.weekly_points,
    status: 'in_progress' as const,
  } : currentMatchup;

  // Transform real tasks to mock format
  const transformedTasks: Task[] = realTasks.map(task => {
    const config = task.config as { target?: number; max_points?: number; points_per_unit?: number } | null;
    const target = config?.target ?? 1;
    const numericValue = task.todayCheckin?.numeric_value;
    const booleanValue = task.todayCheckin?.boolean_value;
    const currentValue = numericValue ?? (booleanValue ? 1 : 0);
    
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

  // Use real tasks if available, otherwise mock
  const displayTasks = hasActiveSeason && transformedTasks.length > 0 ? transformedTasks : tasks;
  const todayTasks = displayTasks.slice(0, 3);
  const completedCount = displayTasks.filter(t => t.completed).length;

  // Check if we should show matchup or invite prompt
  const showMatchup = !hasLeague || totalMembers > 1;

  // Stats for QuickStats
  const statsProps = hasLeague && currentMember ? {
    rank: currentMember.current_rank ?? 1,
    totalMembers,
    weeklyScore: currentMember.weekly_points,
    streak: currentMember.current_streak,
    seasonPoints: currentMember.total_points,
    weekNumber: leagueDetails.current_week?.week_number ?? 1,
    weeksCount: leagueDetails.current_season?.weeks_count ?? 8,
  } : undefined;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Week {displayLeague.week} • Season {displayLeague.season}
            </p>
            <h1 className="font-display font-bold text-lg">{displayLeague.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <Bell className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-lg">
              {displayUser.avatar}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Current Matchup or Invite Prompt */}
        <section>
          {showMatchup ? (
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
                  <p className="font-semibold text-sm">Invite Opponents</p>
                  <p className="text-xs text-muted-foreground">
                    Share code: {leagueDetails?.invite_code ?? 'N/A'}
                  </p>
                </div>
                <button 
                  onClick={() => navigate('/league')}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Invite
                </button>
              </div>
            </motion.div>
          )}
        </section>

        {/* Quick Stats */}
        <section>
          <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
            Your Stats
          </h2>
          <QuickStats {...statsProps} />
        </section>

        {/* Today's Tasks */}
        <section>
          <div 
            className="flex items-center justify-between mb-3 cursor-pointer"
            onClick={() => navigate('/tasks')}
          >
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Today's Tasks
              </h2>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                {completedCount}/{displayTasks.length}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {todayTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
          {displayTasks.length > 3 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/tasks')}
              className="w-full mt-3 py-3 rounded-xl bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              View all {displayTasks.length} tasks
            </motion.button>
          )}
        </section>

        {/* Power-up Hint */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-2xl bg-gradient-to-r from-secondary/20 to-accent/20 border border-secondary/30"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">2x Multiplier Available</p>
              <p className="text-xs text-muted-foreground">Use it on any task before Sunday</p>
            </div>
            <button className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold">
              Use
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
