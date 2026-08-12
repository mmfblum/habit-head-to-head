-- User review feedback batch:
-- 1) users may belong to/create multiple leagues;
-- 2) the same custom challenge template may be instantiated multiple times;
-- 3) feed entries support comments;
-- 4) add a default nutrition task for stopping food after 8 PM.

ALTER TABLE public.leagues
  ALTER COLUMN max_custom_tasks SET DEFAULT 999;

UPDATE public.leagues
SET max_custom_tasks = GREATEST(max_custom_tasks, 999);

-- Standard templates remain de-duplicated in the UI. Dropping this constraint
-- lets commissioners create any number of custom tasks from the reusable
-- checkoff/minutes/count custom templates, each with its own config/name.
ALTER TABLE public.league_task_configs
  DROP CONSTRAINT IF EXISTS league_task_configs_season_id_task_template_id_key;

CREATE OR REPLACE FUNCTION public.create_league(
  _name TEXT,
  _description TEXT,
  _game_format TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_league_id UUID;
  clean_name TEXT := btrim(_name);
  clean_format TEXT := lower(btrim(COALESCE(_game_format, 'head_to_head')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF clean_name IS NULL OR clean_name = '' THEN
    RAISE EXCEPTION 'League name is required';
  END IF;

  IF length(clean_name) > 80 THEN
    RAISE EXCEPTION 'League name must be 80 characters or fewer';
  END IF;

  IF clean_format NOT IN ('head_to_head', 'leaderboard', 'solo') THEN
    RAISE EXCEPTION 'Invalid league format';
  END IF;

  INSERT INTO public.leagues(
    name,
    description,
    created_by,
    game_format,
    min_members,
    max_members,
    invite_code,
    max_custom_tasks
  ) VALUES (
    clean_name,
    NULLIF(btrim(_description), ''),
    v_user_id,
    clean_format,
    CASE WHEN clean_format = 'solo' THEN 1 ELSE 2 END,
    CASE WHEN clean_format = 'solo' THEN 1 ELSE 12 END,
    CASE WHEN clean_format = 'solo' THEN NULL ELSE encode(extensions.gen_random_bytes(6), 'hex') END,
    999
  )
  RETURNING id INTO v_league_id;

  INSERT INTO public.league_members(league_id, user_id, role)
  VALUES(v_league_id, v_user_id, 'owner');

  RETURN v_league_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_league(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_league(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_league(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_league_by_code(_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  league_rec RECORD;
  season_rec RECORD;
  member_count INT;
  commissioner_timezone TEXT := 'America/New_York';
  local_today DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _invite_code IS NULL OR btrim(_invite_code) = '' THEN
    RAISE EXCEPTION 'Enter an invite code';
  END IF;

  SELECT l.*
  INTO league_rec
  FROM public.leagues l
  WHERE lower(l.invite_code) = lower(btrim(_invite_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF league_rec.game_format = 'solo' THEN
    RAISE EXCEPTION 'Solo leagues do not accept members';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.league_members lm
    WHERE lm.user_id = v_user_id
      AND lm.league_id = league_rec.id
  ) THEN
    RAISE EXCEPTION 'You are already in this league';
  END IF;

  SELECT COUNT(*)
  INTO member_count
  FROM public.league_members lm
  WHERE lm.league_id = league_rec.id;

  IF member_count >= league_rec.max_members THEN
    RAISE EXCEPTION 'This league is full';
  END IF;

  SELECT s.*
  INTO season_rec
  FROM public.seasons s
  WHERE s.league_id = league_rec.id
    AND s.status IN ('active', 'draft')
  ORDER BY s.season_number DESC
  LIMIT 1;

  IF FOUND AND season_rec.status = 'active' THEN
    SELECT COALESCE(p.timezone, 'America/New_York')
    INTO commissioner_timezone
    FROM public.profiles p
    WHERE p.id = league_rec.created_by;

    commissioner_timezone := COALESCE(commissioner_timezone, 'America/New_York');
    local_today := (now() AT TIME ZONE commissioner_timezone)::DATE;

    IF local_today >= season_rec.start_date THEN
      RAISE EXCEPTION 'This season has already started. League rosters are locked.';
    END IF;
  END IF;

  INSERT INTO public.league_members(league_id, user_id, role)
  VALUES(league_rec.id, v_user_id, 'member');

  RETURN league_rec.id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_league_by_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_league_by_code(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_league_by_code(TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_comments_league_event
  ON public.feed_comments(league_id, event_key, created_at);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user_id
  ON public.feed_comments(user_id);

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feed_comments_select ON public.feed_comments;
CREATE POLICY feed_comments_select
ON public.feed_comments
FOR SELECT
TO authenticated
USING (public.is_league_member((SELECT auth.uid()), league_id));

DROP POLICY IF EXISTS feed_comments_insert ON public.feed_comments;
CREATE POLICY feed_comments_insert
ON public.feed_comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND public.is_league_member((SELECT auth.uid()), league_id)
);

DROP POLICY IF EXISTS feed_comments_delete ON public.feed_comments;
CREATE POLICY feed_comments_delete
ON public.feed_comments
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.feed_comments FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.feed_comments TO authenticated;

INSERT INTO public.task_templates (
  name,
  description,
  category,
  icon,
  input_type,
  unit,
  scoring_type,
  default_config,
  is_active,
  is_premium,
  version
)
SELECT
  'Stopped Eating After 8 PM',
  'Finish eating by 8:00 PM and keep the kitchen closed for the night.',
  'nutrition'::public.task_category,
  'utensils',
  'binary'::public.input_type,
  'boolean'::public.unit_type,
  'binary_yesno'::public.scoring_type,
  jsonb_build_object(
    'scoring_mode', 'binary',
    'binary_points', 3,
    'cutoff_time', '20:00',
    'verification', jsonb_build_object(
      'method', 'manual_action',
      'allowed_sources', jsonb_build_array('manual'),
      'requires_confirmation', false
    )
  ),
  TRUE,
  FALSE,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_templates WHERE name = 'Stopped Eating After 8 PM'
);
