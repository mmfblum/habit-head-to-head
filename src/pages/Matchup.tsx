import { motion } from 'framer-motion';
import { MessageCircle, TrendingUp, Activity, ListChecks } from 'lucide-react';
import { MatchupScoreboard } from '@/components/matchup/MatchupScoreboard';
import { ActivityFeed } from '@/components/matchup/ActivityFeed';
import { TaskBreakdown } from '@/components/matchup/TaskBreakdown';
import { PowerUpButton } from '@/components/matchup/PowerUpSelector';
import { useMatchupActivity, useMatchupScores } from '@/hooks/useMatchupActivity';
import { useTaskBreakdown } from '@/hooks/useTaskBreakdown';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useDailyMatchupNotifications } from '@/hooks/useNotifications';
import { useCurrentMatchup } from '@/hooks/useCurrentMatchup';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Matchup() {
  const { user: authUser } = useAuth();
  const { data: leagueDetails, isLoading: leagueLoading } = useUserPrimaryLeague();

  const currentWeek = leagueDetails?.current_week;
  const members = leagueDetails?.members || [];
  const currentMember = members.find(m => m.user_id === authUser?.id);

  // The schedule is the source of truth for this week's opponent. Never infer
  // an opponent from member ordering; that breaks in leagues with 3+ members.
  const { data: scheduledMatchup, isLoading: matchupLoading } = useCurrentMatchup(currentWeek?.id);
  const opponentId = scheduledMatchup
    ? scheduledMatchup.user1_id === authUser?.id
      ? scheduledMatchup.user2_id
      : scheduledMatchup.user1_id
    : undefined;
  const opponent = members.find(m => m.user_id === opponentId);

  const userIds = [currentMember?.user_id, opponent?.user_id].filter(Boolean) as string[];

  const { data: scoresMap, isLoading: scoresLoading } = useMatchupScores(
    currentWeek?.id,
    userIds
  );

  const { data: activityEvents, isLoading: activityLoading, setIsAtTop } = useMatchupActivity({
    weekId: currentWeek?.id,
    userIds,
    enabled: !!currentWeek?.id && userIds.length === 2,
  });

  const { data: taskBreakdown, isLoading: tasksLoading } = useTaskBreakdown({
    seasonId: leagueDetails?.current_season?.id,
    weekId: currentWeek?.id,
    userId: currentMember?.user_id,
    opponentId: opponent?.user_id,
  });

  const userScore = scoresMap?.get(currentMember?.user_id || '') || 0;
  const opponentScore = scoresMap?.get(opponent?.user_id || '') || 0;

  const userParticipant = {
    id: currentMember?.user_id || '',
    display_name: currentMember?.display_name || 'You',
    avatar_url: currentMember?.avatar_url || null,
    score: userScore,
  };

  const opponentParticipant = {
    id: opponent?.user_id || '',
    display_name: opponent?.display_name || 'Opponent',
    avatar_url: opponent?.avatar_url || null,
    score: opponentScore,
  };

  const isLoading = leagueLoading || matchupLoading || scoresLoading;
  const isWinning = userScore > opponentScore;
  const scoreDiff = Math.abs(userScore - opponentScore);

  useDailyMatchupNotifications({
    leagueId: leagueDetails?.id,
    opponentName: opponent?.display_name ?? 'Opponent',
    scoreLine: null,
    swingTasks: ['Steps', 'Workout'],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!currentWeek || !scheduledMatchup || !opponent || !currentMember) {
    const hasEnoughMembers = members.length > 1;

    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center">
        <div className="text-center p-8 max-w-sm">
          <div className="text-5xl mb-4">{hasEnoughMembers ? '🏟️' : '👥'}</div>
          <h2 className="text-xl font-bold mb-2">
            {hasEnoughMembers ? 'No Matchup This Week' : 'Invite an Opponent'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {hasEnoughMembers
              ? 'You may have a bye this week, or the season schedule is still being prepared.'
              : 'Head-to-head competition starts once another player joins your league.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <MatchupScoreboard
        user={userParticipant}
        opponent={opponentParticipant}
        weekNumber={currentWeek.week_number}
        weekEndDate={currentWeek.end_date}
        isLive={!currentWeek.is_locked && scheduledMatchup.status !== 'completed'}
      />

      <main className="px-4 py-4 space-y-6">
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="activity" className="flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              <span>Live Activity</span>
              {activityEvents && activityEvents.length > 0 && (
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-1">
                  {activityEvents.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-1.5">
              <ListChecks className="w-4 h-4" />
              <span>Task Breakdown</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-0">
            <div className="card-elevated rounded-xl p-3">
              <ActivityFeed
                events={activityEvents || []}
                currentUserId={authUser?.id}
                onScrollPositionChange={setIsAtTop}
                isLoading={activityLoading}
              />
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="mt-0">
            <TaskBreakdown
              tasks={taskBreakdown || []}
              opponentName={opponentParticipant.display_name}
              isLoading={tasksLoading}
            />
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-3">
          <PowerUpButton weekId={currentWeek.id} />
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="p-4 rounded-xl bg-muted flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold text-sm text-muted-foreground">Send Taunt</span>
          </motion.button>
        </div>

        <section className="card-elevated rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">This Week's Battle</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center text-lg
                ${isWinning ? 'bg-primary/20' : 'bg-loss/20'}
              `}>
                {isWinning ? '🏆' : '⚔️'}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {isWinning ? 'You\'re ahead!' : scoreDiff === 0 ? 'It\'s tied!' : 'Catch up!'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {scoreDiff} point{scoreDiff !== 1 ? 's' : ''} {isWinning ? 'lead' : scoreDiff === 0 ? '' : 'behind'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className={`w-4 h-4 ${isWinning ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">
                vs {opponentParticipant.display_name}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              <motion.div
                className="bg-gradient-primary"
                initial={{ width: 0 }}
                animate={{
                  width: `${userScore + opponentScore > 0
                    ? (userScore / (userScore + opponentScore)) * 100
                    : 50}%`
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              <motion.div
                className="bg-loss/60"
                initial={{ width: 0 }}
                animate={{
                  width: `${userScore + opponentScore > 0
                    ? (opponentScore / (userScore + opponentScore)) * 100
                    : 50}%`
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>You: {userScore} pts</span>
              <span>{opponentParticipant.display_name}: {opponentScore} pts</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
