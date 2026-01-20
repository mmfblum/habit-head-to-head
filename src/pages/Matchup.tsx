import { motion } from 'framer-motion';
import { MessageCircle, TrendingUp, Activity, ListChecks } from 'lucide-react';
import { MatchupScoreboard } from '@/components/matchup/MatchupScoreboard';
import { ActivityFeed } from '@/components/matchup/ActivityFeed';
import { TaskBreakdown } from '@/components/matchup/TaskBreakdown';
import { PowerUpButton } from '@/components/matchup/PowerUpSelector';
import { useMatchupActivity, useMatchupScores } from '@/hooks/useMatchupActivity';
import { useTaskBreakdown } from '@/hooks/useTaskBreakdown';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Matchup() {
  const { user: authUser } = useAuth();
  const { data: leagueDetails, isLoading: leagueLoading } = useUserPrimaryLeague();

  // Get current week and members
  const currentWeek = leagueDetails?.current_week;
  const members = leagueDetails?.members || [];
  
  // For now, pick the first other member as opponent (can be enhanced with matchups table later)
  const currentMember = members.find(m => m.user_id === authUser?.id);
  const opponent = members.find(m => m.user_id !== authUser?.id);

  const userIds = [currentMember?.user_id, opponent?.user_id].filter(Boolean) as string[];

  // Real-time scores
  const { data: scoresMap, isLoading: scoresLoading } = useMatchupScores(
    currentWeek?.id,
    userIds
  );

  // Real-time activity feed
  const { data: activityEvents, isLoading: activityLoading, setIsAtTop } = useMatchupActivity({
    weekId: currentWeek?.id,
    userIds,
    enabled: !!currentWeek?.id && userIds.length === 2,
  });

  // Task breakdown comparison
  const { data: taskBreakdown, isLoading: tasksLoading } = useTaskBreakdown({
    seasonId: leagueDetails?.current_season?.id,
    weekId: currentWeek?.id,
    userId: currentMember?.user_id,
    opponentId: opponent?.user_id,
  });

  // Build participant data
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

  const isLoading = leagueLoading || scoresLoading;
  const isWinning = userScore > opponentScore;
  const scoreDiff = Math.abs(userScore - opponentScore);

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

  if (!currentWeek || !opponent) {
    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">🏟️</div>
          <h2 className="text-xl font-bold mb-2">No Active Matchup</h2>
          <p className="text-muted-foreground text-sm">
            Wait for the season to start or for matchups to be generated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Scoreboard Header */}
      <MatchupScoreboard
        user={userParticipant}
        opponent={opponentParticipant}
        weekNumber={currentWeek.week_number}
        weekEndDate={currentWeek.end_date}
        isLive={!currentWeek.is_locked}
      />

      <main className="px-4 py-4 space-y-6">
        {/* Tabbed content: Activity & Tasks */}
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

        {/* Quick Actions */}
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

        {/* Head-to-head summary */}
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
          
          {/* Score progress bar */}
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
