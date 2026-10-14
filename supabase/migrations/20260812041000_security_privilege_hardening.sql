-- =============================================================================
-- SECURITY PRIVILEGE HARDENING
-- =============================================================================
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. In an exposed
-- Supabase schema that can make SECURITY DEFINER helpers callable through the
-- Data API unless privileges are narrowed explicitly.
-- =============================================================================

-- Anonymous visitors do not need competitive/user data. Keep only the harmless
-- active task-template catalog available before sign-in; its existing RLS policy
-- still limits rows to active templates.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON public.task_templates TO anon;

-- Start from a deny-by-default posture for every SECURITY DEFINER function.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn.signature);
  END LOOP;
END $$;

-- Client-facing authenticated RPCs. Each validates authentication and/or
-- ownership/membership before mutating competitive state.
GRANT EXECUTE ON FUNCTION public.create_league(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_league(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_league(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_league_season(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_powerup(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_matchup_taunt(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_competition_state(UUID) TO authenticated;

-- Narrow read-only helpers are referenced by RLS policies, so signed-in users
-- must be able to execute them while the mutating/internal trigger helpers stay
-- inaccessible as direct RPC endpoints.
GRANT EXECUTE ON FUNCTION public.is_league_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_league_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_league_creator(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_season_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_checkin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_matchup(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_weekly_score(UUID, UUID) TO authenticated;

-- Preserve normal signed-in Data API access. RLS remains the row-level security
-- boundary for direct table reads/writes.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
