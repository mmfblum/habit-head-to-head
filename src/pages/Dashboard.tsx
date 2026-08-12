import { motion } from 'framer-motion';
import { MatchupCard } from '@/components/MatchupCard';
import { QuickStats } from '@/components/StatsGrid';
import { TaskCard } from '@/components/TaskCard';
import { LeaderboardRaceCard } from '@/components/leaderboard/LeaderboardRaceCard';
import { CheckCircle2, ChevronRight, Zap, Bell, UserPlus, Trophy, Target, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useTasksWithCheckins } from '@/hooks/useTasksWithCheckins';
import { useCurrentMatchup } from '@/hooks/useCurrentMatchup';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { getCompetitionWeekPhase, formatWeekKickoff } from '@/lib/competition';
import { isTaskGoalMet } from '@/lib/taskProgress';
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
      <main className="px-4 py-4 space-y-5">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}
        </div>
      </main>
    </div>
  );
}

function Avatar({ value, alt }: { value: string; alt: string }) {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return <img src={value} alt={alt} className="w-full h-full object-cover" />;
  }
  return <span>{value}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: leagueDetails, isLoading: leagueLoading } = useUserPrimaryLeague();
  const { data: notifications = [] } = useNotifications();

  const isLeaderboard = leagueDetails?.game_format === 'leaderboard';
  const currentWeek = leagueDetails?.current_week;
  const weekPhase = getCompetitionWeekPhase(currentWeek?.start_date, currentWeek?.end_date);
  const { data: scheduledMatchup, isLoading: matchupLoading } = useCurrentMatchup(
    isLeaderboard ? undefined : currentWeek?.id
  );

  const hasActiveSeason = leagueDetails?.current_season?.status === 'active';
  const isLiveWeek = hasActiveSeason && weekPhase === 'live';
  const seasonId = isLiveWeek ? leagueDetails?.current_season?.id : undefined;
  const { data: realTasks = [], isLoading: tasksLoading } = useTasksWithCheckins(seasonId, new Date());
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  if (leagueLoading || (!isLeaderboard && matchupLoading)) return <DashboardSkeleton />;
  if (!leagueDetails) return <DashboardSkeleton />;

  const currentMember = leagueDetails.members.find((member) => member.user_id === user?.id);
  const opponentId = scheduledMatchup
    ? scheduledMatchup.user1_id === user?.id
      ? scheduledMatchup.user2_id
      : scheduledMatchup.user1_id
    : undefined;
  const opponentMember = leagueDetails.members.find((member) => member.user_id === opponentId);
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

  const scheduledUserScore = scheduledMatchup
    ? scheduledMatchup.user1_id === user?.id
      ? scheduledMatchup.user1_score
      : scheduledMatchup.user2_score
    : 0;
  const scheduledOpponentScore = scheduledMatchup
    ? scheduledMatchup.user1_id === user?.id
      ? scheduledMatchup.user2_score
      : scheduledMatchup.user1_score
    : 0;

  const displayMatchup: Matchup | null = scheduledMatchup && displayOpponent ? {
    id: scheduledMatchup.id,
    week: currentWeek?.week_number ?? 1,
    user: displayUser,
    opponent: displayOpponent,
    userScore: scheduledUserScore,
    opponentScore: scheduledOpponentScore,
    status: scheduledMatchup.status === 'completed'
      ? 'completed'
      : scheduledMatchup.status === 'scheduled'
        ? 'upcoming'
        : 'in_progress',
  } : null;

  const transformedTasks: Task[] = realTasks.map((task) => {
    const config = task.config as {
      target?: number;
      threshold?: number;
      daily_limit_minutes?: number;
      max_points?: number;
      daily_cap?: number;
      points_per_unit?: number;
      custom_description?: string;
    } | null;
    const target = config?.daily_limit_minutes ?? config?.target ?? config?.threshold ?? 1;
    const numericValue = task.todayCheckin?.numeric_value;
    const durationValue = task.todayCheckin?.duration_minutes;
    const booleanValue = task.todayCheckin?.boolean_value;
    const currentValue = numericValue ?? durationValue ?? (booleanValue ? 1 : 0);

    return {
      id: task.id,
      name: task.task_name,
      icon: TASK_ICONS[task.template?.icon ?? 'activity'] ?? '📊',
      description: config?.custom_description ?? task.template?.description ?? '',
      type: 'custom' as const,
      target,
      unit: task.template?.unit ?? 'count',
      pointsPerUnit: config?.points_per_unit ?? 1,
      maxPoints: config?.max_points ?? config?.daily_cap ?? 100,
      currentValue,
      completed: isTaskGoalMet(task),
      streakDays: 0,
    };
  });

  const todayTasks = transformedTasks.slice(0, 3);
  const completedCount = transformedTasks.filter((task) => task.completed).length;
  const nextTask = transformedTasks.find((task) => !task.completed);

  const weeklySorted = [...leagueDetails.members].sort((a, b) => b.weekly_points - a.weekly_points);
  const currentWeeklyIndex = weeklySorted.findIndex((member) => member.user_id === user?.id);
  const weeklyRank = currentWeeklyIndex >= 0
    ? weeklySorted.findIndex((member) => member.weekly_points === weeklySorted[currentWeeklyIndex].weekly_points) + 1
    : undefined;

  const statsProps = {
    rank: currentMember?.current_rank ?? 1,
    totalMembers: Math.max(totalMembers, 1),
    weeklyScore: scheduledMatchup ? scheduledUserScore : currentMember?.weekly_points ?? 0,
    wins: currentMember?.wins ?? 0,
    losses: currentMember?.losses ?? 0,
    ties: currentMember?.ties ?? 0,
    streak: currentMember?.current_streak ?? 0,
    streakType: currentMember?.streak_type,
    weekNumber: currentWeek?.week_number ?? 1,
    weeksCount: leagueDetails.current_season?.weeks_count ?? 1,
  };

  const headerEyebrow = !leagueDetails.current_season
    ? 'League setup'
    : hasActiveSeason && weekPhase === 'scheduled' && currentWeek
      ? `Week ${currentWeek.week_number} starts ${formatWeekKickoff(currentWeek.start_date)} • Season ${leagueDetails.current_season.season_number}`
      : `Week ${currentWeek?.week_number ?? 1} • Season ${leagueDetails.current_season.season_number}`;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">{headerEyebrow}</p>
            <h1 className="font-display font-bold text-lg">{leagueDetails.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/notifications')}
              className="relative w-9 h-9 rounded-full bg-muted flex items-center justify-center"
              aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-loss text-loss-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-lg overflow-hidden"
              aria-label="Profile"
            >
              <Avatar value={displayUser.avatar} alt={displayUser.username} />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-5">
        <section>
          {isLeaderboard && currentWeek ? (
            <LeaderboardRaceCard
              members={leagueDetails.members}
              currentUserId={user?.id}
              weekNumber={currentWeek.week_number}
              onOpen={() => navigate('/league')}
            />
          ) : displayMatchup ? (
            <MatchupCard
              matchup={displayMatchup}
              compact
              weekStartDate={currentWeek?.start_date}
              weekEndDate={currentWeek?.end_date}
              onClick={() => navigate('/matchup')}
            />
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
                  <p className="font-semibold text-sm">{totalMembers > 1 ? 'Bye Week' : 'Invite Opponents'}</p>
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

        {isLiveWeek && transformedTasks.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => navigate('/tasks')}
            className={`w-full p-4 rounded-xl border text-left flex items-center gap-3 ${
              nextTask ? 'bg-secondary/10 border-secondary/25' : 'bg-primary/10 border-primary/25'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${nextTask ? 'bg-secondary/20' : 'bg-primary/20'}`}>
              {nextTask ? <Zap className="w-5 h-5 text-secondary" /> : <CheckCircle2 className="w-5 h-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{nextTask ? 'Make a move' : 'Perfect day'}</p>
              <p className="font-semibold text-sm truncate">{nextTask ? `Score ${nextTask.name}` : 'Every goal is scored'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {nextTask
                  ? `${transformedTasks.length - completedCount} scoring chance${transformedTasks.length - completedCount === 1 ? '' : 's'} left today`
                  : `${completedCount}/${transformedTasks.length} goals hit today`}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.button>
        )}

        <section>
          <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => navigate('/tasks')}>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Today's Scorecard</h2>
              {isLiveWeek && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                  {completedCount}/{transformedTasks.length}
                </span>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>

          {tasksLoading && isLiveWeek ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 rounded-xl" />)}
            </div>
          ) : todayTasks.length > 0 ? (
            <div className="space-y-3">
              {todayTasks.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          ) : (
            <button onClick={() => navigate('/tasks')} className="w-full p-5 rounded-xl bg-muted/40 text-left">
              <p className="font-semibold text-sm">
                {hasActiveSeason && weekPhase === 'scheduled'
                  ? `Check-ins unlock ${formatWeekKickoff(currentWeek?.start_date)}`
                  : isLiveWeek ? 'No tasks configured' : 'Season not active yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveSeason && weekPhase === 'scheduled'
                  ? isLeaderboard
                    ? 'The leaderboard opens Sunday. Everyone starts the week at zero.'
                    : 'Your matchup is set. Week 1 begins on Sunday.'
                  : isLiveWeek ? 'Open Tasks to review your league setup.' : 'Finish league setup to begin earning points.'}
              </p>
            </button>
          )}

          {transformedTasks.length > 3 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/tasks')}
              className="w-full mt-3 py-3 rounded-xl bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              View all {transformedTasks.length} scoring tasks
            </motion.button>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Season Snapshot</h2>
            <button onClick={() => navigate('/league')} className="text-xs text-primary font-medium">Standings</button>
          </div>
          {isLeaderboard ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="card-elevated rounded-xl p-4">
                <Trophy className="w-4 h-4 text-pending mb-2" />
                <p className="score-text text-2xl">{currentMember?.current_rank ? `#${currentMember.current_rank}` : '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">Season rank</p>
              </div>
              <div className="card-elevated rounded-xl p-4">
                <Target className="w-4 h-4 text-primary mb-2" />
                <p className="score-text text-2xl">{weeklyRank ? `#${weeklyRank}` : '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">This week</p>
              </div>
              <div className="card-elevated rounded-xl p-4">
                <Zap className="w-4 h-4 text-secondary mb-2" />
                <p className="score-text text-2xl">{(currentMember?.weekly_points ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Week points</p>
              </div>
              <div className="card-elevated rounded-xl p-4">
                <CalendarDays className="w-4 h-4 text-muted-foreground mb-2" />
                <p className="score-text text-2xl">{(currentMember?.total_points ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Season points</p>
              </div>
            </div>
          ) : (
            <QuickStats {...statsProps} />
          )}
        </section>

        {!isLeaderboard && displayMatchup && scheduledMatchup?.status === 'in_progress' && currentWeek && (
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
                <p className="text-xs text-muted-foreground">Choose your weekly boost before the clock runs out</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </motion.button>
        )}
      </main>
    </div>
  );
}
