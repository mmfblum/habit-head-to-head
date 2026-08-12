-- =============================================================================
-- COMPETITIVE WRITE LOCKDOWN
-- =============================================================================
-- Once Zrizin is a head-to-head game, normal client table permissions must not
-- provide alternate paths around invite codes, Sunday kickoff, rule locking, or
-- Power Play consumption. Competitive state changes go through the validated
-- SECURITY DEFINER RPCs; league scoring rules are editable only in preseason.
-- =============================================================================

-- Membership is now created/removed only through create_league,
-- join_league_by_code, leave_league, or league deletion.
DROP POLICY IF EXISTS "Admins can manage members" ON public.league_members;
DROP POLICY IF EXISTS "League creators can add owner membership" ON public.league_members;

-- Seasons are visible to members, but clients may only INSERT a draft season.
-- Activation goes exclusively through start_league_season().
DROP POLICY IF EXISTS "Admins can manage seasons" ON public.seasons;
DROP POLICY IF EXISTS "Admins can create draft seasons" ON public.seasons;

CREATE POLICY "Admins can create draft seasons"
ON public.seasons
FOR INSERT
WITH CHECK (
    status = 'draft'
    AND public.is_league_admin(auth.uid(), league_id)
);

-- League task rules can be configured during preseason only. Scheduling the
-- season locks the rules that determine competitive scoring.
DROP POLICY IF EXISTS "Admins can manage task configs" ON public.league_task_configs;
DROP POLICY IF EXISTS "Admins can create draft task configs" ON public.league_task_configs;
DROP POLICY IF EXISTS "Admins can update draft task configs" ON public.league_task_configs;
DROP POLICY IF EXISTS "Admins can delete draft task configs" ON public.league_task_configs;

CREATE POLICY "Admins can create draft task configs"
ON public.league_task_configs
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.seasons s
        WHERE s.id = season_id
          AND s.status = 'draft'
          AND public.is_league_admin(auth.uid(), s.league_id)
    )
);

CREATE POLICY "Admins can update draft task configs"
ON public.league_task_configs
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM public.seasons s
        WHERE s.id = season_id
          AND s.status = 'draft'
          AND public.is_league_admin(auth.uid(), s.league_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.seasons s
        WHERE s.id = season_id
          AND s.status = 'draft'
          AND public.is_league_admin(auth.uid(), s.league_id)
    )
);

CREATE POLICY "Admins can delete draft task configs"
ON public.league_task_configs
FOR DELETE
USING (
    EXISTS (
        SELECT 1
        FROM public.seasons s
        WHERE s.id = season_id
          AND s.status = 'draft'
          AND public.is_league_admin(auth.uid(), s.league_id)
    )
);

-- User-created scoring tasks are also preseason-only until a dedicated weekly
-- challenge/approval workflow exists.
DROP POLICY IF EXISTS "Users can create own custom tasks" ON public.user_custom_tasks;
DROP POLICY IF EXISTS "Users can update own custom tasks" ON public.user_custom_tasks;
DROP POLICY IF EXISTS "Users can create preseason custom tasks" ON public.user_custom_tasks;
DROP POLICY IF EXISTS "Users can update preseason custom tasks" ON public.user_custom_tasks;

CREATE POLICY "Users can create preseason custom tasks"
ON public.user_custom_tasks
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.seasons s
        WHERE s.id = season_id
          AND s.status = 'draft'
          AND public.is_season_member(auth.uid(), s.id)
    )
);

CREATE POLICY "Users can update preseason custom tasks"
ON public.user_custom_tasks
FOR UPDATE
USING (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.seasons s
        WHERE s.id = season_id
          AND s.status = 'draft'
          AND public.is_season_member(auth.uid(), s.id)
    )
)
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.seasons s
        WHERE s.id = season_id
          AND s.status = 'draft'
          AND public.is_season_member(auth.uid(), s.id)
    )
);

-- Users may read their own Power Plays, but cannot directly mutate modifier,
-- armed, or consumed state. activate_powerup() and the scoring trigger own it.
DROP POLICY IF EXISTS "Users can use their own powerups" ON public.powerups;
