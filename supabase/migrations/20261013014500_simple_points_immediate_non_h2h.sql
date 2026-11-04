-- Simplify Solo/Leaderboard scoring and make non-H2H seasons start immediately.
-- Head-to-head keeps Sunday kickoff and Power Plays.

CREATE OR REPLACE FUNCTION public.start_league_season(_season_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  season_rec RECORD;
  member_count INT;
  task_count INT;
  league_timezone TEXT := 'America/New_York';
  local_today DATE;
  kickoff_date DATE;
BEGIN
  SELECT s.*, l.created_by, COALESCE(l.game_format, 'head_to_head') AS game_format
  INTO season_rec
  FROM public.seasons s
  JOIN public.leagues l ON l.id = s.league_id
  WHERE s.id = _season_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF NOT public.is_league_admin(auth.uid(), season_rec.league_id) THEN
    RAISE EXCEPTION 'Only a league owner or admin can start the season';
  END IF;
  IF season_rec.status = 'active' THEN RETURN; END IF;
  IF season_rec.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft season can be started'; END IF;

  SELECT COALESCE(p.timezone, 'America/New_York')
  INTO league_timezone
  FROM public.profiles p
  WHERE p.id = season_rec.created_by;

  league_timezone := COALESCE(league_timezone, 'America/New_York');
  local_today := (now() AT TIME ZONE league_timezone)::DATE;

  kickoff_date := CASE
    WHEN season_rec.game_format IN ('solo', 'leaderboard') THEN local_today
    ELSE local_today + ((7 - EXTRACT(DOW FROM local_today)::INT) % 7)
  END;

  SELECT COUNT(*)
  INTO member_count
  FROM public.league_members lm
  WHERE lm.league_id = season_rec.league_id;

  IF season_rec.game_format = 'solo' THEN
    IF member_count < 1 THEN RAISE EXCEPTION 'Solo season requires its owner'; END IF;
  ELSIF member_count < 2 THEN
    IF season_rec.game_format = 'leaderboard' THEN
      RAISE EXCEPTION 'Invite at least one other player before starting the leaderboard';
    ELSE
      RAISE EXCEPTION 'Invite at least one opponent before starting the season';
    END IF;
  END IF;

  SELECT COUNT(*)
  INTO task_count
  FROM public.league_task_configs ltc
  WHERE ltc.season_id = _season_id
    AND ltc.is_enabled = TRUE;

  IF task_count < 3 THEN
    RAISE EXCEPTION 'Configure at least three scoring tasks before starting the season';
  END IF;

  DELETE FROM public.weeks
  WHERE season_id = _season_id
    AND week_number = 0;

  UPDATE public.weeks w
  SET start_date = kickoff_date + ((w.week_number - 1) * 7),
      end_date = kickoff_date + ((w.week_number - 1) * 7) + 6,
      is_locked = FALSE
  WHERE w.season_id = _season_id
    AND w.week_number > 0;

  -- Only H2H has preseason because it intentionally waits for Sunday.
  IF season_rec.game_format = 'head_to_head' AND kickoff_date > local_today THEN
    INSERT INTO public.weeks(season_id, week_number, start_date, end_date, is_locked)
    VALUES (_season_id, 0, local_today, kickoff_date - 1, FALSE);
  END IF;

  UPDATE public.seasons s
  SET start_date = kickoff_date,
      end_date = kickoff_date + (s.weeks_count * 7) - 1,
      status = 'active',
      updated_at = now()
  WHERE s.id = _season_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_season_powerplays(_season_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_league_id UUID;
  v_game_format TEXT;
BEGIN
  SELECT s.league_id, COALESCE(l.game_format, 'head_to_head')
  INTO v_league_id, v_game_format
  FROM public.seasons s
  JOIN public.leagues l ON l.id = s.league_id
  WHERE s.id = _season_id;

  IF v_league_id IS NULL THEN RETURN; END IF;

  IF v_game_format <> 'head_to_head' THEN
    DELETE FROM public.powerups p
    USING public.weeks w
    WHERE p.week_id = w.id
      AND w.season_id = _season_id;
    RETURN;
  END IF;

  INSERT INTO public.powerups (
    user_id, week_id, powerup_type, modifier_value, is_activated, is_used
  )
  SELECT lm.user_id, w.id, 'multiplier', 2, FALSE, FALSE
  FROM public.weeks w
  CROSS JOIN public.league_members lm
  WHERE w.season_id = _season_id
    AND w.week_number > 0
    AND lm.league_id = v_league_id
  ON CONFLICT (user_id, week_id, powerup_type) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_powerup(
  _powerup_id uuid,
  _task_instance_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  powerup_rec RECORD;
  league_timezone TEXT := 'America/New_York';
  local_today DATE;
BEGIN
  SELECT
    p.*,
    w.start_date,
    w.end_date,
    w.is_locked,
    s.id AS season_id,
    s.league_id,
    l.created_by,
    COALESCE(l.game_format, 'head_to_head') AS game_format
  INTO powerup_rec
  FROM public.powerups p
  JOIN public.weeks w ON w.id = p.week_id
  JOIN public.seasons s ON s.id = w.season_id
  JOIN public.leagues l ON l.id = s.league_id
  WHERE p.id = _powerup_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Power Play not found'; END IF;
  IF powerup_rec.game_format <> 'head_to_head' THEN
    RAISE EXCEPTION 'Power Plays are only available in Head-to-Head leagues';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> powerup_rec.user_id THEN
    RAISE EXCEPTION 'You can only activate your own Power Play';
  END IF;
  IF powerup_rec.is_used THEN RAISE EXCEPTION 'This Power Play has already been used'; END IF;
  IF powerup_rec.is_activated THEN RETURN; END IF;

  SELECT COALESCE(pr.timezone, 'America/New_York')
  INTO league_timezone
  FROM public.profiles pr
  WHERE pr.id = powerup_rec.created_by;

  league_timezone := COALESCE(league_timezone, 'America/New_York');
  local_today := (now() AT TIME ZONE league_timezone)::DATE;

  IF powerup_rec.is_locked
     OR local_today < powerup_rec.start_date
     OR local_today > powerup_rec.end_date THEN
    RAISE EXCEPTION 'Power Plays can only be activated during a live scoring week';
  END IF;

  IF _task_instance_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.task_instances ti
    WHERE ti.id = _task_instance_id
      AND ti.season_id = powerup_rec.season_id
  ) THEN
    RAISE EXCEPTION 'That task does not belong to this season';
  END IF;

  UPDATE public.powerups
  SET is_activated = TRUE,
      activated_at = now(),
      task_instance_id = _task_instance_id
  WHERE id = _powerup_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_checkin_scoring()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  checkin_row public.daily_checkins%ROWTYPE;
  task_inst public.task_instances%ROWTYPE;
  season_rec public.seasons%ROWTYPE;
  week_rec public.weeks%ROWTYPE;
  league_rec RECORD;
  score_result RECORD;
  powerup_result RECORD;
  final_points NUMERIC := 0;
  powerup_json JSONB := NULL;
  is_binary_missed BOOLEAN := FALSE;
  raw_val NUMERIC := 0;
  checkin_verified BOOLEAN;
  league_timezone TEXT := 'America/New_York';
  local_today DATE;
  derived_json JSONB := '{}'::JSONB;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.boolean_value IS NOT DISTINCT FROM OLD.boolean_value
     AND NEW.numeric_value IS NOT DISTINCT FROM OLD.numeric_value
     AND NEW.time_value IS NOT DISTINCT FROM OLD.time_value
     AND NEW.duration_minutes IS NOT DISTINCT FROM OLD.duration_minutes
     AND NEW.checkin_date IS NOT DISTINCT FROM OLD.checkin_date
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NEW.task_instance_id IS NOT DISTINCT FROM OLD.task_instance_id
     AND (COALESCE(NEW.metadata, '{}'::JSONB) - 'reading_note' - 'reading_shared_at' - 'reading_prompt_skipped')
       IS NOT DISTINCT FROM
       (COALESCE(OLD.metadata, '{}'::JSONB) - 'reading_note' - 'reading_shared_at' - 'reading_prompt_skipped')
  THEN
    RETURN NEW;
  END IF;

  checkin_row := NEW;

  SELECT * INTO task_inst
  FROM public.task_instances
  WHERE id = checkin_row.task_instance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task instance not found'; END IF;

  SELECT * INTO season_rec
  FROM public.seasons
  WHERE id = task_inst.season_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF season_rec.status <> 'active' THEN RAISE EXCEPTION 'Scoring is not open for this season'; END IF;

  SELECT l.*, COALESCE(p.timezone, 'America/New_York') AS league_timezone
  INTO league_rec
  FROM public.leagues l
  LEFT JOIN public.profiles p ON p.id = l.created_by
  WHERE l.id = season_rec.league_id;

  league_timezone := COALESCE(league_rec.league_timezone, 'America/New_York');
  local_today := (now() AT TIME ZONE league_timezone)::DATE;

  SELECT * INTO week_rec
  FROM public.weeks
  WHERE season_id = task_inst.season_id
    AND checkin_row.checkin_date BETWEEN start_date AND end_date
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'This date is outside the active season'; END IF;
  IF week_rec.is_locked OR local_today < week_rec.start_date OR local_today > week_rec.end_date THEN
    RAISE EXCEPTION 'Check-ins can only be scored during the live scoring window';
  END IF;
  IF auth.uid() IS NOT NULL AND checkin_row.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only score your own check-ins';
  END IF;

  CASE task_inst.input_type::TEXT
    WHEN 'binary' THEN raw_val := CASE WHEN checkin_row.boolean_value THEN 1 ELSE 0 END;
    WHEN 'numeric' THEN raw_val := COALESCE(checkin_row.numeric_value, 0);
    WHEN 'time' THEN raw_val := EXTRACT(HOUR FROM checkin_row.time_value::TIME) * 60
                               + EXTRACT(MINUTE FROM checkin_row.time_value::TIME);
    WHEN 'duration' THEN raw_val := COALESCE(checkin_row.duration_minutes, 0);
    ELSE raw_val := 0;
  END CASE;

  UPDATE public.scoring_events
  SET is_reversed = TRUE
  WHERE daily_checkin_id = checkin_row.id
    AND is_reversed = FALSE;

  checkin_verified := public.is_checkin_verified(checkin_row, task_inst);

  IF NOT checkin_verified THEN
    derived_json := jsonb_build_object(
      'verification_failed', true,
      'metadata', checkin_row.metadata
    );
    IF week_rec.week_number = 0 THEN
      derived_json := derived_json || jsonb_build_object('preseason', true);
    END IF;

    INSERT INTO public.scoring_events(
      daily_checkin_id,user_id,week_id,season_id,league_id,task_instance_id,
      scoring_type,raw_value,points_before_cap,points_awarded,rule_applied,
      config_snapshot,derived_values,is_reversed
    )
    VALUES(
      checkin_row.id,checkin_row.user_id,week_rec.id,task_inst.season_id,
      season_rec.league_id,task_inst.id,task_inst.scoring_type,raw_val,0,0,
      CASE WHEN week_rec.week_number = 0
        THEN 'preseason:unverified_checkin'
        ELSE 'unverified_checkin'
      END,
      task_inst.config,derived_json,FALSE
    );
  ELSE
    SELECT * INTO score_result
    FROM public.calculate_checkin_score(checkin_row, task_inst);

    IF task_inst.scoring_type::TEXT = 'binary_yesno'
       AND (checkin_row.boolean_value IS NULL OR checkin_row.boolean_value = FALSE) THEN
      is_binary_missed := TRUE;
    END IF;

    -- Solo and Leaderboard are strict one-point games. Only H2H can apply Power Plays.
    IF week_rec.week_number = 0 OR COALESCE(league_rec.game_format, 'head_to_head') <> 'head_to_head' THEN
      final_points := LEAST(score_result.points_awarded, 1);
      powerup_json := NULL;
      derived_json := COALESCE(score_result.derived_values, '{}'::JSONB);
      IF week_rec.week_number = 0 THEN
        derived_json := derived_json || jsonb_build_object('preseason', true);
      END IF;
    ELSE
      SELECT * INTO powerup_result
      FROM public.apply_armed_powerups(
        checkin_row.user_id,
        week_rec.id,
        task_inst.id,
        checkin_row.id,
        score_result.points_awarded,
        is_binary_missed
      );
      final_points := powerup_result.final_points;
      powerup_json := powerup_result.powerup_applied;
      derived_json := COALESCE(score_result.derived_values, '{}'::JSONB);
    END IF;

    INSERT INTO public.scoring_events(
      daily_checkin_id,user_id,week_id,season_id,league_id,task_instance_id,
      scoring_type,raw_value,points_before_cap,points_awarded,rule_applied,
      config_snapshot,derived_values,powerup_applied,is_reversed
    )
    VALUES(
      checkin_row.id,checkin_row.user_id,week_rec.id,task_inst.season_id,
      season_rec.league_id,task_inst.id,task_inst.scoring_type,raw_val,
      LEAST(score_result.points_before_cap, 1),final_points,
      CASE WHEN week_rec.week_number = 0
        THEN 'preseason:' || score_result.rule_applied
        ELSE score_result.rule_applied
      END,
      task_inst.config,derived_json,powerup_json,FALSE
    );
  END IF;

  PERFORM public.update_weekly_score(checkin_row.user_id, week_rec.id);

  IF week_rec.week_number > 0 THEN
    PERFORM public.sync_matchup_score(checkin_row.user_id, week_rec.id);
    PERFORM public.update_season_standing(checkin_row.user_id, task_inst.season_id);
  END IF;

  RETURN NEW;
END;
$function$;

-- Leaderboard placement points are gone. Weekly result points are the actual task points.
CREATE OR REPLACE FUNCTION public.finalize_leaderboard_week(_week_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_season_id UUID;
  v_league_id UUID;
  v_format TEXT;
  v_week_number INT;
BEGIN
  SELECT w.season_id, s.league_id, COALESCE(l.game_format, 'head_to_head'), w.week_number
  INTO v_season_id, v_league_id, v_format, v_week_number
  FROM public.weeks w
  JOIN public.seasons s ON s.id = w.season_id
  JOIN public.leagues l ON l.id = s.league_id
  WHERE w.id = _week_id;

  IF v_season_id IS NULL OR v_format <> 'leaderboard' OR v_week_number <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.leaderboard_week_results(
    league_id,season_id,week_id,user_id,weekly_points,weekly_rank,championship_points
  )
  WITH scored AS (
    SELECT lm.user_id, COALESCE(ws.total_points, 0)::NUMERIC AS total_points
    FROM public.league_members lm
    LEFT JOIN public.weekly_scores ws
      ON ws.week_id = _week_id
     AND ws.user_id = lm.user_id
    WHERE lm.league_id = v_league_id
  ),
  ranked AS (
    SELECT user_id,total_points,
           RANK() OVER (ORDER BY total_points DESC) AS finish_rank
    FROM scored
  )
  SELECT
    v_league_id,v_season_id,_week_id,user_id,total_points,finish_rank,total_points::INT
  FROM ranked
  ON CONFLICT (week_id,user_id)
  DO UPDATE SET
    weekly_points = EXCLUDED.weekly_points,
    weekly_rank = EXCLUDED.weekly_rank,
    championship_points = EXCLUDED.championship_points;

  -- Keep the legacy column synchronized for compatibility, but it now means points.
  UPDATE public.season_standings ss
  SET championship_points = ss.total_points::INT,
      updated_at = now()
  WHERE ss.season_id = v_season_id;

  WITH ranked_season AS (
    SELECT user_id,
           RANK() OVER (ORDER BY total_points DESC) AS season_rank
    FROM public.season_standings
    WHERE season_id = v_season_id
  )
  UPDATE public.season_standings ss
  SET current_rank = ranked_season.season_rank,
      updated_at = now()
  FROM ranked_season
  WHERE ss.season_id = v_season_id
    AND ss.user_id = ranked_season.user_id;
END;
$function$;

-- Remove non-H2H Power Plays already created under the old rule.
DELETE FROM public.powerups p
USING public.weeks w, public.seasons s, public.leagues l
WHERE p.week_id = w.id
  AND w.season_id = s.id
  AND s.league_id = l.id
  AND l.game_format IN ('solo', 'leaderboard');

-- Normalize any legacy non-H2H scoring events above one point.
UPDATE public.scoring_events se
SET points_before_cap = CASE WHEN se.points_before_cap > 0 THEN 1 ELSE 0 END,
    points_awarded = CASE WHEN se.points_awarded > 0 THEN 1 ELSE 0 END,
    powerup_applied = NULL
FROM public.leagues l
WHERE se.league_id = l.id
  AND l.game_format IN ('solo', 'leaderboard')
  AND se.is_reversed = FALSE
  AND (se.points_before_cap > 1 OR se.points_awarded > 1 OR se.powerup_applied IS NOT NULL);

-- Recalculate weekly and season totals after normalization.
DO $recalc$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT se.user_id, se.week_id, se.season_id
    FROM public.scoring_events se
    JOIN public.leagues l ON l.id = se.league_id
    WHERE l.game_format IN ('solo', 'leaderboard')
      AND se.is_reversed = FALSE
  LOOP
    PERFORM public.update_weekly_score(r.user_id, r.week_id);
    PERFORM public.update_season_standing(r.user_id, r.season_id);
  END LOOP;
END;
$recalc$;

-- Keep the legacy championship column aligned to actual points.
UPDATE public.season_standings ss
SET championship_points = ss.total_points::INT,
    updated_at = now()
FROM public.seasons s
JOIN public.leagues l ON l.id = s.league_id
WHERE ss.season_id = s.id
  AND l.game_format = 'leaderboard';

UPDATE public.leaderboard_week_results
SET championship_points = weekly_points::INT;

-- Existing active Solo/Leaderboard seasons that were waiting for Sunday and have
-- no scoring yet should become live immediately.
DO $realign$
DECLARE
  r RECORD;
  local_today DATE;
BEGIN
  FOR r IN
    SELECT s.id, s.weeks_count, l.created_by,
           COALESCE(p.timezone, 'America/New_York') AS timezone
    FROM public.seasons s
    JOIN public.leagues l ON l.id = s.league_id
    LEFT JOIN public.profiles p ON p.id = l.created_by
    WHERE s.status = 'active'
      AND l.game_format IN ('solo', 'leaderboard')
      AND NOT EXISTS (
        SELECT 1
        FROM public.scoring_events se
        WHERE se.season_id = s.id
          AND se.is_reversed = FALSE
      )
  LOOP
    local_today := (now() AT TIME ZONE COALESCE(r.timezone, 'America/New_York'))::DATE;

    DELETE FROM public.weeks
    WHERE season_id = r.id
      AND week_number = 0;

    UPDATE public.weeks w
    SET start_date = local_today + ((w.week_number - 1) * 7),
        end_date = local_today + ((w.week_number - 1) * 7) + 6,
        is_locked = FALSE
    WHERE w.season_id = r.id
      AND w.week_number > 0;

    UPDATE public.seasons
    SET start_date = local_today,
        end_date = local_today + (r.weeks_count * 7) - 1,
        updated_at = now()
    WHERE id = r.id;
  END LOOP;
END;
$realign$;
