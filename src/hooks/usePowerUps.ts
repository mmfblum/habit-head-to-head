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
  week_id: string;
  task_instance_id: string | null;
}

// Power-up type definitions with metadata
export const POWERUP_TYPES = {
  multiplier: {
    name: '2x Multiplier',
    description: 'Double points on your next task completion',
    icon: '⚡',
    color: 'secondary',
    effect: 'pulse',
  },
  boost: {
    name: 'Point Boost',
    description: 'Add bonus points to any task',
    icon: '🚀',
    color: 'primary',
    effect: 'glow',
  },
  shield: {
    name: 'Penalty Shield',
    description: 'Block one missed task penalty',
    icon: '🛡️',
    color: 'accent',
    effect: 'shimmer',
  },
  forgiveness: {
    name: 'Forgiveness Pass',
    description: 'Excuse one missed binary task',
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
        .eq('is_used', false);

      if (error) throw error;
      return data || [];
    },
    enabled: !!weekId && !!user,
  });

  const usePowerUp = useMutation({
    mutationFn: async ({ 
      powerupId, 
      taskInstanceId 
    }: { 
      powerupId: string; 
      taskInstanceId?: string;
    }) => {
      const { data, error } = await supabase
        .from('powerups')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
          task_instance_id: taskInstanceId || null,
        })
        .eq('id', powerupId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      const powerupMeta = POWERUP_TYPES[data.powerup_type as PowerUpType];
      toast.success(`${powerupMeta?.name || 'Power-up'} activated!`, {
        description: 'Effect will apply to your next eligible action',
      });
    },
    onError: (error) => {
      toast.error('Failed to activate power-up', {
        description: error.message,
      });
    },
  });

  // Group powerups by type for display
  const groupedPowerups = (query.data || []).reduce((acc, powerup) => {
    const type = powerup.powerup_type as PowerUpType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(powerup);
    return acc;
  }, {} as Record<PowerUpType, PowerUp[]>);

  return {
    ...query,
    powerups: query.data || [],
    groupedPowerups,
    usePowerUp,
    availableCount: query.data?.length || 0,
  };
}
