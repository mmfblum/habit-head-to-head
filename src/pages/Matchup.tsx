import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, TrendingUp, Activity, ListChecks, Clock } from 'lucide-react';
import { toast } from 'sonner';
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
import { formatWeekKickoff } from '@/lib/competition';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const QUICK_TAUNTS = [
  'Enjoy the lead while it lasts 👀',
  'Clock’s running. I’m coming for you.',
  'Hope you saved something for the fourth quarter.',
  'See you at the finish line. 🏁',
];

export default function Matchup() {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: leagueDetails, isLoading: leagueLoading } = useUserPrimaryLeague();
  const [tauntOpen, setTauntOpen] = useState(false);
  const [customTaunt, setCustomTaunt] = useState('');

  const currentWeek = leagueDetails?.current_week;
  const members = leagueDetails?.members || [];
  const currentMember = members.find(m => m.user_id === authUser?.id);

  const { data: scheduledMatchup, isLoading: matchupLoading } = useCurrentMatchup(currentWeek?.id);
  const opponentId = scheduledMatchup
    ? scheduledMatchup.user1_id === authUser?.id
      ? scheduledMatchup.user2_id
      : scheduledMatchup.user1_id
    : undefined;
  const opponent = members.find(m => m.user_id === opponentId);

  const userIds = [currentMember?.user_id, opponent?.user_id].filter(Boolean) as string[];
  const isLiveGame = scheduledMatchup?.status === 'in_progress';
  const isFinal = scheduledMatchup?.status === 'completed';
  const isScheduled = scheduledMatchup?.status === 'scheduled';
  const canShowGameData = isLiveGame || isFinal;

  const { data: scoresMap, isLoading: scoresLoading } = useMatchupScores(currentWeek?.id, userIds);

  const { data: activityEvents, isLoading: activityLoading, setIsAtTop } = useMatchupActivity({
    weekId: canShowGameData ? currentWeek?.id : undefined,
    userIds,
    enabled: canShowGameData && !!currentWeek?.id && userIds.length === 2,
  });

  const { data: taskBreakdown, isLoading: tasksLoading } = useTaskBreakdown({
    seasonId: canShowGameData ? leagueDetails?.current_season?.id : undefined,
    weekId: canShowGameData ? currentWeek?.id : undefined,
    userId: currentMember?.user_id,
    opponentId: opponent?.user_id,
  });

  const userScore = scoresMap?.get(currentMember?.user_id || '') || 0;
  const opponentScore = scoresMap?.get(opponent?.user_id || '') || 0;
  const scoreDiffSigned = userScore - opponentScore;
  const scoreDiff = Math.abs(scoreDiffSigned);
  const isWinning = scoreDiffSigned > 0;
  const isTied = scoreDiffSigned === 0;

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

  const swingTasks = [...(taskBreakdown || [])]
    .sort((a, b) => {
      const aBehind = a.opponent_points - a.user_points;
      const bBehind = b.opponent_points - b.user_points;
      return bBehind - aBehind || b.max_points - a.max_points;
    })
    .slice(0, 2)
    .map(task => task.task_name);

  useDailyMatchupNotifications({
    leagueId: isLiveGame ? leagueDetails?.id : undefined,
    opponentName: opponent?.display_name ?? 'Opponent',
    scoreLine: `${userScore}-${opponentScore} ${isWinning ? 'you lead' : isTied ? 'tied' : 'you trail'}.`,
    swingTasks,
  });

  const sendTaunt = useMutation({
    mutationFn: async (body: string) => {
      if (!scheduledMatchup?.id || !isLiveGame) throw new Error('Taunts open when the matchup goes live');
      const { error } = await supabase.rpc(
        'send_matchup_taunt' as never,
        {
          _matchup_id: scheduledMatchup.id,
          _body: body,
        } as never
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setTauntOpen(false);
      setCustomTaunt('');
      toast.success('Taunt sent');
      queryClient.invalidateQueries({ queryKey: ['league-events', leagueDetails?.id] });
    },
    onError: (error: Error) => toast.error(error.message || 'Could not send taunt'),
  });

  const isLoading = leagueLoading || matchupLoading || scoresLoading;

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
          <h2 className="text-xl font-bold mb-2">{hasEnoughMembers ? 'No Matchup This Week' : 'Invite an Opponent'}</h2>
          <p className="text-muted-foreground text-sm">
            {hasEnoughMembers
              ? 'You have a bye this week. Keep scoring for season points and get ready for your next opponent.'
              : 'Head-to-head competition starts once another player joins your league.'}
          </p>
        </div>
      </div>
    );
  }

  const battleHeadline = isScheduled
    ? `Kickoff ${formatWeekKickoff(currentWeek.start_date)}`
    : isFinal
      ? isTied ? 'Final: tie game' : isWinning ? 'Win secured' : 'Final whistle'
      : isTied ? 'Dead even' : isWinning ? 'Protect the lead' : 'Time to make a run';

  const battleSubtext = isScheduled
    ? `Your Week ${currentWeek.week_number} opponent is set. Check-ins and power plays unlock at kickoff.`
    : isFinal
      ? isTied ? `You both finished on ${userScore} points.` : `${scoreDiff} point ${isWinning ? 'win' : 'loss'}.`
      : isTied ? `${userScore}-${opponentScore}. One task can swing it.` : `${scoreDiff} point${scoreDiff !== 1 ? 's' : ''} ${isWinning ? 'ahead' : 'behind'}.`;

  return (
    <div className="min-h-screen bg-background pb-24">
      <MatchupScoreboard
        user={userParticipant}
        opponent={opponentParticipant}
        weekNumber={currentWeek.week_number}
        weekStartDate={currentWeek.start_date}
        weekEndDate={currentWeek.end_date}
        status={scheduledMatchup.status}
      />

      <main className="px-4 py-4 space-y-5">
        <section className="card-elevated rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                isScheduled ? 'bg-secondary/20' : isFinal ? 'bg-muted' : isWinning ? 'bg-primary/20' : isTied ? 'bg-secondary/20' : 'bg-loss/20'
              }`}>
                {isScheduled ? <Clock className="w-5 h-5 text-secondary" /> : isFinal ? (isWinning ? '🏆' : isTied ? '🤝' : '🏁') : isWinning ? '🛡️' : isTied ? '⚖️' : '⚔️'}
              </div>
              <div>
                <p className="font-semibold text-sm">{battleHeadline}</p>
                <p className="text-xs text-muted-foreground">{battleSubtext}</p>
              </div>
            </div>
            {isLiveGame && (
              <div className="flex items-center gap-1">
                <TrendingUp className={`w-4 h-4 ${isWinning ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">vs {opponentParticipant.display_name}</span>
              </div>
            )}
          </div>
        </section>

        {isLiveGame && (
          <div className="grid grid-cols-2 gap-3">
            <PowerUpButton weekId={currentWeek.id} />
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setTauntOpen(true)}
              className="p-4 rounded-xl bg-muted flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5 text-secondary" />
              <span className="font-semibold text-sm">Send Taunt</span>
            </motion.button>
          </div>
        )}

        {canShowGameData && (
          <Tabs defaultValue="activity" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="activity" className="flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                <span>{isFinal ? 'Game Activity' : 'Live Activity'}</span>
                {activityEvents && activityEvents.length > 0 && (
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-1">{activityEvents.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-1.5">
                <ListChecks className="w-4 h-4" />
                <span>Task Battle</span>
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
        )}
      </main>

      <Dialog open={tauntOpen} onOpenChange={setTauntOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Send a taunt</DialogTitle>
            <DialogDescription>
              Keep it competitive. {opponentParticipant.display_name} will get an in-app notification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {QUICK_TAUNTS.map(taunt => (
              <button
                key={taunt}
                onClick={() => sendTaunt.mutate(taunt)}
                disabled={sendTaunt.isPending}
                className="w-full p-3 rounded-xl bg-muted hover:bg-secondary/15 text-left text-sm transition-colors"
              >
                {taunt}
              </button>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <Textarea
              value={customTaunt}
              onChange={event => setCustomTaunt(event.target.value.slice(0, 160))}
              placeholder="Write your own…"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{customTaunt.length}/160</span>
              <Button
                onClick={() => sendTaunt.mutate(customTaunt.trim())}
                disabled={!customTaunt.trim() || sendTaunt.isPending}
              >
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
