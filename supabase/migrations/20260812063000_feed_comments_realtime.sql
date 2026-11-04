-- Feed comments should appear for league-mates without a manual refresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'feed_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_comments;
  END IF;
END
$$;
