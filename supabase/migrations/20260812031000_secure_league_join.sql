-- =============================================================================
-- SECURE LEAGUE JOINING
-- =============================================================================
-- Joining by invite code must work before the user is a member (and therefore
-- before league SELECT RLS permits access), while direct league_members INSERTs
-- must not let a client bypass the invite code.
-- =============================================================================

DROP POLICY IF EXISTS "Users can join leagues" ON public.league_members;
DROP POLICY IF EXISTS "League creators can add owner membership" ON public.league_members;

-- Preserve the existing two-step league creation flow: immediately after a user
-- creates a league, they may add only themselves as that league's owner.
CREATE POLICY "League creators can add owner membership"
ON public.league_members
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND role = 'owner'
    AND EXISTS (
        SELECT 1
        FROM public.leagues l
        WHERE l.id = league_id
          AND l.created_by = auth.uid()
    )
);

CREATE OR REPLACE FUNCTION public.join_league_by_code(_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    league_rec RECORD;
    season_rec RECORD;
    member_count INT;
    commissioner_timezone TEXT := 'America/New_York';
    local_today DATE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF _invite_code IS NULL OR btrim(_invite_code) = '' THEN
        RAISE EXCEPTION 'Enter an invite code';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.league_members lm
        WHERE lm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'You are already in a league. Leave your current league first.';
    END IF;

    SELECT l.*
    INTO league_rec
    FROM public.leagues l
    WHERE lower(l.invite_code) = lower(btrim(_invite_code))
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    SELECT COUNT(*)
    INTO member_count
    FROM public.league_members lm
    WHERE lm.league_id = league_rec.id;

    IF member_count >= league_rec.max_members THEN
        RAISE EXCEPTION 'This league is full';
    END IF;

    SELECT s.*
    INTO season_rec
    FROM public.seasons s
    WHERE s.league_id = league_rec.id
      AND s.status IN ('active', 'draft')
    ORDER BY s.season_number DESC
    LIMIT 1;

    -- Players may still join after the commissioner schedules a season but
    -- before Sunday kickoff; membership triggers regenerate future matchups.
    -- Once Week 1 has actually begun, roster membership is locked.
    IF FOUND AND season_rec.status = 'active' THEN
        SELECT COALESCE(p.timezone, 'America/New_York')
        INTO commissioner_timezone
        FROM public.profiles p
        WHERE p.id = league_rec.created_by;

        commissioner_timezone := COALESCE(commissioner_timezone, 'America/New_York');
        local_today := (now() AT TIME ZONE commissioner_timezone)::DATE;

        IF local_today >= season_rec.start_date THEN
            RAISE EXCEPTION 'This season has already started. League rosters are locked.';
        END IF;
    END IF;

    INSERT INTO public.league_members (league_id, user_id, role)
    VALUES (league_rec.id, v_user_id, 'member');

    RETURN league_rec.id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_league_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_league_by_code(TEXT) TO authenticated;

COMMENT ON FUNCTION public.join_league_by_code IS
'Transactionally joins the authenticated user to a league by invite code, enforcing single-league membership, capacity, and Sunday kickoff roster lock.';
