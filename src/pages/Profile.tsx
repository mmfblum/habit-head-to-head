import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, Target, Calendar, Award, Settings, LogOut, User as UserIcon, Trash2, LogOutIcon, ListOrdered } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useDeleteLeague, useLeaveLeague } from '@/hooks/useLeagueActions';
import { TrophyCase } from '@/components/profile/TrophyCase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
import { toast } from 'sonner';
import type { TablesUpdate } from '@/integrations/supabase/types';

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
}

const MASCOTS = [
  '🦅', '🦁', '🐺', '🦈', '🐂', '🦍', '🐻', '🐯',
  '🐓', '🦊', '🦬', '🐉', '⚡', '🚀', '💀', '🔥',
  '👑', '🛡️', '🏆', '🥷', '🦸', '🧠', '🎯', '💪',
];

export default function Profile() {
  const { user, signOut } = useAuth();
  const { data: league, isLoading: leagueLoading } = useUserPrimaryLeague();
  const deleteLeague = useDeleteLeague();
  const leaveLeague = useLeaveLeague();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, timezone')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to load profile', error);
        toast.error('Could not load profile');
      } else {
        const normalized: ProfileData | null = data
          ? {
              display_name: data.display_name,
              avatar_url: data.avatar_url,
              timezone: data.timezone,
            }
          : null;
        setProfile(normalized);
        setDisplayName(normalized?.display_name ?? '');
        setAvatarUrl(normalized?.avatar_url ?? '');
      }
      setIsLoadingProfile(false);
    };

    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    const updateData: TablesUpdate<'profiles'> = {
      display_name: displayName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select('display_name, avatar_url, timezone')
      .single();

    setIsSaving(false);

    if (error) {
      toast.error('Failed to save team identity');
      return;
    }

    const normalized: ProfileData = {
      display_name: data.display_name,
      avatar_url: data.avatar_url,
      timezone: data.timezone,
    };
    setProfile(normalized);
    setDisplayName(normalized.display_name ?? '');
    setAvatarUrl(normalized.avatar_url ?? '');
    setIsEditing(false);
    toast.success('Team identity updated');
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const currentMember = league?.members.find((member) => member.user_id === user?.id);
  const isOwner = currentMember?.role === 'owner';
  const isMember = !!currentMember;
  const isLeaderboard = league?.game_format === 'leaderboard';
  const isSolo = league?.game_format === 'solo';
  const formatLabel = isSolo ? 'Solo' : isLeaderboard ? 'Leaderboard' : 'Head-to-Head';
  const avatarDisplay = profile?.avatar_url || profile?.display_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '👤';
  const isAvatarUrl = avatarDisplay.startsWith('http://') || avatarDisplay.startsWith('https://');
  const weeklySorted = [...(league?.members ?? [])].sort((a, b) => b.weekly_points - a.weekly_points);
  const weeklyIndex = weeklySorted.findIndex((member) => member.user_id === user?.id);
  const weeklyRank = weeklyIndex >= 0
    ? weeklySorted.findIndex((member) => member.weekly_points === weeklySorted[weeklyIndex].weekly_points) + 1
    : undefined;

  const statCards = isSolo
    ? [
        {
          icon: Target,
          label: 'Week Points',
          value: currentMember?.weekly_points?.toLocaleString() ?? '0',
          subtext: 'This tracking week',
        },
        {
          icon: Award,
          label: 'Season Points',
          value: currentMember?.total_points?.toLocaleString() ?? '0',
          subtext: 'All Solo scoring',
        },
      ]
    : isLeaderboard
      ? [
          {
            icon: Trophy,
            label: 'Season Rank',
            value: currentMember?.current_rank ? `#${currentMember.current_rank}` : '—',
            subtext: league ? `of ${league.members.length}` : 'No league',
          },
          {
            icon: ListOrdered,
            label: 'Weekly Rank',
            value: weeklyRank ? `#${weeklyRank}` : '—',
            subtext: league ? `of ${league.members.length}` : 'No league',
          },
          {
            icon: Target,
            label: 'Week Raw Points',
            value: currentMember?.weekly_points?.toLocaleString() ?? '0',
            subtext: 'Current weekly race',
          },
          {
            icon: Award,
            label: 'Championship Points',
            value: currentMember?.championship_points?.toLocaleString() ?? '0',
            subtext: `${currentMember?.total_points?.toLocaleString() ?? '0'} raw season pts`,
          },
        ]
      : [
          {
            icon: Trophy,
            label: 'Season Rank',
            value: currentMember?.current_rank ? `#${currentMember.current_rank}` : '—',
            subtext: league ? `of ${league.members.length}` : 'No league',
          },
          {
            icon: Award,
            label: 'Record',
            value: currentMember ? `${currentMember.wins}-${currentMember.losses}${currentMember.ties ? `-${currentMember.ties}` : ''}` : '—',
            subtext: currentMember?.ties ? 'W-L-T' : 'W-L',
          },
          {
            icon: Flame,
            label: 'Streak',
            value: currentMember?.current_streak ? `${currentMember.current_streak}${currentMember.streak_type || ''}` : '—',
            subtext: currentMember?.streak_type === 'W' ? 'Winning streak' : currentMember?.streak_type === 'L' ? 'Losing streak' : 'No streak',
          },
          {
            icon: Target,
            label: 'Season Points',
            value: currentMember?.total_points?.toLocaleString() ?? '0',
            subtext: `${currentMember?.weekly_points?.toLocaleString() ?? '0'} this week`,
          },
        ];

  if (isLoadingProfile || leagueLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
          <div className="px-4 py-3">
            <Skeleton className="h-6 w-24" />
          </div>
        </header>
        <main className="px-4 py-6 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="w-24 h-24 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="font-display font-bold text-xl">Profile</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsEditing((previous) => !previous)} aria-label="Customize team">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center"
        >
          <div className="w-24 h-24 rounded-3xl bg-primary/15 flex items-center justify-center text-4xl overflow-hidden ring-1 ring-primary/20">
            {isAvatarUrl ? (
              <img src={avatarDisplay} alt={profile?.display_name || 'Team'} className="w-full h-full object-cover" />
            ) : (
              <span>{avatarDisplay}</span>
            )}
          </div>
          <h2 className="font-display font-bold text-2xl mt-4">
            {profile?.display_name || 'Name your team'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
          {league && (
            <p className="text-xs text-primary font-medium mt-2">
              {league.name} • {formatLabel} • {currentMember?.role || 'member'}
            </p>
          )}
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setIsEditing(true)}>
            <Settings className="w-4 h-4" />
            Customize Team
          </Button>
        </motion.section>

        {isEditing && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="card-elevated rounded-xl p-4 space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="display-name">Team name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="The Early Birds"
                maxLength={40}
              />
              <p className="text-[11px] text-muted-foreground">This is the name opponents and league members will see.</p>
            </div>

            <div className="space-y-2">
              <div>
                <Label>Choose your team icon</Label>
                <p className="text-xs text-muted-foreground mt-1">Pick the mascot or symbol that represents you in the game.</p>
              </div>
              <div className="grid grid-cols-8 gap-2">
                {MASCOTS.map((mascot) => (
                  <button
                    type="button"
                    key={mascot}
                    onClick={() => setAvatarUrl(mascot)}
                    className={`aspect-square rounded-xl text-xl flex items-center justify-center border transition-all ${
                      avatarUrl === mascot
                        ? 'border-primary bg-primary/15 ring-1 ring-primary/30 scale-105'
                        : 'border-border bg-muted/40 hover:border-primary/40'
                    }`}
                    aria-label={`Choose ${mascot} mascot`}
                  >
                    {mascot}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar-url">Or use a photo URL</Label>
              <Input
                id="avatar-url"
                value={avatarUrl.startsWith('http') ? avatarUrl : ''}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? 'Saving...' : 'Save Team'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDisplayName(profile?.display_name ?? '');
                  setAvatarUrl(profile?.avatar_url ?? '');
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </motion.section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Your Season
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card-elevated rounded-xl p-4"
                >
                  <Icon className="w-5 h-5 text-primary mb-3" />
                  <p className="score-text text-2xl">{stat.value}</p>
                  <p className="text-xs font-semibold mt-1">{stat.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{stat.subtext}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <TrophyCase
          userId={user?.id}
          seasonId={league?.current_season?.id}
          wins={currentMember?.wins ?? 0}
          currentStreak={currentMember?.current_streak ?? 0}
          streakType={currentMember?.streak_type}
        />

        <section className="card-elevated rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Account</p>
              <p className="text-xs text-muted-foreground">{profile?.timezone || 'America/New_York'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </section>

        {league && isMember && (
          <section className="card-elevated rounded-xl p-4 space-y-4">
            <div>
              <p className="font-semibold text-sm">{isSolo ? 'Solo Membership' : 'League Membership'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isOwner
                  ? isSolo
                    ? 'You can delete this Solo season and its score history if you want to start over.'
                    : 'As owner, you can delete the league if you want to end it for everyone.'
                  : isLeaderboard
                    ? 'Leaving removes you from this leaderboard and future scoring weeks.'
                    : 'Leaving removes you from the league and future matchups.'}
              </p>
            </div>
            <Separator />

            {isOwner ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full gap-2">
                    <Trash2 className="w-4 h-4" />
                    {isSolo ? 'Delete Solo' : 'Delete League'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {league.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the league, its season, standings, scores, tasks, and check-in history. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteLeague.mutate(league.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteLeague.isPending ? 'Deleting...' : isSolo ? 'Delete Solo' : 'Delete League'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full gap-2 text-loss border-loss/30 hover:bg-loss/10">
                    <LogOutIcon className="w-4 h-4" />
                    Leave League
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave {league.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will be removed from the league and future competition. You can only rejoin later with an invite code.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => leaveLeague.mutate(league.id)}>
                      {leaveLeague.isPending ? 'Leaving...' : 'Leave League'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
