CREATE OR REPLACE FUNCTION public.create_league(
  _name TEXT,
  _description TEXT,
  _game_format TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_league_id UUID;
  clean_name TEXT := btrim(_name);
  clean_format TEXT := lower(btrim(COALESCE(_game_format, 'head_to_head')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.league_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'You are already in a league. Leave it before creating another.';
  END IF;

  IF clean_name IS NULL OR clean_name = '' THEN
    RAISE EXCEPTION 'League name is required';
  END IF;

  IF length(clean_name) > 80 THEN
    RAISE EXCEPTION 'League name must be 80 characters or fewer';
  END IF;

  IF clean_format NOT IN ('head_to_head', 'leaderboard') THEN
    RAISE EXCEPTION 'Invalid league format';
  END IF;

  INSERT INTO public.leagues(name, description, created_by, game_format)
  VALUES(clean_name, NULLIF(btrim(_description), ''), v_user_id, clean_format)
  RETURNING id INTO v_league_id;

  INSERT INTO public.league_members(league_id, user_id, role)
  VALUES(v_league_id, v_user_id, 'owner');

  RETURN v_league_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_league(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_league(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_league(TEXT, TEXT, TEXT) TO authenticated;
