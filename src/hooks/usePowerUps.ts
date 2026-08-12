import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface PowerUp {
  id: string;
  powerup_type: string;
  modifier_value: number;
  is_used: boolean;
  used_at: string | null;
  is_activated: boolean;
  activated_at: string | null;
  week_id: string;
  task_instance_id: string | null;
}

export const POWERUP_TYPES = {
  multiplier: {
    name: '2x Power Play',
    description: 'Double your next positive scoring action',
    icon: '⚡',
    color: 'secondary',
    effect: 'pulse',
  },
  flat_boost: {
    name: 'Point Boost',
    description: 'Add bonus points to your next eligible action',
    icon: '🚀',
    color: 'primary',
    effect: 'glow',
  },
  forgiveness: {
    name: 'Forgiveness Pass',
    description: 'Cover your next missed binary task',
    icon: '🎫',
    color: 'streak',
    effect: 'float',
  },
} as const;

export type PowerUpType = keyof typeof POWERUP_TYPES;

export function usePowerUps(weekId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['powerups', weekId, user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<PowerUp[]> => {
      if (!weekId || !user) return [];

      const { data, error } = await supabase
        .from('powerups')
        .select('*')
        .eq('week_id', weekId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as PowerUp[];
    },
    enabled: !!weekId && !!user,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!weekId || !user?.id) return;

    const channel = supabase
      .channel(`powerups-${weekId}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'powerups',
          filter: `week_id=eq.${weekId}`,
        },
        (payload) => {
          const changed = (payload.new || payload.old) as any;
          if (changed?.user_id === user.id) {
            queryClient.invalidateQueries({ queryKey });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekId, user?.id, queryClient]);

  const activatePowerUp = useMutation({
    mutationFn: async ({
      powerup,
      taskInstanceId,
    }: {
      powerup: PowerUp;
      taskInstanceId?: string;
    }) => {
      const { error } = await (supabase as any).rpc('activate_powerup', {
        _powerup_id: powerup.id,
        _task_instance_id: taskInstanceId ?? null,
      });

      if (error) throw error;
      return powerup;
    },
    onSuccess: (powerup) => {
      queryClient.invalidateQueries({ queryKey });
      const powerupMeta = POWERUP_TYPES[powerup.powerup_type as PowerUpType];
      toast.success(`${powerupMeta?.name || 'Power Play'} armed`, {
        description: powerupMeta?.description || 'It will trigger on your next eligible scoring action.',
      });
    },
    onError: (error: Error) => {
      toast.error('Could not arm Power Play', {
        description: error.message,
      });
    },
  });

  const powerups = query.data || [];
  const availablePowerups = powerups.filter(powerup => !powerup.is_used && !powerup.is_activated);
  const armedPowerups = powerups.filter(powerup => !powerup.is_used && powerup.is_activated);
  const usedPowerups = powerups.filter(powerup => powerup.is_used);

  const groupedPowerups = availablePowerups.reduce((acc, powerup) => {
    const type = powerup.powerup_type as PowerUpType;
    if (!POWERUP_TYPES[type]) return acc;
    if (!acc[type]) acc[type] = [];
    acc[type].push(powerup);
    return acc;
  }, {} as Record<PowerUpType, PowerUp[]>);

  return {
    ...query,
    powerups,
    availablePowerups,
    armedPowerups,
    usedPowerups,
    groupedPowerups,
    activatePowerUp,
    availableCount: availablePowerups.length,
    armedCount: armedPowerups.length,
    usedCount: usedPowerups.length,
  };
}
