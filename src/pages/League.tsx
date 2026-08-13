import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import { useUserPrimaryLeague, type LeagueMemberWithProfile } from '@/hooks/useLeagueDetails';
import { useWeekMatchups } from '@/hooks/useCurrentMatchup';
import { useIsLeagueAdmin } from '@/hooks/useLeagueTaskConfigs';
import { useStartSeason } from '@/hooks/useSeasonActions';
import { useAuth } from '@/hooks/useAuth';
import { getCompetitionWeekPhase, formatWeekKickoff } from '@/lib/competition';
import { Crown, ListOrdered, Trophy, Share2, Settings, Swords, Loader2, Zap, Play, Users, Clock } from 'lucide-react';
import { CreateLeagueWizard } from '@/components/league/CreateLeagueWizard';
import { LeagueSwitcher } from '@/components/league/LeagueSwitcher';
import { toast } from 'sonner';
import { ManageTasksDialog } from '@/components/league/ManageTasksDialog';
import { InitialTaskSetupDialog } from '@/components/league/InitialTaskSetupDialog';
import { useLeagueTaskConfigs } from '@/hooks/useLeagueTaskConfigs';
import { addDays, format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AccountabilityShareCard } from '@/components/solo/AccountabilityShareCard';
import { PunishmentSettingsCard } from '@/components/league/PunishmentSettingsCard';
import { LeaderboardConsequenceCard } from '@/components/leaderboard/LeaderboardConsequenceCard';

