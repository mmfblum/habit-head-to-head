CREATE OR REPLACE FUNCTION public.is_checkin_verified(
  _checkin public.daily_checkins,
  _task_instance public.task_instances
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  verification_config JSONB;
  metadata JSONB;
  requires_confirmation BOOLEAN;
  auto_import_only BOOLEAN;
  source TEXT;
BEGIN
  verification_config := (_task_instance.config->>'verification')::JSONB;
  IF verification_config IS NULL THEN RETURN TRUE; END IF;
  metadata := COALESCE(_checkin.metadata, '{}'::JSONB);
  auto_import_only := COALESCE((verification_config->>'auto_import_only')::BOOLEAN, FALSE);
  source := COALESCE(metadata->>'source', 'manual');
  IF auto_import_only AND source = 'manual' THEN RETURN FALSE; END IF;
  requires_confirmation := COALESCE((verification_config->>'requires_confirmation')::BOOLEAN, FALSE);
  IF requires_confirmation AND (metadata->>'confirmed')::BOOLEAN IS NOT TRUE THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_checkin_score(
  _checkin public.daily_checkins,
  _task_instance public.task_instances
)
RETURNS TABLE(points_before_cap NUMERIC, points_awarded NUMERIC, rule_applied TEXT, derived_values JSONB)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  config JSONB := COALESCE(_task_instance.config, '{}'::JSONB);
  scoring_type TEXT := _task_instance.scoring_type::TEXT;
  input_type TEXT := _task_instance.input_type::TEXT;
  scoring_mode TEXT;
  raw_value NUMERIC := 0;
  target_value NUMERIC;
  binary_points NUMERIC;
  success BOOLEAN := FALSE;
  result_before NUMERIC := 0;
  result_points NUMERIC := 0;
  result_rule TEXT;
  result_derived JSONB := '{}'::JSONB;
BEGIN
  scoring_mode := COALESCE(config->>'scoring_mode', 'detailed');
  CASE input_type
    WHEN 'binary' THEN raw_value := CASE WHEN _checkin.boolean_value THEN 1 ELSE 0 END;
    WHEN 'numeric' THEN raw_value := COALESCE(_checkin.numeric_value, 0);
    WHEN 'time' THEN IF _checkin.time_value IS NOT NULL THEN raw_value := EXTRACT(HOUR FROM _checkin.time_value::TIME) * 60 + EXTRACT(MINUTE FROM _checkin.time_value::TIME); END IF;
    WHEN 'duration' THEN raw_value := COALESCE(_checkin.duration_minutes, 0);
    ELSE raw_value := 0;
  END CASE;

  IF scoring_mode = 'binary' THEN
    binary_points := COALESCE((config->>'binary_points')::NUMERIC, (config->>'points')::NUMERIC, 3);
    CASE input_type
      WHEN 'binary' THEN success := COALESCE(_checkin.boolean_value, FALSE);
      WHEN 'time' THEN
        IF _checkin.time_value IS NULL THEN success := FALSE;
        ELSIF scoring_type = 'time_after' THEN success := _checkin.time_value::TIME >= COALESCE((config->>'target_time')::TIME, '06:00'::TIME);
        ELSE success := _checkin.time_value::TIME <= COALESCE((config->>'target_time')::TIME, '23:59'::TIME);
        END IF;
      ELSE
        IF config ? 'daily_limit_minutes' THEN target_value := (config->>'daily_limit_minutes')::NUMERIC; success := raw_value <= target_value;
        ELSE target_value := COALESCE((config->>'target')::NUMERIC, (config->>'threshold')::NUMERIC, 1); success := raw_value >= target_value;
        END IF;
    END CASE;
    result_points := CASE WHEN success THEN binary_points ELSE 0 END;
    result_before := result_points;
    result_rule := 'binary_mode: success=' || success::TEXT;
    result_derived := jsonb_build_object('scoring_mode','binary','raw_value',raw_value,'target',target_value,'binary_points',binary_points);
    RETURN QUERY SELECT result_before, result_points, result_rule, result_derived;
    RETURN;
  END IF;

  CASE scoring_type
    WHEN 'binary_yesno' THEN result_points := public.calc_score_binary_yesno(_checkin.boolean_value, config);
    WHEN 'linear_per_unit' THEN SELECT l.points_before_cap, l.points_awarded INTO result_before, result_points FROM public.calc_score_linear_per_unit(raw_value, config) l;
    WHEN 'threshold' THEN result_points := public.calc_score_threshold(raw_value, config);
    WHEN 'time_before' THEN result_points := public.calc_score_time_before(_checkin.time_value::TIME, config);
    WHEN 'time_after' THEN result_points := public.calc_score_time_after(_checkin.time_value::TIME, config);
    WHEN 'tiered' THEN result_points := public.calc_score_tiered(raw_value, config);
    WHEN 'diminishing' THEN result_points := public.calc_score_diminishing(raw_value, config);
    ELSE result_points := 0;
  END CASE;
  IF scoring_type <> 'linear_per_unit' THEN result_before := result_points; END IF;
  result_rule := scoring_type;
  result_derived := jsonb_build_object('scoring_mode','detailed','raw_value',raw_value);
  RETURN QUERY SELECT result_before, result_points, result_rule, result_derived;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_checkin_scoring()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP FUNCTION IF EXISTS public.is_checkin_verified(RECORD, RECORD);
DROP FUNCTION IF EXISTS public.calculate_checkin_score(RECORD, RECORD);
DROP FUNCTION IF EXISTS public.on_checkin_score();

CREATE OR REPLACE FUNCTION public.create_league(_name TEXT, _description TEXT, _game_format TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user_id UUID:=auth.uid(); v_league_id UUID; clean_name TEXT:=btrim(_name); clean_format TEXT:=lower(btrim(COALESCE(_game_format,'head_to_head')));
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF EXISTS(SELECT 1 FROM public.league_members WHERE user_id=v_user_id) THEN RAISE EXCEPTION 'You are already in a league. Leave it before creating another.'; END IF;
  IF clean_name IS NULL OR clean_name='' THEN RAISE EXCEPTION 'League name is required'; END IF;
  IF length(clean_name)>80 THEN RAISE EXCEPTION 'League name must be 80 characters or fewer'; END IF;
  IF clean_format NOT IN('head_to_head','leaderboard','solo') THEN RAISE EXCEPTION 'Invalid league format'; END IF;
  INSERT INTO public.leagues(name,description,created_by,game_format,min_members,max_members,invite_code)
  VALUES(clean_name,NULLIF(btrim(_description),''),v_user_id,clean_format,CASE WHEN clean_format='solo' THEN 1 ELSE 2 END,CASE WHEN clean_format='solo' THEN 1 ELSE 12 END,CASE WHEN clean_format='solo' THEN NULL ELSE encode(extensions.gen_random_bytes(6),'hex') END)
  RETURNING id INTO v_league_id;
  INSERT INTO public.league_members(league_id,user_id,role) VALUES(v_league_id,v_user_id,'owner');
  RETURN v_league_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_accountability_share(_league_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_token TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_league_member(auth.uid(),_league_id) THEN RAISE EXCEPTION 'You must belong to this league'; END IF;
  INSERT INTO public.accountability_shares(league_id,user_id,is_active,revoked_at,updated_at) VALUES(_league_id,auth.uid(),TRUE,NULL,now())
  ON CONFLICT(league_id,user_id) DO UPDATE SET is_active=TRUE,revoked_at=NULL,updated_at=now(),token=encode(extensions.gen_random_bytes(18),'hex') RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.spin_weekly_punishment(_week_id UUID)
RETURNS public.punishment_spins LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user UUID:=auth.uid(); v_week RECORD; v_matchup RECORD; v_option RECORD; v_existing public.punishment_spins; v_result public.punishment_spins; v_user_name TEXT; v_loser_count INT:=0; v_loser UUID; v_winner UUID; v_low_score NUMERIC; v_high_score NUMERIC;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT w.*,s.league_id,COALESCE(l.game_format,'head_to_head') AS game_format INTO v_week FROM public.weeks w JOIN public.seasons s ON s.id=w.season_id JOIN public.leagues l ON l.id=s.league_id WHERE w.id=_week_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Week not found'; END IF;
  IF v_week.week_number<=0 THEN RAISE EXCEPTION 'Preseason has no punishments'; END IF;
  IF v_week.game_format='solo' THEN RAISE EXCEPTION 'Solo has no punishment wheel'; END IF;
  IF NOT public.is_league_member(v_user,v_week.league_id) THEN RAISE EXCEPTION 'Not a league member'; END IF;
  SELECT * INTO v_existing FROM public.punishment_spins ps WHERE ps.week_id=_week_id AND ps.loser_user_id=v_user;
  IF FOUND THEN RETURN v_existing; END IF;
  IF v_week.game_format='head_to_head' THEN
    SELECT * INTO v_matchup FROM public.matchups m WHERE m.week_id=_week_id AND (m.user1_id=v_user OR m.user2_id=v_user) LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'No matchup found for this player'; END IF;
    IF v_matchup.status::TEXT<>'completed' THEN RAISE EXCEPTION 'The matchup must be final before the loser spins'; END IF;
    IF v_matchup.winner_id IS NULL THEN RAISE EXCEPTION 'Tie games have no punishment'; END IF;
    IF v_matchup.winner_id=v_user THEN RAISE EXCEPTION 'Winners do not spin the punishment wheel'; END IF;
    v_loser:=v_user; v_winner:=v_matchup.winner_id;
  ELSIF v_week.game_format='leaderboard' THEN
    IF NOT v_week.is_locked THEN RAISE EXCEPTION 'The weekly leaderboard must be final before last place spins'; END IF;
    WITH scores AS(SELECT lm.user_id,COALESCE(ws.total_points,0)::NUMERIC AS total_points FROM public.league_members lm LEFT JOIN public.weekly_scores ws ON ws.week_id=_week_id AND ws.user_id=lm.user_id WHERE lm.league_id=v_week.league_id) SELECT MIN(total_points),MAX(total_points) INTO v_low_score,v_high_score FROM scores;
    WITH scores AS(SELECT lm.user_id,COALESCE(ws.total_points,0)::NUMERIC AS total_points FROM public.league_members lm LEFT JOIN public.weekly_scores ws ON ws.week_id=_week_id AND ws.user_id=lm.user_id WHERE lm.league_id=v_week.league_id) SELECT COUNT(*),MIN(user_id::TEXT)::UUID INTO v_loser_count,v_loser FROM scores WHERE total_points=v_low_score;
    IF v_loser_count<>1 THEN RAISE EXCEPTION 'Tie for last place — no punishment this week'; END IF;
    IF v_loser<>v_user THEN RAISE EXCEPTION 'Only the unique last-place player spins the punishment wheel'; END IF;
    WITH scores AS(SELECT lm.user_id,COALESCE(ws.total_points,0)::NUMERIC AS total_points FROM public.league_members lm LEFT JOIN public.weekly_scores ws ON ws.week_id=_week_id AND ws.user_id=lm.user_id WHERE lm.league_id=v_week.league_id) SELECT MIN(user_id::TEXT)::UUID INTO v_winner FROM scores WHERE total_points=v_high_score;
  ELSE RAISE EXCEPTION 'Unsupported league format'; END IF;
  SELECT * INTO v_option FROM public.punishment_options po WHERE po.is_active=TRUE AND (po.league_id IS NULL OR po.league_id=v_week.league_id) ORDER BY random() LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No punishment options are configured'; END IF;
  INSERT INTO public.punishment_spins(league_id,week_id,matchup_id,loser_user_id,winner_user_id,punishment_option_id,result_label,result_description,result_emoji)
  VALUES(v_week.league_id,_week_id,CASE WHEN v_week.game_format='head_to_head' THEN v_matchup.id ELSE NULL END,v_loser,v_winner,v_option.id,v_option.label,v_option.description,v_option.emoji) RETURNING * INTO v_result;
  SELECT COALESCE(p.display_name,'The loser') INTO v_user_name FROM public.profiles p WHERE p.id=v_loser;
  INSERT INTO public.league_events(league_id,season_id,week_id,actor_user_id,event_type,title,body,metadata)
  VALUES(v_week.league_id,v_week.season_id,_week_id,v_loser,'punishment_spin',v_result.result_emoji||' '||v_user_name||' spun '||v_result.result_label,v_result.result_description,jsonb_build_object('punishment_spin_id',v_result.id,'loser_user_id',v_loser,'winner_user_id',v_winner,'game_format',v_week.game_format));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.is_checkin_verified(public.daily_checkins,public.task_instances) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.calculate_checkin_score(public.daily_checkins,public.task_instances) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_league(TEXT,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_league(TEXT,TEXT,TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.create_accountability_share(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_accountability_share(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.spin_weekly_punishment(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.spin_weekly_punishment(UUID) TO authenticated;
