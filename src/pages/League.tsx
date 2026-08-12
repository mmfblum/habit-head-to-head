import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import { useUserPrimaryLeague, LeagueMemberWithProfile } from '@/hooks/useLeagueDetails';
import { useWeekMatchups } from '@/hooks/useCurrentMatchup';
import { useIsLeagueAdmin } from '@/hooks/useLeagueTaskConfigs';
import { useStartSeason } from '@/hooks/useSeasonActions';
import { useAuth } from '@/hooks/useAuth';
import { Trophy, Share2, Settings, Swords, Loader2, Zap, Play, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ManageTasksDialog } from '@/components/league/ManageTasksDialog';
import { InitialTaskSetupDialog } from '@/components/league/InitialTaskSetupDialog';
import { useLeagueTaskConfigs } from '@/hooks/useLeagueTaskConfigs';
import { addDays, format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function League() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: league, isLoading, error, leagueId } = useUserPrimaryLeague();
  const { data: isAdmin } = useIsLeagueAdmin(leagueId);
  const [showManageTasks, setShowManageTasks] = useState(false);
  const [showInitialSetup, setShowInitialSetup] = useState(false);
  const startSeason = useStartSeason();

  const currentSeasonId = league?.current_season?.id;
  const { data: taskConfigs } = useLeagueTaskConfigs(currentSeasonId);
  const { data: weekMatchups = [] } = useWeekMatchups(
    league?.current_season?.status === 'active' ? league?.current_week?.id : undefined
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold mb-2">No League Found</h2>
          <p className="text-muted-foreground">Join or create a league to get started.</p>
        </div>
      </div>
    );
  }

  const currentSeason = league.current_season;
  const currentWeek = league.current_week;
  const isDraft = currentSeason?.status === 'draft';
  const isActive = currentSeason?.status === 'active';
  const enabledTaskCount = taskConfigs?.filter(config => config.is_enabled).length ?? 0;

  const sortedMembers = [...league.members].sort((a, b) =>
    (a.current_rank ?? 999) - (b.current_rank ?? 999) ||
    b.wins - a.wins ||
    b.ties - a.ties ||
    b.total_points - a.total_points
  );
  const weeklySorted = [...league.members].sort((a, b) => b.weekly_points - a.weekly_points);
  const lowestScorer = weeklySorted.length > 1 ? weeklySorted[weeklySorted.length - 1] : undefined;

  const scheduledIds = new Set(weekMatchups.flatMap(m => [m.user1_id, m.user2_id]));
  const byeMember = league.members.length > 1
    ? league.members.find(member => !scheduledIds.has(member.user_id))
    : undefined;

  const nextWeekStart = currentWeek
    ? format(addDays(parseISO(currentWeek.end_date), 1), 'MMM d')
    : undefined;

  const copyInviteCode = () => {
    if (league.invite_code) {
      navigator.clipboard.writeText(league.invite_code);
      toast.success('Invite code copied!');
    }
  };

  const getDefaultAvatar = (rank: number) => {
    const avatars = ['🏆', '⚡', '🔥', '💪', '🌟', '😤', '🎯', '🚀', '💫', '🎮'];
    return avatars[rank % avatars.length];
  };

  const renderAvatar = (member?: LeagueMemberWithProfile, rank = 0) => {
    if (member?.avatar_url) {
      return <img src={member.avatar_url} alt={member.display_name || 'Player'} className="w-full h-full object-cover" />;
    }
    return <span>{member?.display_name?.charAt(0).toUpperCase() || getDefaultAvatar(rank)}</span>;
  };

  const memberToUser = (member: LeagueMemberWithProfile, rank: number) => ({
    id: member.user_id,
    username: member.display_name || 'Unknown',
    avatar: member.avatar_url || member.display_name?.charAt(0).toUpperCase() || getDefaultAvatar(rank),
    weeklyScore: member.weekly_points,
    seasonScore: member.total_points,
    wins: member.wins,
    losses: member.losses,
    ties: member.ties,
    streak: member.current_streak,
    streakType: member.streak_type,
    rank: member.current_rank || rank + 1,
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {!currentSeason
                  ? 'No season'
                  : isDraft
                    ? `Season ${currentSeason.season_number} • Preseason`
                    : `Season ${currentSeason.season_number}${currentWeek ? ` • Week ${currentWeek.week_number}` : ''}`}
              </p>
              <h1 className="font-display font-bold text-xl">{league.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copyInviteCode} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center" aria-label="Share league code">
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
              {isAdmin && currentSeason && (
                <button onClick={() => setShowManageTasks(true)} className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors" aria-label="League settings">
                  <Settings className="w-4 h-4 text-primary" />
                </button>
              )}
            </div>
          </div>

          {league.invite_code && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Invite Code:</span>
              <button onClick={copyInviteCode}>
                <code className="px-2 py-1 bg-muted rounded text-xs font-mono hover:bg-muted/80 transition-colors">
                  {league.invite_code}
                </code>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {!currentSeason && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-elevated rounded-xl p-6 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display font-semibold mb-2">Season Not Set Up</h3>
            <p className="text-sm text-muted-foreground">The league admin needs to create the first season.</p>
          </motion.section>
        )}

        {isDraft && isAdmin && enabledTaskCount === 0 && currentSeason && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-2 border-dashed border-primary/50 bg-primary/5">
              <CardContent className="py-6 text-center">
                <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="font-display font-bold text-lg mb-2">Set Your League Rules</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Choose the tasks and scoring rules first. Week 1 will not begin until you explicitly kick off the season.
                </p>
                <Button onClick={() => setShowInitialSetup(true)} size="lg">
                  <Zap className="w-4 h-4 mr-2" />
                  Configure League Rules
                </Button>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {isDraft && enabledTaskCount >= 3 && currentSeason && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/5">
              <CardContent className="py-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                    <Play className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Preseason</p>
                    <h3 className="font-display font-bold text-lg mt-0.5">Ready for kickoff</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {league.members.length < 2
                        ? 'Your rules are set. Invite at least one opponent before Week 1 can begin.'
                        : `${league.members.length} players are in. Starting now will lock in the schedule and make today Day 1 of Week 1.`}
                    </p>

                    <div className="flex items-center gap-2 mt-4">
                      {league.members.length < 2 ? (
                        <Button onClick={copyInviteCode} className="gap-2">
                          <Users className="w-4 h-4" />
                          Copy Invite Code
                        </Button>
                      ) : isAdmin ? (
                        <Button
                          onClick={() => startSeason.mutate(currentSeason.id)}
                          disabled={startSeason.isPending}
                          className="gap-2"
                        >
                          {startSeason.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                          {startSeason.isPending ? 'Starting...' : 'Start Season 1'}
                        </Button>
                      ) : (
                        <p className="text-sm text-muted-foreground">Waiting for the commissioner to start the season.</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {isActive && currentWeek && weekMatchups.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Swords className="w-4 h-4 text-secondary" />
              <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Week {currentWeek.week_number} Matchups
              </h2>
            </div>
            <div className="card-elevated rounded-xl overflow-hidden divide-y divide-border">
              {weekMatchups.map((matchup, index) => {
                const user1 = league.members.find(m => m.user_id === matchup.user1_id);
                const user2 = league.members.find(m => m.user_id === matchup.user2_id);
                const isMyGame = matchup.user1_id === user?.id || matchup.user2_id === user?.id;
                const isFinal = matchup.status === 'completed';
                const user1Won = isFinal && matchup.user1_score > matchup.user2_score;
                const user2Won = isFinal && matchup.user2_score > matchup.user1_score;

                return (
                  <button
                    key={matchup.id}
                    onClick={() => isMyGame && navigate('/matchup')}
                    className={`w-full p-3 flex items-center gap-3 text-left ${isMyGame ? 'bg-primary/5 hover:bg-primary/10' : ''}`}
                    disabled={!isMyGame}
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {renderAvatar(user1, index * 2)}
                      </div>
                      <span className={`text-sm truncate ${user1Won ? 'font-bold text-primary' : 'font-medium'}`}>
                        {user1?.user_id === user?.id ? 'You' : user1?.display_name || 'Player'}
                      </span>
                    </div>
                    <div className="text-center shrink-0 min-w-[72px]">
                      <p className="score-text text-lg">{matchup.user1_score} – {matchup.user2_score}</p>
                      <p className={`text-[10px] uppercase tracking-wider ${isFinal ? 'text-muted-foreground' : 'text-pending'}`}>
                        {isFinal ? 'Final' : matchup.status === 'in_progress' ? 'Live' : 'Scheduled'}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
                      <span className={`text-sm truncate text-right ${user2Won ? 'font-bold text-primary' : 'font-medium'}`}>
                        {user2?.user_id === user?.id ? 'You' : user2?.display_name || 'Player'}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {renderAvatar(user2, index * 2 + 1)}
                      </div>
                    </div>
                  </button>
                );
              })}
              {byeMember && (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  {byeMember.user_id === user?.id ? 'You have' : `${byeMember.display_name} has`} the bye this week
                </div>
              )}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-pending" />
            <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {isActive ? 'Season Standings' : 'League Members'}
            </h2>
          </div>

          {sortedMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No members yet. Share the invite code to add members.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedMembers.map((member, index) => (
                <LeaderboardRow
                  key={member.id}
                  user={memberToUser(member, index)}
                  index={index}
                  isCurrentUser={member.user_id === user?.id}
                  isLowestScorer={isActive && sortedMembers.length > 1 && member.user_id === lowestScorer?.user_id}
                />
              ))}
            </div>
          )}
        </section>

        {isActive && currentSeason && currentWeek && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="card-elevated rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Season Progress</span>
              <span className="text-xs text-muted-foreground">
                Week {currentWeek.week_number} of {currentSeason.weeks_count}
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: currentSeason.weeks_count }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full ${
                    i < currentWeek.week_number - 1 ? 'bg-primary' :
                    i === currentWeek.week_number - 1 ? 'bg-primary/50 animate-pulse' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {Math.max(currentSeason.weeks_count - currentWeek.week_number, 0)} weeks remaining after this one
            </p>
          </motion.section>
        )}
      </main>

      {currentSeason && (
        <>
          <ManageTasksDialog
            open={showManageTasks}
            onOpenChange={setShowManageTasks}
            seasonId={currentSeason.id}
            nextWeekStart={nextWeekStart}
          />
          <InitialTaskSetupDialog
            open={showInitialSetup}
            onOpenChange={setShowInitialSetup}
            seasonId={currentSeason.id}
          />
        </>
      )}
    </div>
  );
}
