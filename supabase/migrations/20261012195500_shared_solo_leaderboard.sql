-- Solo can start with one person and grow into a shared accountability leaderboard.
-- All members use the same season task instances. Solo remains matchup-free.

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

  -- Competitive rosters stay locked once scoring starts. Shared Solo is
  -- intentionally join-anytime: a friend can join an already-live scorecard.
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

CREATE OR REPLACE FUNCTION public.update_season_standing(_user_id uuid, _season_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    total_pts NUMERIC := 0;
    wins_count INT := 0;
    losses_count INT := 0;
    ties_count INT := 0;
    pts_for NUMERIC := 0;
    pts_against NUMERIC := 0;
    high_weekly NUMERIC := 0;
    low_weekly NUMERIC := 0;
    v_game_format TEXT := 'head_to_head';
BEGIN
    SELECT COALESCE(l.game_format, 'head_to_head')
    INTO v_game_format
    FROM public.seasons s
    JOIN public.leagues l ON l.id = s.league_id
    WHERE s.id = _season_id;

    SELECT COALESCE(SUM(ws.total_points), 0),
           COALESCE(MAX(ws.total_points), 0),
           COALESCE(MIN(ws.total_points), 0)
    INTO total_pts, high_weekly, low_weekly
    FROM public.weekly_scores ws
    JOIN public.weeks w ON w.id = ws.week_id
    WHERE ws.user_id = _user_id
      AND w.season_id = _season_id
      AND w.week_number > 0;

    IF v_game_format = 'head_to_head' THEN
        SELECT
            COUNT(*) FILTER (WHERE winner_id = _user_id),
            COUNT(*) FILTER (
                WHERE winner_id IS NOT NULL
                  AND winner_id != _user_id
                  AND (user1_id = _user_id OR user2_id = _user_id)
            ),
            COUNT(*) FILTER (WHERE winner_id IS NULL AND status = 'completed')
        INTO wins_count, losses_count, ties_count
        FROM public.matchups m
        JOIN public.weeks w ON w.id = m.week_id
        WHERE w.season_id = _season_id
          AND w.week_number > 0
          AND (m.user1_id = _user_id OR m.user2_id = _user_id);

        SELECT
            COALESCE(SUM(CASE WHEN user1_id = _user_id THEN user1_score ELSE user2_score END), 0),
            COALESCE(SUM(CASE WHEN user1_id = _user_id THEN user2_score ELSE user1_score END), 0)
        INTO pts_for, pts_against
        FROM public.matchups m
        JOIN public.weeks w ON w.id = m.week_id
        WHERE w.season_id = _season_id
          AND w.week_number > 0
          AND (m.user1_id = _user_id OR m.user2_id = _user_id);
    ELSE
        pts_for := total_pts;
        pts_against := 0;
    END IF;

    INSERT INTO public.season_standings (
        user_id, season_id, total_points, wins, losses, ties,
        points_for, points_against, highest_weekly_score, lowest_weekly_score
    ) VALUES (
        _user_id, _season_id, total_pts, wins_count, losses_count, ties_count,
        pts_for, pts_against, high_weekly, low_weekly
    )
    ON CONFLICT (user_id, season_id)
    DO UPDATE SET
        total_points = EXCLUDED.total_points,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        ties = EXCLUDED.ties,
        points_for = EXCLUDED.points_for,
        points_against = EXCLUDED.points_against,
        highest_weekly_score = EXCLUDED.highest_weekly_score,
        lowest_weekly_score = EXCLUDED.lowest_weekly_score,
        updated_at = now();

    IF v_game_format IN ('leaderboard', 'solo') THEN
        WITH ranked AS (
            SELECT ss.user_id,
                   RANK() OVER (ORDER BY ss.total_points DESC) AS new_rank
            FROM public.season_standings ss
            WHERE ss.season_id = _season_id
        )
        UPDATE public.season_standings ss
        SET current_rank = ranked.new_rank,
            updated_at = now()
        FROM ranked
        WHERE ss.season_id = _season_id
          AND ss.user_id = ranked.user_id;
    END IF;
END;
$function$;
