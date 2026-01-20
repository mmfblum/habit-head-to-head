-- Add indexes for performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_scoring_events_league_created ON public.scoring_events(league_id, created_at);