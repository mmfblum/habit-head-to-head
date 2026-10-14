CREATE INDEX IF NOT EXISTS idx_accountability_shares_user_id ON public.accountability_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_user_id ON public.feed_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_week_results_league_id ON public.leaderboard_week_results(league_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_week_results_user_id ON public.leaderboard_week_results(user_id);
CREATE INDEX IF NOT EXISTS idx_punishment_options_created_by ON public.punishment_options(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_punishment_spins_matchup_id ON public.punishment_spins(matchup_id) WHERE matchup_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_punishment_spins_option_id ON public.punishment_spins(punishment_option_id) WHERE punishment_option_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_punishment_spins_winner_id ON public.punishment_spins(winner_user_id) WHERE winner_user_id IS NOT NULL;
