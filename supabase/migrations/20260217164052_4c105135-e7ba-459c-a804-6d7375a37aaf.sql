-- =============================================================================
-- NOTIFICATIONS + LEAGUE EVENTS SCHEMA HARDENING
-- =============================================================================
-- An earlier migration introduced minimal versions of these tables. Keep this
-- migration replay-safe by creating only when absent and then evolving the
-- existing shape instead of trying to CREATE the same tables a second time.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  league_id UUID,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notify_date DATE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Taunts and other event-driven notifications are not daily notifications, so
-- notify_date must be nullable. The unique index still deduplicates dated
-- morning/evening notifications while allowing multiple NULL-dated events.
ALTER TABLE public.user_notifications
  ALTER COLUMN notify_date DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_unique_daily
  ON public.user_notifications (user_id, type, notify_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_notifications_user_id_fkey'
      AND conrelid = 'public.user_notifications'::regclass
  ) THEN
    ALTER TABLE public.user_notifications
      ADD CONSTRAINT user_notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_notifications_league_id_fkey'
      AND conrelid = 'public.user_notifications'::regclass
  ) THEN
    ALTER TABLE public.user_notifications
      ADD CONSTRAINT user_notifications_league_id_fkey
      FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_notifications'
      AND policyname = 'Users can read own notifications'
  ) THEN
    CREATE POLICY "Users can read own notifications"
      ON public.user_notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_notifications'
      AND policyname = 'Users can insert own notifications'
  ) THEN
    CREATE POLICY "Users can insert own notifications"
      ON public.user_notifications FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_notifications'
      AND policyname = 'Users can update own notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications"
      ON public.user_notifications FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.league_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  actor_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- The minimal predecessor required actor_user_id. System-generated league
-- events may not have a human actor, so preserve the later nullable contract.
ALTER TABLE public.league_events
  ALTER COLUMN actor_user_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'league_events_league_id_fkey'
      AND conrelid = 'public.league_events'::regclass
  ) THEN
    ALTER TABLE public.league_events
      ADD CONSTRAINT league_events_league_id_fkey
      FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'league_events_actor_user_id_fkey'
      AND conrelid = 'public.league_events'::regclass
  ) THEN
    ALTER TABLE public.league_events
      ADD CONSTRAINT league_events_actor_user_id_fkey
      FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.league_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'league_events'
      AND policyname = 'League members can read events'
  ) THEN
    CREATE POLICY "League members can read events"
      ON public.league_events FOR SELECT
      USING (public.is_league_member(auth.uid(), league_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'league_events'
      AND policyname = 'Authenticated users can insert events'
  ) THEN
    CREATE POLICY "Authenticated users can insert events"
      ON public.league_events FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
