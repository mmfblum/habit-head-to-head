-- =============================================================================
-- SAFE SEASON KICKOFF
-- =============================================================================
-- Draft seasons may sit in preseason while friends join. Starting a season
-- schedules Week 1 for the upcoming Sunday (Sunday-to-Saturday fantasy weeks)
-- in the commissioner's profile timezone.
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
    league_timezone TEXT := 'America/New_York';
    local_today DATE;
    kickoff_date DATE;
BEGIN
    SELECT s.*, l.created_by
    INTO season_rec
    FROM public.seasons s
    JOIN public.leagues l ON l.id = s.league_id
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

    SELECT COALESCE(p.timezone, 'America/New_York')
    INTO league_timezone
    FROM public.profiles p
    WHERE p.id = season_rec.created_by;

    league_timezone := COALESCE(league_timezone, 'America/New_York');
    local_today := (now() AT TIME ZONE league_timezone)::DATE;

    -- PostgreSQL DOW: Sunday=0. If kickoff is pressed on Sunday, Week 1 starts
    -- immediately; otherwise it begins on the next Sunday.
    kickoff_date := local_today + ((7 - EXTRACT(DOW FROM local_today)::INT) % 7);

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

    UPDATE public.weeks w
    SET start_date = kickoff_date + ((w.week_number - 1) * 7),
        end_date = kickoff_date + ((w.week_number - 1) * 7) + 6,
        is_locked = FALSE
    WHERE w.season_id = _season_id;

    UPDATE public.seasons s
    SET start_date = kickoff_date,
        end_date = kickoff_date + (s.weeks_count * 7) - 1,
        status = 'active',
        updated_at = now()
    WHERE s.id = _season_id;

    -- on_season_activated() runs after the update and creates standings, task
    -- instances, and the round-robin schedule against these rebased weeks.
END;
$$;

REVOKE ALL ON FUNCTION public.start_league_season(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_league_season(UUID) TO authenticated;

COMMENT ON FUNCTION public.start_league_season IS
'Validates a draft Zrizin season and schedules Week 1 for the upcoming Sunday in the commissioner timezone before round-robin schedule generation.';
