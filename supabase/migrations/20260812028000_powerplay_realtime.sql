-- Keep the Power Play selector synchronized when a scoring action consumes an
-- armed power-up in the database trigger.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'powerups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.powerups;
  END IF;
END $$;
