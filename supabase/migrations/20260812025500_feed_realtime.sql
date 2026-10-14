-- =============================================================================
-- LIVE LEAGUE FEED
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_league_events_league_created
ON public.league_events (league_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'league_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.league_events;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'user_notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
    END IF;
END $$;
