-- =============================================================================
-- SAFE SEASON KICKOFF
-- =============================================================================
-- Draft seasons may sit in preseason while friends join. Starting a season must
-- therefore rebase Week 1 to the actual kickoff date instead of the date the
-- league was originally created.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.start_league_season(_season_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    season_rec RECORD;
    member_count INT;
    task_count INT;
BEGIN
    SELECT s.*
    INTO season_rec
    FROM public.seasons s
    WHERE s.id = _season_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Season not found';
    END IF;

    IF NOT public.is_league_admin(auth.uid(), season_rec.league_id) THEN
        RAISE EXCEPTION 'Only a league owner or admin can start the season';
    END IF;

    IF season_rec.status = 'active' THEN
        RETURN;
    END IF;

    IF season_rec.status <> 'draft' THEN
        RAISE EXCEPTION 'Only a draft season can be started';
    END IF;

    SELECT COUNT(*)
    INTO member_count
    FROM public.league_members lm
    WHERE lm.league_id = season_rec.league_id;

    IF member_count < 2 THEN
        RAISE EXCEPTION 'Invite at least one opponent before starting the season';
    END IF;

    SELECT COUNT(*)
    INTO task_count
    FROM public.league_task_configs ltc
    WHERE ltc.season_id = _season_id
      AND ltc.is_enabled = TRUE;

    IF task_count < 3 THEN
        RAISE EXCEPTION 'Configure at least three scoring tasks before starting the season';
    END IF;

    -- Rebase every generated week to kickoff day while preserving week numbers.
    UPDATE public.weeks w
    SET start_date = CURRENT_DATE + ((w.week_number - 1) * 7),
        end_date = CURRENT_DATE + ((w.week_number - 1) * 7) + 6,
        is_locked = FALSE
    WHERE w.season_id = _season_id;

    UPDATE public.seasons s
    SET start_date = CURRENT_DATE,
        end_date = CURRENT_DATE + (s.weeks_count * 7) - 1,
        status = 'active',
        updated_at = now()
    WHERE s.id = _season_id;

    -- on_season_activated() now runs after the update and creates standings,
    -- task instances, and the round-robin schedule against the rebased weeks.
END;
$$;

REVOKE ALL ON FUNCTION public.start_league_season(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_league_season(UUID) TO authenticated;

COMMENT ON FUNCTION public.start_league_season IS
'Validates and starts a draft Zrizin season, rebasing Week 1 to the actual kickoff date before schedule generation.';
