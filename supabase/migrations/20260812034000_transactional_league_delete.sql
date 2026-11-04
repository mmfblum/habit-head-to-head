-- =============================================================================
-- TRANSACTIONAL LEAGUE DELETION
-- =============================================================================
-- The client previously deleted child tables one-by-one before deleting the
-- league. Any mid-sequence failure could leave a partially destroyed league.
-- Delete the root row in one owner-authorized database transaction and let the
-- schema's cascading relationships clean up dependent state atomically.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_league(_league_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.league_members lm
        WHERE lm.league_id = _league_id
          AND lm.user_id = v_user_id
          AND lm.role = 'owner'
    ) THEN
        RAISE EXCEPTION 'Only the league owner can delete the league';
    END IF;

    DELETE FROM public.leagues l
    WHERE l.id = _league_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'League not found';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_league(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_league(UUID) TO authenticated;

COMMENT ON FUNCTION public.delete_league IS
'Atomically deletes a league for its owner; dependent seasons, weeks, matchups, tasks, scores, memberships, feed events and notifications are removed through foreign-key cascades.';
