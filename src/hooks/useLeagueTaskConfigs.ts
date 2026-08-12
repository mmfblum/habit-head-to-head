import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';

export interface LeagueTaskConfig {
  id: string;
  season_id: string;
  task_template_id: string;
  config_overrides: Json;
  max_daily_points: number;
  is_enabled: boolean;
  display_order: number;
  task_template: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    icon: string | null;
    input_type: string;
    unit: string;
    scoring_type: string;
    default_config: Json;
  };
}

type TaskTemplateRelation = LeagueTaskConfig['task_template'] | null;

type AdminMembershipRow = {
  role: string;
};

function invalidateTaskQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['league-task-configs'] });
  queryClient.invalidateQueries({ queryKey: ['tasks-with-checkins'] });
  queryClient.invalidateQueries({ queryKey: ['league-details'] });
}

export function useLeagueTaskConfigs(seasonId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['league-task-configs', seasonId],
    queryFn: async (): Promise<LeagueTaskConfig[]> => {
      if (!seasonId) return [];

      const { data, error } = await supabase
        .from('league_task_configs')
        .select(`
          *,
          task_templates (*)
        `)
        .eq('season_id', seasonId)
        .order('display_order');

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        season_id: row.season_id,
        task_template_id: row.task_template_id,
        config_overrides: row.config_overrides,
        max_daily_points: row.max_daily_points,
        is_enabled: row.is_enabled,
        display_order: row.display_order,
        task_template: (row.task_templates as unknown as TaskTemplateRelation) ?? {
          id: row.task_template_id,
          name: 'Task',
          description: null,
          category: 'custom',
          icon: null,
          input_type: 'binary',
          unit: 'boolean',
          scoring_type: 'binary_yesno',
          default_config: {},
        },
      }));
    },
    enabled: !!seasonId && !!user,
  });
}

export function useUpdateLeagueTaskConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      configId,
      configOverrides,
      maxDailyPoints,
    }: {
      configId: string;
      configOverrides?: Json;
      maxDailyPoints?: number;
    }) => {
      const updates: { config_overrides?: Json; max_daily_points?: number } = {};
      if (configOverrides !== undefined) updates.config_overrides = configOverrides;
      if (maxDailyPoints !== undefined) updates.max_daily_points = maxDailyPoints;

      const { data, error } = await supabase
        .from('league_task_configs')
        .update(updates)
        .eq('id', configId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateTaskQueries(queryClient),
  });
}

// Compatibility API used by the commissioner task-management dialog.
export function useUpdateTaskConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      configId,
      updates,
    }: {
      configId: string;
      updates: {
        config_overrides?: Json;
        max_daily_points?: number;
        is_enabled?: boolean;
      };
    }) => {
      const { data, error } = await supabase
        .from('league_task_configs')
        .update(updates)
        .eq('id', configId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateTaskQueries(queryClient),
  });
}

export function useAddTaskConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      seasonId,
      taskTemplateId,
      configOverrides = {},
      maxDailyPoints = 100,
    }: {
      seasonId: string;
      taskTemplateId: string;
      configOverrides?: Json;
      maxDailyPoints?: number;
    }) => {
      const { data: existing, error: orderError } = await supabase
        .from('league_task_configs')
        .select('display_order')
        .eq('season_id', seasonId)
        .order('display_order', { ascending: false })
        .limit(1);

      if (orderError) throw orderError;
      const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

      const { data, error } = await supabase
        .from('league_task_configs')
        .insert({
          season_id: seasonId,
          task_template_id: taskTemplateId,
          config_overrides: configOverrides,
          max_daily_points: maxDailyPoints,
          display_order: nextOrder,
          is_enabled: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateTaskQueries(queryClient),
  });
}

export function useRemoveTaskConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: string) => {
      const { data, error } = await supabase
        .from('league_task_configs')
        .update({ is_enabled: false })
        .eq('id', configId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateTaskQueries(queryClient),
  });
}

export function useToggleLeagueTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      configId,
      enabled,
      effectiveWeek,
    }: {
      configId: string;
      enabled: boolean;
      effectiveWeek?: number;
    }) => {
      if (effectiveWeek) {
        const { data, error } = await supabase.rpc(
          'update_league_task_for_week' as never,
          {
            _config_id: configId,
            _is_enabled: enabled,
            _effective_week: effectiveWeek,
          } as never
        );
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('league_task_configs')
        .update({ is_enabled: enabled })
        .eq('id', configId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateTaskQueries(queryClient),
  });
}

export function useReorderLeagueTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('league_task_configs')
          .update({ display_order: index })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const error = results.find(result => result.error)?.error;
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league-task-configs'] });
    },
  });
}

export function useIsLeagueAdmin(leagueId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['is-league-admin', leagueId, user?.id],
    queryFn: async () => {
      if (!leagueId || !user) return false;

      const { data, error } = await supabase
        .from('league_members')
        .select('role')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      const membership = data as AdminMembershipRow | null;
      return membership?.role === 'owner' || membership?.role === 'admin';
    },
    enabled: !!leagueId && !!user,
  });
}
