CREATE OR REPLACE FUNCTION public.get_my_weekly_recap(_week_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user UUID:=auth.uid(); v_week RECORD; v_score RECORD; v_matchup RECORD; v_opponent UUID; v_opponent_name TEXT; v_result TEXT; v_rank INT; v_member_count INT; v_top_task TEXT; v_top_task_points NUMERIC:=0; v_power_play BOOLEAN:=FALSE; v_punishment RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT w.*,s.league_id,COALESCE(l.game_format,'head_to_head') AS game_format INTO v_week FROM public.weeks w JOIN public.seasons s ON s.id=w.season_id JOIN public.leagues l ON l.id=s.league_id WHERE w.id=_week_id;
  IF NOT FOUND OR v_week.week_number<=0 THEN RETURN NULL; END IF;
  IF NOT public.is_league_member(v_user,v_week.league_id) THEN RAISE EXCEPTION 'Not a league member'; END IF;
  IF NOT v_week.is_locked THEN RETURN NULL; END IF;
  SELECT COALESCE(ws.total_points,0) AS total_points,COALESCE(ws.tasks_completed,0) AS tasks_completed,COALESCE(ws.perfect_days,0) AS perfect_days INTO v_score FROM public.weekly_scores ws WHERE ws.week_id=_week_id AND ws.user_id=v_user;
  IF NOT FOUND THEN v_score.total_points:=0; v_score.tasks_completed:=0; v_score.perfect_days:=0; END IF;
  SELECT ti.task_name,COALESCE(SUM(se.points_awarded),0) INTO v_top_task,v_top_task_points FROM public.scoring_events se JOIN public.task_instances ti ON ti.id=se.task_instance_id WHERE se.week_id=_week_id AND se.user_id=v_user AND se.is_reversed=FALSE GROUP BY ti.task_name ORDER BY SUM(se.points_awarded) DESC,ti.task_name LIMIT 1;
  SELECT EXISTS(SELECT 1 FROM public.powerups p WHERE p.week_id=_week_id AND p.user_id=v_user AND p.is_used=TRUE AND p.powerup_type='multiplier') INTO v_power_play;
  SELECT ps.result_label,ps.result_emoji,ps.completed_at INTO v_punishment FROM public.punishment_spins ps WHERE ps.week_id=_week_id AND ps.loser_user_id=v_user LIMIT 1;
  IF v_week.game_format='head_to_head' THEN
    SELECT * INTO v_matchup FROM public.matchups m WHERE m.week_id=_week_id AND (m.user1_id=v_user OR m.user2_id=v_user) LIMIT 1;
    IF FOUND THEN v_opponent:=CASE WHEN v_matchup.user1_id=v_user THEN v_matchup.user2_id ELSE v_matchup.user1_id END; SELECT COALESCE(p.display_name,'Opponent') INTO v_opponent_name FROM public.profiles p WHERE p.id=v_opponent; v_result:=CASE WHEN v_matchup.winner_id IS NULL THEN 'T' WHEN v_matchup.winner_id=v_user THEN 'W' ELSE 'L' END; ELSE v_result:='BYE'; END IF;
  ELSIF v_week.game_format='leaderboard' THEN
    WITH scores AS (SELECT lm.user_id,COALESCE(ws.total_points,0)::NUMERIC AS points FROM public.league_members lm LEFT JOIN public.weekly_scores ws ON ws.week_id=_week_id AND ws.user_id=lm.user_id WHERE lm.league_id=v_week.league_id),ranked AS(SELECT user_id,RANK() OVER(ORDER BY points DESC) AS rank FROM scores) SELECT rank::INT INTO v_rank FROM ranked WHERE user_id=v_user;
    SELECT COUNT(*)::INT INTO v_member_count FROM public.league_members WHERE league_id=v_week.league_id; v_result:='RANK';
  ELSE v_result:='SOLO'; END IF;
  RETURN jsonb_build_object('week_id',_week_id,'week_number',v_week.week_number,'format',v_week.game_format,'points',COALESCE(v_score.total_points,0),'tasks_completed',COALESCE(v_score.tasks_completed,0),'perfect_days',COALESCE(v_score.perfect_days,0),'top_task',v_top_task,'top_task_points',COALESCE(v_top_task_points,0),'power_play_used',v_power_play,'result',v_result,'opponent_name',v_opponent_name,'user_score',CASE WHEN v_week.game_format='head_to_head' AND v_matchup.id IS NOT NULL THEN CASE WHEN v_matchup.user1_id=v_user THEN v_matchup.user1_score ELSE v_matchup.user2_score END ELSE NULL END,'opponent_score',CASE WHEN v_week.game_format='head_to_head' AND v_matchup.id IS NOT NULL THEN CASE WHEN v_matchup.user1_id=v_user THEN v_matchup.user2_score ELSE v_matchup.user1_score END ELSE NULL END,'weekly_rank',v_rank,'member_count',v_member_count,'punishment_label',v_punishment.result_label,'punishment_emoji',v_punishment.result_emoji,'punishment_completed',v_punishment.completed_at IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_weekly_recap(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_weekly_recap(UUID) TO authenticated;
