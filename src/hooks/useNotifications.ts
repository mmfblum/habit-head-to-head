import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getLocalISODate } from '@/lib/date';

export interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['notifications', user?.id];

  const query = useQuery({
    queryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('id,type,title,body,created_at,read_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as UserNotification[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => queryClient.invalidateQueries({ queryKey })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });
}

export function useDailyMatchupNotifications(args: {
  leagueId?: string;
  opponentName?: string | null;
  scoreLine?: string | null;
  swingTasks?: string[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const leagueId = args.leagueId;
  const today = getLocalISODate();
  const now = new Date();
  const hh = now.getHours();
  const mm = now.getMinutes();

  const windowStart = (targetH: number) => hh === targetH && mm >= 0 && mm <= 20;
  const shouldStart = windowStart(9);
  const shouldEnd = windowStart(21);

  const createNotif = async (type: string, title: string, body: string) => {
    if (!user?.id || !leagueId) return;
    const { error } = await supabase.from('user_notifications').insert({
      user_id: user.id,
      league_id: leagueId,
      type,
      title,
      body,
      notify_date: today,
    });
    if (error && error.code !== '23505') throw error;
  };

  useQuery({
    queryKey: ['daily-notif-gen', user?.id, leagueId, today],
    enabled: !!user?.id && !!leagueId && (shouldStart || shouldEnd),
    queryFn: async () => {
      const opp = args.opponentName ?? 'your opponent';
      const score = args.scoreLine ?? 'Check the matchup tab for the latest score.';
      const swing = (args.swingTasks ?? []).slice(0, 2);
      const swingText = swing.length ? `Key swing tasks: ${swing.join(', ')}.` : '';

      if (shouldStart) {
        await createNotif(
          'matchup_daily_start',
          `Good morning — you vs ${opp}`,
          `${score} ${swingText}`.trim()
        );
      }
      if (shouldEnd) {
        await createNotif(
          'matchup_daily_end',
          `Day recap — you vs ${opp}`,
          `${score} ${swingText}`.trim()
        );
      }
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
      return true;
    },
  });
}
