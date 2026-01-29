import { motion } from 'framer-motion';
import { Settings, Trophy, Target, Flame, Calendar, ChevronRight, LogOut, Bell, Shield, Trash2, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useIsLeagueAdmin } from '@/hooks/useLeagueTaskConfigs';
import { useState } from 'react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDeleteLeague, useLeaveLeague } from '@/hooks/useLeagueActions';

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: league, leagueId } = useUserPrimaryLeague();
  const { data: isAdmin } = useIsLeagueAdmin(leagueId);
  const deleteLeague = useDeleteLeague();
  const leaveLeague = useLeaveLeague();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Find current user's standing in the league
  const currentUserStanding = league?.members?.find(m => m.user_id === user?.id);
  const wins = currentUserStanding?.wins || 0;
  const losses = currentUserStanding?.losses || 0;
  const streak = currentUserStanding?.current_streak || 0;
  const totalPoints = currentUserStanding?.total_points || 0;
  const weeklyPoints = currentUserStanding?.weekly_points || 0;
  const rank = currentUserStanding?.current_rank || 0;
  const displayName = currentUserStanding?.display_name || user?.email?.split('@')[0] || 'User';

  const seasonProgress = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

  const stats = [
    { label: 'Season Wins', value: wins, icon: Trophy, color: 'text-primary' },
    { label: 'Season Losses', value: losses, icon: Target, color: 'text-loss' },
    { label: 'Streak', value: streak, icon: Flame, color: 'text-streak' },
    { label: 'Rank', value: rank || '-', icon: Calendar, color: 'text-secondary' },
  ];

  const menuItems = [
    { label: 'Notifications', icon: Bell },
    { label: 'Privacy & Security', icon: Shield },
    { label: 'Settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleDeleteLeague = async () => {
    if (!leagueId) return;
    
    try {
      await deleteLeague.mutateAsync(leagueId);
      setShowDeleteDialog(false);
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete league');
    }
  };

  const handleLeaveLeague = async () => {
    if (!leagueId) return;
    
    try {
      await leaveLeague.mutateAsync(leagueId);
      setShowLeaveDialog(false);
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to leave league');
    }
  };

  // Generate avatar from display name
  const avatarEmoji = displayName ? '👤' : '🎮';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="relative overflow-hidden safe-top">
        <div 
          className="absolute inset-0 opacity-20"
          style={{ background: 'var(--gradient-primary)' }}
        />
        <div className="relative px-4 py-8 text-center">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-24 h-24 rounded-3xl bg-primary/20 flex items-center justify-center text-5xl mx-auto mb-4 ring-4 ring-primary/30"
          >
            {avatarEmoji}
          </motion.div>
          
          <h1 className="font-display font-bold text-2xl">{displayName}</h1>
          <p className="text-muted-foreground text-sm">
            {rank > 0 ? `Rank #${rank}` : 'No rank yet'} 
            {league?.name ? ` in ${league.name}` : ''}
          </p>
          
          {/* Season record */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="win-badge">
              <Trophy className="w-3 h-3" />
              {wins} Wins
            </div>
            <div className="loss-badge">
              {losses} Losses
            </div>
            {streak > 0 && (
              <div className="streak-badge">
                <Flame className="w-3 h-3" />
                {streak} Streak
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Season Stats Card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-elevated rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">
              {league?.current_season ? `Season ${league.current_season.season_number} Stats` : 'Season Stats'}
            </h2>
            <span className="text-xs text-muted-foreground">
              {league?.current_week ? `Week ${league.current_week.week_number}` : ''}
              {league?.current_season ? ` of ${league.current_season.weeks_count}` : ''}
            </span>
          </div>
          
          {/* Win rate progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Win Rate</span>
              <span className="font-semibold">{Math.round(seasonProgress)}%</span>
            </div>
            <Progress value={seasonProgress} className="h-2" />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center p-2">
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                  <p className="score-text text-lg">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Total Points */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-elevated rounded-2xl p-4"
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Season Points</p>
            <p className="score-text text-4xl gradient-text">{Math.round(totalPoints).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              +{Math.round(weeklyPoints)} this week
            </p>
          </div>
        </motion.section>

        {/* Achievements Preview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Achievements
            </h2>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {['🏆', '🔥', '📚', '💪', '🎯', '⚡'].map((emoji, i) => (
              <div
                key={i}
                className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
                  i < Math.min(wins, 4) ? 'bg-primary/20 ring-1 ring-primary/30' : 'bg-muted opacity-40'
                }`}
              >
                {emoji}
              </div>
            ))}
          </div>
        </motion.section>

        {/* Menu Items */}
        <section className="space-y-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-card hover:bg-muted/50 transition-colors"
              >
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-left font-medium">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            );
          })}
        </section>

        {/* League Management Section */}
        {league && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
              League
            </h2>
            
            {isAdmin ? (
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <button
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-loss/30 text-loss hover:bg-loss/10 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="flex-1 text-left font-medium">Delete League</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete League?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{league.name}" and all associated data including seasons, tasks, and check-ins for all members.
                      <br /><br />
                      <strong>This action cannot be undone.</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteLeague}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteLeague.isPending}
                    >
                      {deleteLeague.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete League'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
                <AlertDialogTrigger asChild>
                  <button
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-loss/30 text-loss hover:bg-loss/10 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="flex-1 text-left font-medium">Leave League</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave League?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to leave "{league.name}"? Your progress and check-ins will be preserved, but you won't be able to participate until you rejoin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeaveLeague}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={leaveLeague.isPending}
                    >
                      {leaveLeague.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Leaving...
                        </>
                      ) : (
                        'Leave League'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </motion.section>
        )}

        {/* Logout */}
        <motion.button
          onClick={handleSignOut}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-loss/30 text-loss hover:bg-loss/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </motion.button>
      </main>
    </div>
  );
}
