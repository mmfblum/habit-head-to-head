-- Reading details are social metadata. Updating or skipping the optional
-- "What did you read?" prompt must never reverse/recalculate an already-scored
-- check-in (especially one that consumed a Power Play).
CREATE OR REPLACE FUNCTION public.process_checkin_scoring()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  -- Ignore updates that only add/change Reading-share metadata. The existing
  -- scoring event remains authoritative and the feed can read the current
  -- check-in metadata through its join.
  IF TG_OP = 'UPDATE'
     AND NEW.boolean_value IS NOT DISTINCT FROM OLD.boolean_value
     AND NEW.numeric_value IS NOT DISTINCT FROM OLD.numeric_value
     AND NEW.time_value IS NOT DISTINCT FROM OLD.time_value
     AND NEW.duration_minutes IS NOT DISTINCT FROM OLD.duration_minutes
     AND NEW.checkin_date IS NOT DISTINCT FROM OLD.checkin_date
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NEW.task_instance_id IS NOT DISTINCT FROM OLD.task_instance_id
     AND (
       COALESCE(NEW.metadata, '{}'::JSONB)
         - 'reading_note'
         - 'reading_shared_at'
         - 'reading_prompt_skipped'
     ) IS NOT DISTINCT FROM (
       COALESCE(OLD.metadata, '{}'::JSONB)
         - 'reading_note'
         - 'reading_shared_at'
         - 'reading_prompt_skipped'
     )
  THEN
    RETURN NEW;
  END IF;

  checkin_row := NEW;
  SELECT * INTO task_inst FROM public.task_instances WHERE id = checkin_row.task_instance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task instance not found'; END IF;
  SELECT * INTO season_rec FROM public.seasons WHERE id = task_inst.season_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF season_rec.status <> 'active' THEN RAISE EXCEPTION 'Scoring is not open for this season'; END IF;

  SELECT l.*, COALESCE(p.timezone, 'America/New_York') AS league_timezone INTO league_rec
  FROM public.leagues l LEFT JOIN public.profiles p ON p.id = l.created_by WHERE l.id = season_rec.league_id;
  league_timezone := COALESCE(league_rec.league_timezone, 'America/New_York');
  local_today := (now() AT TIME ZONE league_timezone)::DATE;

  SELECT * INTO week_rec FROM public.weeks
  WHERE season_id = task_inst.season_id AND checkin_row.checkin_date BETWEEN start_date AND end_date LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'This date is outside the active season'; END IF;
  IF week_rec.is_locked OR local_today < week_rec.start_date OR local_today > week_rec.end_date THEN RAISE EXCEPTION 'Check-ins can only be scored during the live scoring window'; END IF;
  IF auth.uid() IS NOT NULL AND checkin_row.user_id <> auth.uid() THEN RAISE EXCEPTION 'You can only score your own check-ins'; END IF;

  CASE task_inst.input_type::TEXT
    WHEN 'binary' THEN raw_val := CASE WHEN checkin_row.boolean_value THEN 1 ELSE 0 END;
    WHEN 'numeric' THEN raw_val := COALESCE(checkin_row.numeric_value, 0);
    WHEN 'time' THEN raw_val := EXTRACT(HOUR FROM checkin_row.time_value::TIME) * 60 + EXTRACT(MINUTE FROM checkin_row.time_value::TIME);
    WHEN 'duration' THEN raw_val := COALESCE(checkin_row.duration_minutes, 0);
    ELSE raw_val := 0;
  END CASE;

  UPDATE public.scoring_events SET is_reversed = TRUE WHERE daily_checkin_id = checkin_row.id AND is_reversed = FALSE;
  checkin_verified := public.is_checkin_verified(checkin_row, task_inst);

  IF NOT checkin_verified THEN
    derived_json := jsonb_build_object('verification_failed', true, 'metadata', checkin_row.metadata);
    IF week_rec.week_number = 0 THEN derived_json := derived_json || jsonb_build_object('preseason', true); END IF;
    INSERT INTO public.scoring_events(daily_checkin_id,user_id,week_id,season_id,league_id,task_instance_id,scoring_type,raw_value,points_before_cap,points_awarded,rule_applied,config_snapshot,derived_values,is_reversed)
    VALUES(checkin_row.id,checkin_row.user_id,week_rec.id,task_inst.season_id,season_rec.league_id,task_inst.id,task_inst.scoring_type,raw_val,0,0,CASE WHEN week_rec.week_number=0 THEN 'preseason:unverified_checkin' ELSE 'unverified_checkin' END,task_inst.config,derived_json,FALSE);
  ELSE
    SELECT * INTO score_result FROM public.calculate_checkin_score(checkin_row, task_inst);
    IF task_inst.scoring_type::TEXT='binary_yesno' AND (checkin_row.boolean_value IS NULL OR checkin_row.boolean_value=FALSE) THEN is_binary_missed := TRUE; END IF;
    IF week_rec.week_number=0 THEN
      final_points := score_result.points_awarded; powerup_json := NULL; derived_json := COALESCE(score_result.derived_values,'{}'::JSONB) || jsonb_build_object('preseason',true);
    ELSE
      SELECT * INTO powerup_result FROM public.apply_armed_powerups(checkin_row.user_id,week_rec.id,task_inst.id,checkin_row.id,score_result.points_awarded,is_binary_missed);
      final_points := powerup_result.final_points; powerup_json := powerup_result.powerup_applied; derived_json := COALESCE(score_result.derived_values,'{}'::JSONB);
    END IF;
    INSERT INTO public.scoring_events(daily_checkin_id,user_id,week_id,season_id,league_id,task_instance_id,scoring_type,raw_value,points_before_cap,points_awarded,rule_applied,config_snapshot,derived_values,powerup_applied,is_reversed)
    VALUES(checkin_row.id,checkin_row.user_id,week_rec.id,task_inst.season_id,season_rec.league_id,task_inst.id,task_inst.scoring_type,raw_val,score_result.points_before_cap,final_points,CASE WHEN week_rec.week_number=0 THEN 'preseason:'||score_result.rule_applied ELSE score_result.rule_applied END,task_inst.config,derived_json,powerup_json,FALSE);
  END IF;

  PERFORM public.update_weekly_score(checkin_row.user_id, week_rec.id);
  IF week_rec.week_number > 0 THEN
    PERFORM public.sync_matchup_score(checkin_row.user_id, week_rec.id);
    PERFORM public.update_season_standing(checkin_row.user_id, task_inst.season_id);
  END IF;
  RETURN NEW;
END;
$$;
