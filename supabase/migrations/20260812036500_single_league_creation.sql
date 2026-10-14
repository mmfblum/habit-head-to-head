-- Keep the current product contract explicit: one active league membership per
-- account. This matches useUserPrimaryLeague and the join RPC.
CREATE OR REPLACE FUNCTION public.create_league(
    _name TEXT,
    _description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_league_id UUID;
    clean_name TEXT := btrim(_name);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.league_members lm
        WHERE lm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'You are already in a league. Leave it before creating another.';
    END IF;

    IF clean_name IS NULL OR clean_name = '' THEN
        RAISE EXCEPTION 'League name is required';
    END IF;

    IF length(clean_name) > 80 THEN
        RAISE EXCEPTION 'League name must be 80 characters or fewer';
    END IF;

    INSERT INTO public.leagues (name, description, created_by)
    VALUES (clean_name, NULLIF(btrim(_description), ''), v_user_id)
    RETURNING id INTO v_league_id;

    INSERT INTO public.league_members (league_id, user_id, role)
    VALUES (v_league_id, v_user_id, 'owner');

    RETURN v_league_id;
END;
$$;
