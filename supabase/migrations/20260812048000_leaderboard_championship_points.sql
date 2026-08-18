ALTER TABLE public.season_standings
ADD COLUMN IF NOT EXISTS championship_points INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.leaderboard_week_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_points NUMERIC NOT NULL DEFAULT 0,
  weekly_rank INTEGER NOT NULL,
  championship_points INTEGER NOT NULL DEFAULT 0,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_week_results_season ON public.leaderboard_week_results(season_id, championship_points DESC, weekly_points DESC);
ALTER TABLE public.leaderboard_week_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leaderboard_week_results_read ON public.leaderboard_week_results;
CREATE POLICY leaderboard_week_results_read ON public.leaderboard_week_results FOR SELECT TO authenticated USING (public.is_league_member(auth.uid(), league_id));
REVOKE INSERT, UPDATE, DELETE ON public.leaderboard_week_results FROM anon, authenticated;
REVOKE ALL ON public.leaderboard_week_results FROM anon;
GRANT SELECT ON public.leaderboard_week_results TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_leaderboard_week(_week_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_season_id UUID; v_league_id UUID; v_format TEXT; v_week_number INT;
BEGIN
  SELECT w.season_id,s.league_id,COALESCE(l.game_format,'head_to_head'),w.week_number INTO v_season_id,v_league_id,v_format,v_week_number
  FROM public.weeks w JOIN public.seasons s ON s.id=w.season_id JOIN public.leagues l ON l.id=s.league_id WHERE w.id=_week_id;
  IF v_season_id IS NULL OR v_format<>'leaderboard' OR v_week_number<=0 THEN RETURN; END IF;
  INSERT INTO public.leaderboard_week_results(league_id,season_id,week_id,user_id,weekly_points,weekly_rank,championship_points)
  WITH scored AS (
    SELECT lm.user_id,COALESCE(ws.total_points,0)::NUMERIC AS total_points
    FROM public.league_members lm LEFT JOIN public.weekly_scores ws ON ws.week_id=_week_id AND ws.user_id=lm.user_id
    WHERE lm.league_id=v_league_id
  ), ranked AS (
    SELECT user_id,total_points,RANK() OVER (ORDER BY total_points DESC) AS finish_rank FROM scored
  )
  SELECT v_league_id,v_season_id,_week_id,user_id,total_points,finish_rank,
    CASE finish_rank WHEN 1 THEN 10 WHEN 2 THEN 7 WHEN 3 THEN 5 WHEN 4 THEN 3 WHEN 5 THEN 2 ELSE 1 END
  FROM ranked ON CONFLICT (week_id,user_id) DO NOTHING;

  UPDATE public.season_standings ss
  SET championship_points=COALESCE(t.total_championship_points,0),updated_at=now()
  FROM (SELECT user_id,SUM(championship_points)::INT AS total_championship_points FROM public.leaderboard_week_results WHERE season_id=v_season_id GROUP BY user_id) t
  WHERE ss.season_id=v_season_id AND ss.user_id=t.user_id;
  UPDATE public.season_standings ss SET championship_points=0,updated_at=now()
  WHERE ss.season_id=v_season_id AND NOT EXISTS (SELECT 1 FROM public.leaderboard_week_results r WHERE r.season_id=v_season_id AND r.user_id=ss.user_id);
  WITH ranked_season AS (
    SELECT user_id,RANK() OVER (ORDER BY championship_points DESC,total_points DESC) AS season_rank FROM public.season_standings WHERE season_id=v_season_id
  )
  UPDATE public.season_standings ss SET current_rank=ranked_season.season_rank,updated_at=now()
  FROM ranked_season WHERE ss.season_id=v_season_id AND ss.user_id=ranked_season.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_leaderboard_week_locked()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.is_locked=TRUE AND OLD.is_locked=FALSE AND NEW.week_number>0 THEN PERFORM public.finalize_leaderboard_week(NEW.id); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS leaderboard_week_locked_trigger ON public.weeks;
CREATE TRIGGER leaderboard_week_locked_trigger AFTER UPDATE OF is_locked ON public.weeks FOR EACH ROW EXECUTE FUNCTION public.on_leaderboard_week_locked();
REVOKE ALL ON FUNCTION public.finalize_leaderboard_week(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.on_leaderboard_week_locked() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE w RECORD; BEGIN
  FOR w IN SELECT wk.id FROM public.weeks wk JOIN public.seasons s ON s.id=wk.season_id JOIN public.leagues l ON l.id=s.league_id WHERE wk.is_locked=TRUE AND wk.week_number>0 AND l.game_format='leaderboard' ORDER BY wk.end_date
  LOOP PERFORM public.finalize_leaderboard_week(w.id); END LOOP;
END $$;
