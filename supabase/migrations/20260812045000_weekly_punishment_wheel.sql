CREATE TABLE IF NOT EXISTS public.punishment_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '💀',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT punishment_option_scope CHECK (league_id IS NOT NULL OR created_by IS NULL)
);

CREATE TABLE IF NOT EXISTS public.punishment_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  matchup_id UUID NOT NULL REFERENCES public.matchups(id) ON DELETE CASCADE,
  loser_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  winner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  punishment_option_id UUID REFERENCES public.punishment_options(id) ON DELETE SET NULL,
  result_label TEXT NOT NULL,
  result_description TEXT NOT NULL,
  result_emoji TEXT NOT NULL,
  spun_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (week_id, loser_user_id)
);

CREATE INDEX IF NOT EXISTS idx_punishment_options_league ON public.punishment_options(league_id, is_active);
CREATE INDEX IF NOT EXISTS idx_punishment_spins_league_week ON public.punishment_spins(league_id, week_id);
CREATE INDEX IF NOT EXISTS idx_punishment_spins_loser ON public.punishment_spins(loser_user_id, spun_at DESC);

ALTER TABLE public.punishment_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punishment_spins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS punishment_options_read ON public.punishment_options;
CREATE POLICY punishment_options_read ON public.punishment_options FOR SELECT TO authenticated
USING (league_id IS NULL OR public.is_league_member(auth.uid(), league_id));
DROP POLICY IF EXISTS punishment_spins_read ON public.punishment_spins;
CREATE POLICY punishment_spins_read ON public.punishment_spins FOR SELECT TO authenticated
USING (public.is_league_member(auth.uid(), league_id));
REVOKE INSERT, UPDATE, DELETE ON public.punishment_options FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.punishment_spins FROM anon, authenticated;
GRANT SELECT ON public.punishment_options TO authenticated;
GRANT SELECT ON public.punishment_spins TO authenticated;

INSERT INTO public.punishment_options (label, description, emoji)
SELECT * FROM (VALUES
  ('Donkey Week', 'Wear the donkey badge until the next kickoff.', '🫏'),
  ('Loser Badge', 'Your profile carries the WEEKLY LOSER badge until next kickoff.', '💀'),
  ('Concession Speech', 'Post a short concession speech in the league feed.', '🎙️'),
  ('Compliment the Winner', 'Give the winner one sincere compliment in the league feed.', '👏'),
  ('Winner’s Mascot', 'Let the winner choose your mascot until the next kickoff.', '🎭'),
  ('Extra Credit', 'Complete one extra 10-minute league-approved skill or learning challenge before Monday night.', '📚')
) AS defaults(label, description, emoji)
WHERE NOT EXISTS (SELECT 1 FROM public.punishment_options po WHERE po.league_id IS NULL AND po.label = defaults.label);

