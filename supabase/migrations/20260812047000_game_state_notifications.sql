CREATE OR REPLACE FUNCTION public.sync_matchup_score(_user_id UUID, _week_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_total NUMERIC := 0;
  m RECORD;
  old_user_score NUMERIC := 0;
  old_opp_score NUMERIC := 0;
  new_user_score NUMERIC := 0;
  opponent_id UUID;
  scorer_name TEXT := 'Opponent';
  league_id UUID;
  latest_event RECORD;
BEGIN
  SELECT COALESCE(ws.total_points,0) INTO current_total FROM public.weekly_scores ws WHERE ws.user_id=_user_id AND ws.week_id=_week_id;
  IF NOT FOUND THEN current_total:=0; END IF;
  SELECT mt.*, s.league_id INTO m FROM public.matchups mt JOIN public.weeks w ON w.id=mt.week_id JOIN public.seasons s ON s.id=w.season_id WHERE mt.week_id=_week_id AND (mt.user1_id=_user_id OR mt.user2_id=_user_id) LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  league_id := m.league_id;
  IF m.user1_id=_user_id THEN
    old_user_score:=COALESCE(m.user1_score,0); old_opp_score:=COALESCE(m.user2_score,0); opponent_id:=m.user2_id;
    UPDATE public.matchups SET user1_score=current_total,updated_at=now() WHERE id=m.id;
  ELSE
    old_user_score:=COALESCE(m.user2_score,0); old_opp_score:=COALESCE(m.user1_score,0); opponent_id:=m.user1_id;
    UPDATE public.matchups SET user2_score=current_total,updated_at=now() WHERE id=m.id;
  END IF;
  new_user_score:=current_total;
  IF m.status::text='in_progress' AND opponent_id IS NOT NULL THEN
    SELECT COALESCE(p.display_name,'Opponent') INTO scorer_name FROM public.profiles p WHERE p.id=_user_id;
    IF old_user_score<=old_opp_score AND new_user_score>old_opp_score THEN
      INSERT INTO public.user_notifications(user_id,league_id,type,title,body,notify_date) VALUES(opponent_id,league_id,'matchup_lead_change',scorer_name||' just passed you','You trail '||old_opp_score::text||'-'||new_user_score::text||'. One scoring play can swing it.',CURRENT_DATE);
    ELSIF old_user_score<old_opp_score AND new_user_score=old_opp_score THEN
      INSERT INTO public.user_notifications(user_id,league_id,type,title,body,notify_date) VALUES(opponent_id,league_id,'matchup_tied',scorer_name||' tied the game','It is '||new_user_score::text||'-'||old_opp_score::text||'. Next score takes the lead.',CURRENT_DATE);
    END IF;
    SELECT se.points_awarded,se.powerup_applied,ti.task_name INTO latest_event FROM public.scoring_events se JOIN public.task_instances ti ON ti.id=se.task_instance_id WHERE se.user_id=_user_id AND se.week_id=_week_id AND se.is_reversed=FALSE ORDER BY se.created_at DESC LIMIT 1;
    IF FOUND AND latest_event.powerup_applied IS NOT NULL AND COALESCE(latest_event.points_awarded,0)>0 THEN
      INSERT INTO public.user_notifications(user_id,league_id,type,title,body,notify_date) VALUES(opponent_id,league_id,'power_play_used','⚡ '||scorer_name||' dropped a Power Play',latest_event.task_name||' just scored +'||latest_event.points_awarded::text||'.',CURRENT_DATE);
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_matchup_final()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_league_id UUID; v_week_number INT; v_user1_name TEXT; v_user2_name TEXT;
BEGIN
  IF NEW.status::text<>'completed' OR OLD.status::text='completed' THEN RETURN NEW; END IF;
  SELECT s.league_id,w.week_number INTO v_league_id,v_week_number FROM public.weeks w JOIN public.seasons s ON s.id=w.season_id WHERE w.id=NEW.week_id;
  IF v_week_number IS NULL OR v_week_number<=0 THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name,'Opponent') INTO v_user1_name FROM public.profiles WHERE id=NEW.user1_id;
  SELECT COALESCE(display_name,'Opponent') INTO v_user2_name FROM public.profiles WHERE id=NEW.user2_id;
  IF NEW.winner_id IS NULL THEN
    INSERT INTO public.user_notifications(user_id,league_id,type,title,body,notify_date) VALUES
      (NEW.user1_id,v_league_id,'matchup_final','Week '||v_week_number||' final — tie game',NEW.user1_score::text||'-'||NEW.user2_score::text||'. No punishment wheel this week.',CURRENT_DATE),
      (NEW.user2_id,v_league_id,'matchup_final','Week '||v_week_number||' final — tie game',NEW.user2_score::text||'-'||NEW.user1_score::text||'. No punishment wheel this week.',CURRENT_DATE);
  ELSE
    INSERT INTO public.user_notifications(user_id,league_id,type,title,body,notify_date) VALUES
      (NEW.winner_id,v_league_id,'matchup_final','🏆 Week '||v_week_number||' win secured',CASE WHEN NEW.winner_id=NEW.user1_id THEN NEW.user1_score::text||'-'||NEW.user2_score::text||'. '||v_user2_name||' owes the wheel.' ELSE NEW.user2_score::text||'-'||NEW.user1_score::text||'. '||v_user1_name||' owes the wheel.' END,CURRENT_DATE),
      (CASE WHEN NEW.winner_id=NEW.user1_id THEN NEW.user2_id ELSE NEW.user1_id END,v_league_id,'matchup_final','💀 Week '||v_week_number||' is final — time to spin',CASE WHEN NEW.winner_id=NEW.user1_id THEN NEW.user2_score::text||'-'||NEW.user1_score::text||'. Open the matchup and spin your punishment.' ELSE NEW.user1_score::text||'-'||NEW.user2_score::text||'. Open the matchup and spin your punishment.' END,CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_matchup_final_trigger ON public.matchups;
CREATE TRIGGER notify_matchup_final_trigger AFTER UPDATE OF status ON public.matchups FOR EACH ROW EXECUTE FUNCTION public.notify_matchup_final();
REVOKE ALL ON FUNCTION public.sync_matchup_score(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.notify_matchup_final() FROM PUBLIC,anon,authenticated;
