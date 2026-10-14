-- =============================================================================
-- LEAGUE FEED WRITE SECURITY
-- =============================================================================
-- The original league_events insert policy allowed any authenticated account to
-- insert into any league. Direct client writes must be limited to the user's own
-- league and identity. SECURITY DEFINER game functions (such as taunts) retain
-- the ability to create validated system/game events.
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.league_events;
DROP POLICY IF EXISTS "League members can insert own events" ON public.league_events;

CREATE POLICY "League members can insert own events"
ON public.league_events
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
    AND actor_user_id = auth.uid()
    AND public.is_league_member(auth.uid(), league_id)
);
