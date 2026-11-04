ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_game_format_check;
ALTER TABLE public.leagues ADD CONSTRAINT leagues_game_format_check CHECK (game_format IN ('head_to_head','leaderboard','solo'));

CREATE OR REPLACE FUNCTION public.create_league(_name text, _description text, _game_format text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user_id UUID:=auth.uid(); v_league_id UUID; clean_name TEXT:=btrim(_name); clean_format TEXT:=lower(btrim(COALESCE(_game_format,'head_to_head')));
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF EXISTS(SELECT 1 FROM public.league_members WHERE user_id=v_user_id) THEN RAISE EXCEPTION 'You are already in a league. Leave it before creating another.'; END IF;
  IF clean_name IS NULL OR clean_name='' THEN RAISE EXCEPTION 'League name is required'; END IF;
  IF length(clean_name)>80 THEN RAISE EXCEPTION 'League name must be 80 characters or fewer'; END IF;
  IF clean_format NOT IN('head_to_head','leaderboard','solo') THEN RAISE EXCEPTION 'Invalid league format'; END IF;
  INSERT INTO public.leagues(name,description,created_by,game_format,min_members,max_members,invite_code)
  VALUES(clean_name,NULLIF(btrim(_description),''),v_user_id,clean_format,CASE WHEN clean_format='solo' THEN 1 ELSE 2 END,CASE WHEN clean_format='solo' THEN 1 ELSE 12 END,CASE WHEN clean_format='solo' THEN NULL ELSE encode(gen_random_bytes(6),'hex') END)
  RETURNING id INTO v_league_id;
  INSERT INTO public.league_members(league_id,user_id,role) VALUES(v_league_id,v_user_id,'owner');
  RETURN v_league_id;
END; $$;

CREATE OR REPLACE FUNCTION public.start_league_season(_season_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE season_rec RECORD; member_count INT; task_count INT; league_timezone TEXT:='America/New_York'; local_today DATE; kickoff_date DATE;
BEGIN
  SELECT s.*,l.created_by,COALESCE(l.game_format,'head_to_head') AS game_format INTO season_rec FROM public.seasons s JOIN public.leagues l ON l.id=s.league_id WHERE s.id=_season_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF NOT public.is_league_admin(auth.uid(),season_rec.league_id) THEN RAISE EXCEPTION 'Only a league owner or admin can start the season'; END IF;
  IF season_rec.status='active' THEN RETURN; END IF;
  IF season_rec.status<>'draft' THEN RAISE EXCEPTION 'Only a draft season can be started'; END IF;
  SELECT COALESCE(p.timezone,'America/New_York') INTO league_timezone FROM public.profiles p WHERE p.id=season_rec.created_by;
  league_timezone:=COALESCE(league_timezone,'America/New_York');
  local_today:=(now() AT TIME ZONE league_timezone)::DATE;
  kickoff_date:=CASE WHEN season_rec.game_format='solo' THEN local_today ELSE local_today+((7-EXTRACT(DOW FROM local_today)::INT)%7) END;
  SELECT COUNT(*) INTO member_count FROM public.league_members lm WHERE lm.league_id=season_rec.league_id;
  IF season_rec.game_format='solo' THEN
    IF member_count<1 THEN RAISE EXCEPTION 'Solo season requires its owner'; END IF;
  ELSIF member_count<2 THEN
    IF season_rec.game_format='leaderboard' THEN RAISE EXCEPTION 'Invite at least one other player before starting the leaderboard';
    ELSE RAISE EXCEPTION 'Invite at least one opponent before starting the season'; END IF;
  END IF;
  SELECT COUNT(*) INTO task_count FROM public.league_task_configs ltc WHERE ltc.season_id=_season_id AND ltc.is_enabled=TRUE;
  IF task_count<3 THEN RAISE EXCEPTION 'Configure at least three scoring tasks before starting the season'; END IF;
  DELETE FROM public.weeks w WHERE w.season_id=_season_id AND w.week_number=0;
  UPDATE public.weeks w SET start_date=kickoff_date+((w.week_number-1)*7),end_date=kickoff_date+((w.week_number-1)*7)+6,is_locked=FALSE WHERE w.season_id=_season_id AND w.week_number>0;
  IF season_rec.game_format<>'solo' AND kickoff_date>local_today THEN INSERT INTO public.weeks(season_id,week_number,start_date,end_date,is_locked) VALUES(_season_id,0,local_today,kickoff_date-1,FALSE); END IF;
  UPDATE public.seasons s SET start_date=kickoff_date,end_date=kickoff_date+(s.weeks_count*7)-1,status='active',updated_at=now() WHERE s.id=_season_id;
END; $$;

CREATE OR REPLACE FUNCTION public.refresh_season_matchups(_season_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_league_id UUID; v_game_format TEXT:='head_to_head'; member_ids UUID[]; rotation UUID[]; member_count INT:=0; slot_count INT:=0; pair_index INT; left_user UUID; right_user UUID; week_rec RECORD; can_rebuild BOOLEAN;
BEGIN
  SELECT s.league_id,COALESCE(l.game_format,'head_to_head') INTO v_league_id,v_game_format FROM public.seasons s JOIN public.leagues l ON l.id=s.league_id WHERE s.id=_season_id;
  IF v_league_id IS NULL THEN RETURN; END IF;
  IF v_game_format IN('leaderboard','solo') THEN DELETE FROM public.matchups m USING public.weeks w WHERE m.week_id=w.id AND w.season_id=_season_id; RETURN; END IF;
  SELECT array_agg(lm.user_id ORDER BY lm.joined_at,lm.user_id) INTO member_ids FROM public.league_members lm WHERE lm.league_id=v_league_id;
  member_count:=COALESCE(array_length(member_ids,1),0);
  IF member_count>0 THEN rotation:=member_ids; IF member_count%2=1 THEN rotation:=array_append(rotation,NULL::UUID); END IF; slot_count:=array_length(rotation,1); END IF;
  FOR week_rec IN SELECT w.id,w.week_number,w.is_locked FROM public.weeks w WHERE w.season_id=_season_id AND w.week_number>0 ORDER BY w.week_number LOOP
    can_rebuild:=NOT week_rec.is_locked AND NOT EXISTS(SELECT 1 FROM public.scoring_events se WHERE se.week_id=week_rec.id AND se.is_reversed=FALSE) AND NOT EXISTS(SELECT 1 FROM public.matchups m WHERE m.week_id=week_rec.id AND m.status='completed');
    IF can_rebuild THEN DELETE FROM public.matchups m WHERE m.week_id=week_rec.id; IF member_count>=2 THEN FOR pair_index IN 1..(slot_count/2) LOOP left_user:=rotation[pair_index]; right_user:=rotation[slot_count-pair_index+1]; IF left_user IS NOT NULL AND right_user IS NOT NULL THEN INSERT INTO public.matchups(week_id,user1_id,user2_id,user1_score,user2_score,status) VALUES(week_rec.id,left_user,right_user,COALESCE((SELECT ws.total_points FROM public.weekly_scores ws WHERE ws.week_id=week_rec.id AND ws.user_id=left_user),0),COALESCE((SELECT ws.total_points FROM public.weekly_scores ws WHERE ws.week_id=week_rec.id AND ws.user_id=right_user),0),'scheduled'); END IF; END LOOP; END IF; END IF;
    IF slot_count>2 THEN rotation:=ARRAY[rotation[1],rotation[slot_count]]||rotation[2:slot_count-1]; END IF;
  END LOOP;
END; $$;

CREATE TABLE IF NOT EXISTS public.accountability_shares(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),revoked_at TIMESTAMPTZ,UNIQUE(league_id,user_id));
CREATE INDEX IF NOT EXISTS idx_accountability_shares_token_active ON public.accountability_shares(token,is_active);
ALTER TABLE public.accountability_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accountability_shares_owner_read ON public.accountability_shares;
CREATE POLICY accountability_shares_owner_read ON public.accountability_shares FOR SELECT TO authenticated USING(auth.uid()=user_id);
REVOKE ALL ON public.accountability_shares FROM anon,authenticated;
GRANT SELECT ON public.accountability_shares TO authenticated;

CREATE OR REPLACE FUNCTION public.create_accountability_share(_league_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_token TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_league_member(auth.uid(),_league_id) THEN RAISE EXCEPTION 'You must belong to this league'; END IF;
  INSERT INTO public.accountability_shares(league_id,user_id,is_active,revoked_at,updated_at) VALUES(_league_id,auth.uid(),TRUE,NULL,now())
  ON CONFLICT(league_id,user_id) DO UPDATE SET is_active=TRUE,revoked_at=NULL,updated_at=now(),token=encode(gen_random_bytes(18),'hex') RETURNING token INTO v_token;
  RETURN v_token;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_accountability_share(_league_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE public.accountability_shares SET is_active=FALSE,revoked_at=now(),updated_at=now() WHERE league_id=_league_id AND user_id=auth.uid(); END; $$;

CREATE OR REPLACE FUNCTION public.get_public_accountability_snapshot(_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_share RECORD; v_profile RECORD; v_season RECORD; v_week RECORD; v_timezone TEXT:='America/New_York'; v_today DATE; v_tasks JSONB:='[]'::jsonb; v_week_points NUMERIC:=0; v_perfect_days INT:=0; v_total_tasks INT:=0; v_hit_tasks INT:=0; v_resolved_tasks INT:=0;
BEGIN
  SELECT a.*,l.name AS league_name,l.game_format INTO v_share FROM public.accountability_shares a JOIN public.leagues l ON l.id=a.league_id WHERE a.token=_token AND a.is_active=TRUE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT p.display_name,p.avatar_url,COALESCE(p.timezone,'America/New_York') AS timezone INTO v_profile FROM public.profiles p WHERE p.id=v_share.user_id;
  v_timezone:=COALESCE(v_profile.timezone,'America/New_York'); v_today:=(now() AT TIME ZONE v_timezone)::DATE;
  SELECT s.* INTO v_season FROM public.seasons s WHERE s.league_id=v_share.league_id AND s.status='active' ORDER BY s.season_number DESC LIMIT 1;
  IF v_season.id IS NOT NULL THEN SELECT w.* INTO v_week FROM public.weeks w WHERE w.season_id=v_season.id AND v_today BETWEEN w.start_date AND w.end_date ORDER BY w.week_number DESC LIMIT 1; END IF;
  IF v_week.id IS NOT NULL THEN SELECT COALESCE(ws.total_points,0),COALESCE(ws.perfect_days,0) INTO v_week_points,v_perfect_days FROM public.weekly_scores ws WHERE ws.week_id=v_week.id AND ws.user_id=v_share.user_id; IF NOT FOUND THEN v_week_points:=0; v_perfect_days:=0; END IF; END IF;
  IF v_season.id IS NOT NULL THEN
    WITH task_rows AS(
      SELECT ti.id,ti.task_name,COALESCE(tt.icon,'activity') AS icon,COALESCE(tt.unit::text,'count') AS unit,ti.config,dc.id AS checkin_id,COALESCE(se.points_today,0) AS points_today,
        CASE WHEN dc.id IS NULL THEN 'pending' WHEN COALESCE(ti.config->>'scoring_mode','detailed')='binary' AND COALESCE(se.points_today,0)>0 THEN 'hit' WHEN COALESCE(ti.config->>'scoring_mode','detailed')='binary' THEN 'missed' ELSE 'logged' END AS status,
        CASE WHEN ti.config?'target_time' THEN 'By '||(ti.config->>'target_time') WHEN ti.config?'daily_limit_minutes' THEN '≤ '||(ti.config->>'daily_limit_minutes')||' min' WHEN ti.config?'target' THEN (ti.config->>'target')||' '||COALESCE(tt.unit::text,'') WHEN ti.config?'threshold' THEN (ti.config->>'threshold')||' '||COALESCE(tt.unit::text,'') ELSE NULL END AS goal
      FROM public.task_instances ti JOIN public.league_task_configs ltc ON ltc.id=ti.league_task_config_id LEFT JOIN public.task_templates tt ON tt.id=ltc.task_template_id
      LEFT JOIN LATERAL(SELECT d.* FROM public.daily_checkins d WHERE d.user_id=v_share.user_id AND d.task_instance_id=ti.id AND d.checkin_date=v_today ORDER BY d.updated_at DESC LIMIT 1) dc ON TRUE
      LEFT JOIN LATERAL(SELECT COALESCE(SUM(s.points_awarded),0) AS points_today FROM public.scoring_events s JOIN public.daily_checkins d2 ON d2.id=s.daily_checkin_id WHERE s.user_id=v_share.user_id AND s.task_instance_id=ti.id AND d2.checkin_date=v_today AND s.is_reversed=FALSE) se ON TRUE
      WHERE ti.season_id=v_season.id AND ltc.is_enabled=TRUE ORDER BY ltc.display_order,ti.task_name)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name',task_name,'icon',icon,'goal',goal,'status',status,'points_today',points_today)),'[]'::jsonb),COUNT(*)::INT,COUNT(*) FILTER(WHERE status='hit')::INT,COUNT(*) FILTER(WHERE status IN('hit','missed','logged'))::INT INTO v_tasks,v_total_tasks,v_hit_tasks,v_resolved_tasks FROM task_rows;
  END IF;
  RETURN jsonb_build_object('display_name',COALESCE(v_profile.display_name,'Zrizin player'),'avatar',v_profile.avatar_url,'league_name',v_share.league_name,'format',v_share.game_format,'date',v_today,'season_number',v_season.season_number,'week_number',v_week.week_number,'week_points',v_week_points,'perfect_days',v_perfect_days,'tasks_total',v_total_tasks,'tasks_hit',v_hit_tasks,'tasks_resolved',v_resolved_tasks,'tasks',v_tasks,'generated_at',now());
END; $$;

REVOKE ALL ON FUNCTION public.create_accountability_share(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.revoke_accountability_share(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_accountability_share(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_accountability_share(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_accountability_snapshot(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_accountability_snapshot(TEXT) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.create_league(TEXT,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_league(TEXT,TEXT,TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.start_league_season(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_league_season(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.refresh_season_matchups(UUID) FROM PUBLIC,anon,authenticated;
