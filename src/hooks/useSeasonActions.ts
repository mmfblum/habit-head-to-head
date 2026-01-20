import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useStartSeason() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (seasonId: string) => {
      const { data, error } = await supabase
        .from('seasons')
        .update({ status: 'active' })
        .eq('id', seasonId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Season Started!',
        description: 'Your season is now active. Start tracking your daily tasks!',
      });
      queryClient.invalidateQueries({ queryKey: ['league-details'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-with-checkins'] });
      queryClient.invalidateQueries({ queryKey: ['user-league-memberships'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
