-- Low-risk indexes surfaced by Supabase's hosted performance advisor after a
-- full remote migration replay. These cover foreign keys used in deletes,
-- joins and competition/feed lookups.
CREATE INDEX IF NOT EXISTS idx_league_events_actor_user_id
  ON public.league_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_leagues_created_by
  ON public.leagues(created_by);
CREATE INDEX IF NOT EXISTS idx_matchups_user2_id
  ON public.matchups(user2_id);
CREATE INDEX IF NOT EXISTS idx_matchups_winner_id
  ON public.matchups(winner_id);
CREATE INDEX IF NOT EXISTS idx_powerups_task_instance_id
  ON public.powerups(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_powerups_week_id
  ON public.powerups(week_id);
CREATE INDEX IF NOT EXISTS idx_punishments_league_id
  ON public.punishments(league_id);
CREATE INDEX IF NOT EXISTS idx_punishments_week_id
  ON public.punishments(week_id);
CREATE INDEX IF NOT EXISTS idx_scoring_events_season_id
  ON public.scoring_events(season_id);
CREATE INDEX IF NOT EXISTS idx_scoring_events_task_instance_id
  ON public.scoring_events(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_scoring_events_week_id
  ON public.scoring_events(week_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_tasks_approved_by
  ON public.user_custom_tasks(approved_by);
CREATE INDEX IF NOT EXISTS idx_user_notifications_league_id
  ON public.user_notifications(league_id);

-- Earlier migrations created two equivalent UNIQUE constraints for each pair.
-- Keep the original generated-key constraints and remove the later duplicates.
ALTER TABLE public.season_standings
  DROP CONSTRAINT IF EXISTS season_standings_user_season_unique;
ALTER TABLE public.weekly_scores
  DROP CONSTRAINT IF EXISTS weekly_scores_user_week_unique;