export default function League() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: league, isLoading, error, leagueId, memberships, selectLeague } = useUserPrimaryLeague();
  const { data: isAdmin } = useIsLeagueAdmin(leagueId);
  const [showManageTasks, setShowManageTasks] = useState(false);
  const [showInitialSetup, setShowInitialSetup] = useState(false);
  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const startSeason = useStartSeason();

  const currentSeasonId = league?.current_season?.id;
  const { data: taskConfigs } = useLeagueTaskConfigs(currentSeasonId);
  const currentWeek = league?.current_week;
  const weekPhase = getCompetitionWeekPhase(currentWeek?.start_date, currentWeek?.end_date);
  const isLeaderboard = league?.game_format === 'leaderboard';
  const isSolo = league?.game_format === 'solo';
  const isHeadToHead = league?.game_format === 'head_to_head';
  const { data: weekMatchups = [] } = useWeekMatchups(
    isHeadToHead && league?.current_season?.status === 'active' ? currentWeek?.id : undefined
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
        <div className="text-center max-w-sm">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold mb-2">No League Selected</h2>
          <p className="text-muted-foreground mb-5">Create a league or join one with an invite.</p>
          <Button onClick={() => setShowCreateLeague(true)}>Create League</Button>
        </div>
        {showCreateLeague && <CreateLeagueWizard onClose={() => setShowCreateLeague(false)} />}
      </div>
    );
  }

  const currentSeason = league.current_season;
  const isDraft = currentSeason?.status === 'draft';
  const isActive = currentSeason?.status === 'active';
  const isScheduledWeek = isActive && weekPhase === 'scheduled';
  const isLiveWeek = isActive && weekPhase === 'live';
  const enabledTaskCount = taskConfigs?.filter((config) => config.is_enabled).length ?? 0;

  const sortedMembers = [...league.members].sort((a, b) => {
    if (isLeaderboard) {
      return b.championship_points - a.championship_points || b.total_points - a.total_points || b.weekly_points - a.weekly_points;
    }
    return (
      (a.current_rank ?? 999) - (b.current_rank ?? 999) ||
      b.wins - a.wins ||
      b.ties - a.ties ||
      b.total_points - a.total_points
    );
  });
  const weeklySorted = [...league.members].sort((a, b) => b.weekly_points - a.weekly_points);
  const lowestScorer = isHeadToHead && isLiveWeek && weeklySorted.length > 1
    ? weeklySorted[weeklySorted.length - 1]
    : undefined;

  const scheduledIds = new Set(weekMatchups.flatMap((matchup) => [matchup.user1_id, matchup.user2_id]));
  const byeMember = isHeadToHead && league.members.length > 1
    ? league.members.find((member) => !scheduledIds.has(member.user_id))
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
      if (member.avatar_url.startsWith('http://') || member.avatar_url.startsWith('https://')) {
        return <img src={member.avatar_url} alt={member.display_name || 'Player'} className="w-full h-full object-cover" />;
      }
      return <span className="text-xl">{member.avatar_url}</span>;
    }
    return <span>{member?.display_name?.charAt(0).toUpperCase() || getDefaultAvatar(rank)}</span>;
  };

  const memberToUser = (member: LeagueMemberWithProfile, rank: number) => ({
    id: member.user_id,
    username: member.display_name || 'Unknown',
    avatar: member.avatar_url || member.display_name?.charAt(0).toUpperCase() || getDefaultAvatar(rank),
    weeklyScore: member.weekly_points,
    seasonScore: isLeaderboard ? member.championship_points : member.total_points,
    wins: member.wins,
    losses: member.losses,
    ties: member.ties,
    streak: member.current_streak,
    streakType: member.streak_type,
    rank: member.current_rank || rank + 1,
  });

  const getWeeklyRank = (member: LeagueMemberWithProfile) =>
    weeklySorted.findIndex((candidate) => candidate.weekly_points === member.weekly_points) + 1;

  const weeklyLeaderScore = weeklySorted[0]?.weekly_points ?? 0;

  const formatLabel = isSolo ? 'Solo' : isLeaderboard ? 'Leaderboard' : 'Head-to-Head';
  const headerEyebrow = !currentSeason
    ? 'No season'
    : isDraft
      ? `Season ${currentSeason.season_number} • ${isSolo ? 'Setup' : 'Preseason'} • ${formatLabel}`
      : isScheduledWeek && currentWeek
        ? `Season ${currentSeason.season_number} • Week ${currentWeek.week_number} starts ${formatWeekKickoff(currentWeek.start_date)}`
        : `Season ${currentSeason.season_number}${currentWeek ? ` • Week ${currentWeek.week_number}` : ''} • ${formatLabel}`;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{headerEyebrow}</p>
              <LeagueSwitcher currentLeagueId={league.id} currentName={league.name} memberships={memberships} onSelect={selectLeague} onCreate={() => setShowCreateLeague(true)} />
            </div>
            <div className="flex items-center gap-2">
              {league.invite_code && (
                <button onClick={copyInviteCode} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center" aria-label="Share league code">
                  <Share2 className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
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
        {isSolo && <AccountabilityShareCard leagueId={league.id} />}
        {!isSolo && <PunishmentSettingsCard leagueId={league.id} isAdmin={!!isAdmin} />}
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
                  Choose the tasks and scoring rules first. Week 1 will not begin until you explicitly start the season.
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
                    <h3 className="font-display font-bold text-lg mt-0.5">
                      {isSolo ? 'Ready to start tracking' : isLeaderboard ? 'Ready to open the leaderboard' : 'Ready to set the schedule'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isSolo
                        ? 'Your goals are set. Start now and Week 1 begins today.'
                        : league.members.length < 2
                          ? `Your rules are set. Invite at least one ${isLeaderboard ? 'other player' : 'opponent'} before Week 1 can begin.`
                          : isLeaderboard
                            ? `${league.members.length} players are in. Starting now sets Week 1 for Sunday; everyone begins the weekly race at zero.`
                            : `${league.members.length} players are in. Scheduling now locks the round-robin slate and sets Week 1 for the upcoming Sunday.`}
                    </p>

                    <div className="flex items-center gap-2 mt-4">
                      {!isSolo && league.members.length < 2 ? (
                        <Button onClick={copyInviteCode} className="gap-2">
                          <Users className="w-4 h-4" />
                          Copy Invite Code
                        </Button>
                      ) : isAdmin ? (
                        <Button
                          onClick={() => startSeason.mutate({ seasonId: currentSeason.id, gameFormat: league.game_format })}
                          disabled={startSeason.isPending}
                          className="gap-2"
                        >
                          {startSeason.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                          {startSeason.isPending
                            ? 'Starting...'
                            : isSolo ? 'Start Solo Today' : isLeaderboard ? 'Start Leaderboard' : 'Schedule Season 1'}
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

        {isScheduledWeek && currentWeek && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-xl border border-secondary/25 bg-secondary/10 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Week {currentWeek.week_number} kicks off {formatWeekKickoff(currentWeek.start_date)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isLeaderboard
                    ? 'The board opens Sunday. Everyone scores the same daily game and races for #1.'
                    : 'The matchups are locked in. Scoring, power plays, and taunts open Sunday.'}
                </p>
              </div>
            </div>
          </motion.section>
        )}

        {isActive && isLeaderboard && currentWeek && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-pending" />
                <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Week {currentWeek.week_number} Leaderboard
                </h2>
              </div>
              <span className={`text-[10px] uppercase tracking-wider font-bold ${isLiveWeek ? 'text-primary' : 'text-muted-foreground'}`}>
                {isLiveWeek ? 'Live' : weekPhase === 'scheduled' ? 'Opens Sunday' : 'Final'}
              </span>
            </div>

            <div className="card-elevated rounded-xl overflow-hidden divide-y divide-border">
              {weeklySorted.map((member, index) => {
                const rank = getWeeklyRank(member);
                const gap = weeklyLeaderScore - member.weekly_points;
                const isMe = member.user_id === user?.id;
                return (
                  <div key={member.id} className={`flex items-center gap-3 p-3 ${isMe ? 'bg-primary/10' : ''}`}>
                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                      {rank === 1 ? <Crown className="w-5 h-5 text-pending" /> : <span className="font-bold text-muted-foreground">{rank}</span>}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {renderAvatar(member, index)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isMe ? 'text-primary' : ''}`}>
                        {isMe ? 'You' : member.display_name || 'Player'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rank === 1 ? 'Setting the pace' : `${gap.toLocaleString()} pts off the lead`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="score-text text-xl">{member.weekly_points.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">week pts</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isActive && isLeaderboard && currentWeek && (
          <LeaderboardConsequenceCard
            weekId={currentWeek.id}
            isLocked={currentWeek.is_locked}
            members={league.members}
            currentUserId={user?.id}
          />
        )}

        {isActive && isHeadToHead && currentWeek && weekMatchups.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Swords className="w-4 h-4 text-secondary" />
              <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Week {currentWeek.week_number} Matchups
              </h2>
            </div>
            <div className="card-elevated rounded-xl overflow-hidden divide-y divide-border">
              {weekMatchups.map((matchup, index) => {
                const user1 = league.members.find((member) => member.user_id === matchup.user1_id);
                const user2 = league.members.find((member) => member.user_id === matchup.user2_id);
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
                      <p className={`text-[10px] uppercase tracking-wider ${
                        isFinal ? 'text-muted-foreground' : matchup.status === 'in_progress' ? 'text-pending' : 'text-secondary'
                      }`}>
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

        {!isSolo && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-pending" />
            <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {isActive ? (isLeaderboard ? 'Season Championship' : 'Season Standings') : 'League Members'}
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
                  isLowestScorer={!!lowestScorer && member.user_id === lowestScorer.user_id}
                  competitionFormat={league.game_format}
                />
              ))}
            </div>
          )}
        </section>
        )}

        {isLiveWeek && currentSeason && currentWeek && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="card-elevated rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Season Progress</span>
              <span className="text-xs text-muted-foreground">Week {currentWeek.week_number} of {currentSeason.weeks_count}</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: currentSeason.weeks_count }).map((_, index) => (
                <div
                  key={index}
                  className={`flex-1 h-2 rounded-full ${
                    index < currentWeek.week_number - 1 ? 'bg-primary' :
                    index === currentWeek.week_number - 1 ? 'bg-primary/50 animate-pulse' : 'bg-muted'
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
      {showCreateLeague && <CreateLeagueWizard onClose={() => setShowCreateLeague(false)} />}
    </div>
  );
}