CREATE OR REPLACE FUNCTION public.spin_weekly_punishment(_week_id UUID)
RETURNS public.punishment_spins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_week RECORD;
  v_matchup RECORD;
  v_option RECORD;
  v_existing public.punishment_spins;
  v_result public.punishment_spins;
  v_user_name TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT w.*, s.league_id, COALESCE(l.game_format, 'head_to_head') AS game_format INTO v_week
  FROM public.weeks w JOIN public.seasons s ON s.id = w.season_id JOIN public.leagues l ON l.id = s.league_id
  WHERE w.id = _week_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Week not found'; END IF;
  IF v_week.week_number <= 0 THEN RAISE EXCEPTION 'Preseason has no punishments'; END IF;
  IF v_week.game_format <> 'head_to_head' THEN RAISE EXCEPTION 'Punishment wheel is currently available for Head-to-Head leagues'; END IF;
  IF NOT public.is_league_member(v_user, v_week.league_id) THEN RAISE EXCEPTION 'Not a league member'; END IF;

  SELECT * INTO v_matchup FROM public.matchups m
  WHERE m.week_id = _week_id AND (m.user1_id = v_user OR m.user2_id = v_user) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No matchup found for this player'; END IF;
  IF v_matchup.status::text <> 'completed' THEN RAISE EXCEPTION 'The matchup must be final before the loser spins'; END IF;
  IF v_matchup.winner_id IS NULL THEN RAISE EXCEPTION 'Tie games have no punishment'; END IF;
  IF v_matchup.winner_id = v_user THEN RAISE EXCEPTION 'Winners do not spin the punishment wheel'; END IF;

  SELECT * INTO v_existing FROM public.punishment_spins ps WHERE ps.week_id = _week_id AND ps.loser_user_id = v_user;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT * INTO v_option FROM public.punishment_options po
  WHERE po.is_active = TRUE AND (po.league_id IS NULL OR po.league_id = v_week.league_id)
  ORDER BY random() LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No punishment options are configured'; END IF;

  INSERT INTO public.punishment_spins (
    league_id, week_id, matchup_id, loser_user_id, winner_user_id,
    punishment_option_id, result_label, result_description, result_emoji
  ) VALUES (
    v_week.league_id, _week_id, v_matchup.id, v_user, v_matchup.winner_id,
    v_option.id, v_option.label, v_option.description, v_option.emoji
  ) RETURNING * INTO v_result;

  SELECT COALESCE(p.display_name, 'The loser') INTO v_user_name FROM public.profiles p WHERE p.id = v_user;
  INSERT INTO public.league_events (league_id, season_id, week_id, actor_user_id, event_type, title, body, metadata)
  VALUES (v_week.league_id, v_week.season_id, _week_id, v_user, 'punishment_spin',
    v_result.result_emoji || ' ' || v_user_name || ' spun ' || v_result.result_label,
    v_result.result_description,
    jsonb_build_object('punishment_spin_id', v_result.id, 'loser_user_id', v_user, 'winner_user_id', v_matchup.winner_id));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_weekly_punishment(_spin_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_spin public.punishment_spins; v_name TEXT;
BEGIN
  SELECT * INTO v_spin FROM public.punishment_spins WHERE id = _spin_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Punishment not found'; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> v_spin.loser_user_id THEN RAISE EXCEPTION 'Only the punished player can mark this complete'; END IF;
  IF v_spin.completed_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.punishment_spins SET completed_at = now() WHERE id = _spin_id;
  SELECT COALESCE(p.display_name, 'Player') INTO v_name FROM public.profiles p WHERE p.id = auth.uid();
  INSERT INTO public.league_events (league_id, week_id, actor_user_id, event_type, title, body, metadata)
  VALUES (v_spin.league_id, v_spin.week_id, auth.uid(), 'punishment_complete', '✅ ' || v_name || ' completed the punishment', v_spin.result_label, jsonb_build_object('punishment_spin_id', v_spin.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.add_league_punishment(_league_id UUID, _label TEXT, _description TEXT, _emoji TEXT DEFAULT '🎲')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_league_admin(auth.uid(), _league_id) THEN RAISE EXCEPTION 'Only a league owner or admin can add punishments'; END IF;
  IF btrim(COALESCE(_label,'')) = '' OR length(btrim(_label)) > 60 THEN RAISE EXCEPTION 'Punishment name must be 1-60 characters'; END IF;
  IF btrim(COALESCE(_description,'')) = '' OR length(btrim(_description)) > 240 THEN RAISE EXCEPTION 'Punishment description must be 1-240 characters'; END IF;
  INSERT INTO public.punishment_options(league_id,label,description,emoji,created_by)
  VALUES(_league_id,btrim(_label),btrim(_description),COALESCE(NULLIF(btrim(_emoji),''),'🎲'),auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.spin_weekly_punishment(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_weekly_punishment(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_league_punishment(UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_weekly_punishment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_weekly_punishment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_league_punishment(UUID,TEXT,TEXT,TEXT) TO authenticated;
