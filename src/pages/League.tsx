import { useState } from 'react';
import { motion } from 'framer-motion';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import { useUserPrimaryLeague, LeagueMemberWithProfile } from '@/hooks/useLeagueDetails';
import { useIsLeagueAdmin } from '@/hooks/useLeagueTaskConfigs';
import { useAuth } from '@/hooks/useAuth';
import { Trophy, Share2, Settings, Skull, Crown, Swords, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ManageTasksDialog } from '@/components/league/ManageTasksDialog';
import { format, addDays, startOfWeek, nextMonday } from 'date-fns';

export default function League() {
  const { user } = useAuth();
  const { data: league, isLoading, error, leagueId } = useUserPrimaryLeague();
  const { data: isAdmin } = useIsLeagueAdmin(leagueId);
  const [showManageTasks, setShowManageTasks] = useState(false);

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
          <p className="text-muted-foreground">Join or create a league to get started!</p>
        </div>
      </div>
    );
  }

  const sortedMembers = [...league.members].sort((a, b) => b.total_points - a.total_points);
  const lowestScorer = sortedMembers[sortedMembers.length - 1];
  const topScorer = sortedMembers[0];
  const currentSeason = league.current_season;
  const currentWeek = league.current_week;
  
  // Calculate next week's start date for the "changes take effect" notice
  const nextWeekStart = currentWeek 
    ? format(nextMonday(new Date()), 'MMM d') 
    : undefined;

  const copyInviteCode = () => {
    if (league.invite_code) {
      navigator.clipboard.writeText(league.invite_code);
      toast.success('Invite code copied!');
    }
  };

  // Convert member to LeaderboardRow format
  const memberToUser = (member: LeagueMemberWithProfile, rank: number) => ({
    id: member.user_id,
    username: member.display_name || 'Unknown',
    avatar: member.avatar_url || getDefaultAvatar(rank),
    weeklyScore: member.weekly_points,
    seasonScore: member.total_points,
    wins: member.wins,
    losses: member.losses,
    streak: member.current_streak,
    rank: member.current_rank || rank + 1,
  });

  // Generate default emoji avatars based on rank
  function getDefaultAvatar(rank: number): string {
    const avatars = ['🏆', '⚡', '🔥', '💪', '🌟', '😤', '🎯', '🚀', '💫', '🎮'];
    return avatars[rank % avatars.length];
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {currentSeason ? `Season ${currentSeason.season_number}` : 'No Season'} 
                {currentWeek ? ` • Week ${currentWeek.week_number}` : ''}
              </p>
              <h1 className="font-display font-bold text-xl">{league.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={copyInviteCode}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
              >
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
              {isAdmin && currentSeason && (
                <button 
                  onClick={() => setShowManageTasks(true)}
                  className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <Settings className="w-4 h-4 text-primary" />
                </button>
              )}
              {!isAdmin && (
                <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          
          {/* League Code */}
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
        {/* Weekly Recap Card - only show if there are members and previous week data */}
        {sortedMembers.length > 1 && currentWeek && currentWeek.week_number > 1 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--gradient-hero)' }}
          >
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Swords className="w-4 h-4 text-white/80" />
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Week {currentWeek.week_number - 1} Recap
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {/* Top Scorer */}
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                  <Crown className="w-5 h-5 text-pending mx-auto mb-1" />
                  <p className="text-2xl mb-1">{getDefaultAvatar(0)}</p>
                  <p className="text-xs font-semibold text-white truncate">{topScorer?.display_name}</p>
                  <p className="text-[10px] text-white/70">Top Scorer</p>
                </div>
                
                {/* Total Points */}
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                  <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{league.members.length}</p>
                  <p className="text-xs text-white/80">Members</p>
                  <p className="text-[10px] text-white/70">Competing</p>
                </div>
                
                {/* Lowest Scorer */}
                {sortedMembers.length > 1 && (
                  <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                    <Skull className="w-5 h-5 text-loss mx-auto mb-1" />
                    <p className="text-2xl mb-1">{getDefaultAvatar(sortedMembers.length - 1)}</p>
                    <p className="text-xs font-semibold text-white truncate">{lowestScorer?.display_name}</p>
                    <p className="text-[10px] text-white/70">Needs Work</p>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {/* No season message */}
        {!currentSeason && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-elevated rounded-xl p-6 text-center"
          >
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display font-semibold mb-2">Season Not Started</h3>
            <p className="text-sm text-muted-foreground">
              The league admin needs to configure tasks and start the season.
            </p>
          </motion.section>
        )}

        {/* Leaderboard */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-pending" />
            <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {currentSeason ? 'Season Standings' : 'League Members'}
            </h2>
          </div>
          
          {sortedMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No members yet. Share the invite code to add members!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedMembers.map((member, index) => (
                <LeaderboardRow
                  key={member.id}
                  user={memberToUser(member, index)}
                  index={index}
                  isCurrentUser={member.user_id === user?.id}
                  isLowestScorer={sortedMembers.length > 1 && member.user_id === lowestScorer?.user_id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Season Progress */}
        {currentSeason && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="card-elevated rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Season Progress</span>
              <span className="text-xs text-muted-foreground">
                Week {currentWeek?.week_number || 1} of {currentSeason.weeks_count}
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: currentSeason.weeks_count }).map((_, i) => {
                const weekNum = currentWeek?.week_number || 1;
                return (
                  <div
                    key={i}
                    className={`flex-1 h-2 rounded-full ${
                      i < weekNum - 1
                        ? 'bg-primary' 
                        : i === weekNum - 1
                        ? 'bg-primary/50 animate-pulse' 
                        : 'bg-muted'
                    }`}
                  />
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {currentSeason.weeks_count - (currentWeek?.week_number || 1)} weeks remaining
            </p>
          </motion.section>
        )}
      </main>

      {/* Manage Tasks Dialog for Admins */}
      {currentSeason && (
        <ManageTasksDialog
          open={showManageTasks}
          onOpenChange={setShowManageTasks}
          seasonId={currentSeason.id}
          nextWeekStart={nextWeekStart}
        />
      )}
    </div>
  );
}
