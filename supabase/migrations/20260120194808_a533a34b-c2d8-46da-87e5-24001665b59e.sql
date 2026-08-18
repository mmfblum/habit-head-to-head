-- Enable realtime for scoring_events table only when it is not already a
-- member of the publication. The core schema migration may have added it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'scoring_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scoring_events;
  END IF;
END $$;
