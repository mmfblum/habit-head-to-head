ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leagues_archived_at
ON public.leagues (archived_at);

CREATE OR REPLACE FUNCTION public.create_league(
  _name text,
  _description text,
  _game_format text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_league_id UUID;
  v_active_count INT;
  clean_name TEXT := btrim(_name);
  clean_format TEXT := lower(btrim(COALESCE(_game_format, 'head_to_head')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.league_members lm
  JOIN public.leagues l ON l.id = lm.league_id
  WHERE lm.user_id = v_user_id
    AND l.archived_at IS NULL;

  IF v_active_count >= 3 THEN
    RAISE EXCEPTION 'You can have up to 3 active leagues. End or leave one before creating another.';
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

  INSERT INTO public.leagues (
    name,
    description,
    created_by,
    game_format,
    min_members,
    max_members,
    invite_code,
    max_custom_tasks
  )
  VALUES (
    clean_name,
    NULLIF(btrim(_description), ''),
    v_user_id,
    clean_format,
    CASE WHEN clean_format = 'solo' THEN 1 ELSE 2 END,
    12,
    encode(extensions.gen_random_bytes(6), 'hex'),
    999
  )
  RETURNING id INTO v_league_id;

  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (v_league_id, v_user_id, 'owner');

  RETURN v_league_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_league_by_code(_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  league_rec RECORD;
  season_rec RECORD;
  member_count INT;
  active_league_count INT;
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
    AND l.archived_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or ended league invite';
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
  INTO active_league_count
  FROM public.league_members lm
  JOIN public.leagues l ON l.id = lm.league_id
  WHERE lm.user_id = v_user_id
    AND l.archived_at IS NULL;

  IF active_league_count >= 3 THEN
    RAISE EXCEPTION 'You can have up to 3 active leagues. End or leave one before joining another.';
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

  IF FOUND AND season_rec.status = 'active' AND league_rec.game_format <> 'solo' THEN
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

  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (league_rec.id, v_user_id, 'member');

  IF FOUND AND season_rec.status = 'active' AND league_rec.game_format = 'solo' THEN
    INSERT INTO public.season_standings (user_id, season_id)
    VALUES (v_user_id, season_rec.id)
    ON CONFLICT (user_id, season_id) DO NOTHING;

    PERFORM public.update_season_standing(v_user_id, season_rec.id);
  END IF;

  RETURN league_rec.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_league(_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  league_rec RECORD;
  league_timezone TEXT := 'America/New_York';
  local_today DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT l.*, COALESCE(p.timezone, 'America/New_York') AS league_timezone
  INTO league_rec
  FROM public.leagues l
  LEFT JOIN public.profiles p ON p.id = l.created_by
  WHERE l.id = _league_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'League not found';
  END IF;

  IF league_rec.archived_at IS NOT NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.league_members lm
    WHERE lm.league_id = _league_id
      AND lm.user_id = v_user_id
      AND lm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only the league owner or an admin can end the league';
  END IF;

  league_timezone := COALESCE(league_rec.league_timezone, 'America/New_York');
  local_today := (now() AT TIME ZONE league_timezone)::DATE;

  UPDATE public.seasons
  SET status = 'archived',
      end_date = LEAST(end_date, local_today),
      updated_at = now()
  WHERE league_id = _league_id
    AND status IN ('active', 'draft');

  UPDATE public.weeks w
  SET is_locked = TRUE
  FROM public.seasons s
  WHERE w.season_id = s.id
    AND s.league_id = _league_id;

  UPDATE public.leagues
  SET archived_at = now(),
      invite_code = NULL,
      updated_at = now()
  WHERE id = _league_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.end_league(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_league(uuid) TO authenticated;
