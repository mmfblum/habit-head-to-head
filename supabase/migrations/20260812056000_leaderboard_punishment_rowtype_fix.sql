CREATE OR REPLACE FUNCTION public.spin_weekly_punishment(_week_id UUID)
RETURNS public.punishment_spins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_week RECORD;
  v_matchup public.matchups%ROWTYPE;
  v_option public.punishment_options%ROWTYPE;
  v_existing public.punishment_spins;
  v_result public.punishment_spins;
  v_user_name TEXT;
  v_loser_count INT := 0;
  v_loser UUID;
  v_winner UUID;
  v_low_score NUMERIC;
  v_high_score NUMERIC;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT w.*, s.league_id, COALESCE(l.game_format, 'head_to_head') AS game_format
  INTO v_week
  FROM public.weeks w
  JOIN public.seasons s ON s.id = w.season_id
  JOIN public.leagues l ON l.id = s.league_id
  WHERE w.id = _week_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Week not found'; END IF;
  IF v_week.week_number <= 0 THEN RAISE EXCEPTION 'Preseason has no punishments'; END IF;
  IF v_week.game_format = 'solo' THEN RAISE EXCEPTION 'Solo has no punishment wheel'; END IF;
  IF NOT public.is_league_member(v_user, v_week.league_id) THEN RAISE EXCEPTION 'Not a league member'; END IF;

  SELECT * INTO v_existing
  FROM public.punishment_spins ps
  WHERE ps.week_id = _week_id AND ps.loser_user_id = v_user;
  IF FOUND THEN RETURN v_existing; END IF;

  IF v_week.game_format = 'head_to_head' THEN
    SELECT * INTO v_matchup
    FROM public.matchups m
    WHERE m.week_id = _week_id AND (m.user1_id = v_user OR m.user2_id = v_user)
    LIMIT 1;

    IF NOT FOUND THEN RAISE EXCEPTION 'No matchup found for this player'; END IF;
    IF v_matchup.status::TEXT <> 'completed' THEN RAISE EXCEPTION 'The matchup must be final before the loser spins'; END IF;
    IF v_matchup.winner_id IS NULL THEN RAISE EXCEPTION 'Tie games have no punishment'; END IF;
    IF v_matchup.winner_id = v_user THEN RAISE EXCEPTION 'Winners do not spin the punishment wheel'; END IF;

    v_loser := v_user;
    v_winner := v_matchup.winner_id;
  ELSIF v_week.game_format = 'leaderboard' THEN
    IF NOT v_week.is_locked THEN RAISE EXCEPTION 'The weekly leaderboard must be final before last place spins'; END IF;

    WITH scores AS (
      SELECT lm.user_id, COALESCE(ws.total_points, 0)::NUMERIC AS total_points
      FROM public.league_members lm
      LEFT JOIN public.weekly_scores ws ON ws.week_id = _week_id AND ws.user_id = lm.user_id
      WHERE lm.league_id = v_week.league_id
    )
    SELECT MIN(total_points), MAX(total_points)
    INTO v_low_score, v_high_score
    FROM scores;

    WITH scores AS (
      SELECT lm.user_id, COALESCE(ws.total_points, 0)::NUMERIC AS total_points
      FROM public.league_members lm
      LEFT JOIN public.weekly_scores ws ON ws.week_id = _week_id AND ws.user_id = lm.user_id
      WHERE lm.league_id = v_week.league_id
    )
    SELECT COUNT(*)::INT
    INTO v_loser_count
    FROM scores
    WHERE total_points = v_low_score;

    IF v_loser_count <> 1 THEN RAISE EXCEPTION 'Tie for last place — no punishment this week'; END IF;

    SELECT lm.user_id
    INTO v_loser
    FROM public.league_members lm
    LEFT JOIN public.weekly_scores ws ON ws.week_id = _week_id AND ws.user_id = lm.user_id
    WHERE lm.league_id = v_week.league_id
      AND COALESCE(ws.total_points, 0)::NUMERIC = v_low_score
    ORDER BY lm.user_id::TEXT
    LIMIT 1;

    IF v_loser <> v_user THEN RAISE EXCEPTION 'Only the unique last-place player spins the punishment wheel'; END IF;

    SELECT lm.user_id
    INTO v_winner
    FROM public.league_members lm
    LEFT JOIN public.weekly_scores ws ON ws.week_id = _week_id AND ws.user_id = lm.user_id
    WHERE lm.league_id = v_week.league_id
      AND COALESCE(ws.total_points, 0)::NUMERIC = v_high_score
    ORDER BY lm.user_id::TEXT
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Unsupported league format';
  END IF;

  SELECT * INTO v_option
  FROM public.punishment_options po
  WHERE po.is_active = TRUE
    AND (po.league_id IS NULL OR po.league_id = v_week.league_id)
  ORDER BY random()
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'No punishment options are configured'; END IF;

  INSERT INTO public.punishment_spins(
    league_id, week_id, matchup_id, loser_user_id, winner_user_id,
    punishment_option_id, result_label, result_description, result_emoji
  ) VALUES (
    v_week.league_id,
    _week_id,
    CASE WHEN v_week.game_format = 'head_to_head' THEN v_matchup.id ELSE NULL END,
    v_loser,
    v_winner,
    v_option.id,
    v_option.label,
    v_option.description,
    v_option.emoji
  )
  RETURNING * INTO v_result;

  SELECT COALESCE(p.display_name, 'The loser')
  INTO v_user_name
  FROM public.profiles p
  WHERE p.id = v_loser;

  INSERT INTO public.league_events(
    league_id, season_id, week_id, actor_user_id, event_type, title, body, metadata
  ) VALUES (
    v_week.league_id,
    v_week.season_id,
    _week_id,
    v_loser,
    'punishment_spin',
    v_result.result_emoji || ' ' || COALESCE(v_user_name, 'The loser') || ' spun ' || v_result.result_label,
    v_result.result_description,
    jsonb_build_object(
      'punishment_spin_id', v_result.id,
      'loser_user_id', v_loser,
      'winner_user_id', v_winner,
      'game_format', v_week.game_format
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.spin_weekly_punishment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_weekly_punishment(UUID) TO authenticated;
