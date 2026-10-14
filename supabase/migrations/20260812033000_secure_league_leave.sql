-- =============================================================================
-- SECURE LEAGUE LEAVING
-- =============================================================================
-- A fantasy roster should not change once Week 1 is live. Route self-departure
-- through a validated RPC so clients cannot silently remove themselves during
-- the season and leave stale standings/schedules behind.
-- =============================================================================

DROP POLICY IF EXISTS "Users can leave leagues" ON public.league_members;

CREATE OR REPLACE FUNCTION public.leave_league(_league_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    membership_rec RECORD;
    season_rec RECORD;
    league_rec RECORD;
    commissioner_timezone TEXT := 'America/New_York';
    local_today DATE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT lm.*
    INTO membership_rec
    FROM public.league_members lm
    WHERE lm.league_id = _league_id
      AND lm.user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'You are not a member of this league';
    END IF;

    IF membership_rec.role = 'owner' THEN
        RAISE EXCEPTION 'League owners cannot leave. Delete the league instead.';
    END IF;

    SELECT l.*, COALESCE(p.timezone, 'America/New_York') AS league_timezone
    INTO league_rec
    FROM public.leagues l
    LEFT JOIN public.profiles p ON p.id = l.created_by
    WHERE l.id = _league_id;

    commissioner_timezone := COALESCE(league_rec.league_timezone, 'America/New_York');
    local_today := (now() AT TIME ZONE commissioner_timezone)::DATE;

    SELECT s.*
    INTO season_rec
    FROM public.seasons s
    WHERE s.league_id = _league_id
      AND s.status IN ('active', 'draft')
    ORDER BY s.season_number DESC
    LIMIT 1;

    IF FOUND AND season_rec.status = 'active' AND local_today >= season_rec.start_date THEN
        RAISE EXCEPTION 'The season has started. League rosters are locked.';
    END IF;

    -- If the season was already scheduled but has not kicked off, activation
    -- hooks created preseason state for this player. Remove it before membership
    -- deletion; the membership DELETE trigger will refresh future matchups.
    IF FOUND AND season_rec.status = 'active' THEN
        DELETE FROM public.powerups p
        USING public.weeks w
        WHERE p.week_id = w.id
          AND w.season_id = season_rec.id
          AND p.user_id = v_user_id;

        DELETE FROM public.season_standings ss
        WHERE ss.season_id = season_rec.id
          AND ss.user_id = v_user_id;
    END IF;

    DELETE FROM public.league_members lm
    WHERE lm.league_id = _league_id
      AND lm.user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_league(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_league(UUID) TO authenticated;

COMMENT ON FUNCTION public.leave_league IS
'Allows non-owner self-departure only before Week 1 kickoff and cleans scheduled-season preseason state before refreshing future matchups.';
