-- =============================================================================
-- LEAGUE CREATOR RLS HELPER
-- =============================================================================
-- The owner membership is created immediately after the league row. Checking
-- leagues directly inside the membership policy can recurse into league SELECT
-- RLS before that membership exists, so resolve creator identity in a narrow
-- SECURITY DEFINER helper.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_league_creator(
    _user_id UUID,
    _league_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.leagues l
        WHERE l.id = _league_id
          AND l.created_by = _user_id
    )
$$;

REVOKE ALL ON FUNCTION public.is_league_creator(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_league_creator(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "League creators can add owner membership" ON public.league_members;

CREATE POLICY "League creators can add owner membership"
ON public.league_members
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND role = 'owner'
    AND public.is_league_creator(auth.uid(), league_id)
);
