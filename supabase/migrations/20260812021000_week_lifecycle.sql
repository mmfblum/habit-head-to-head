-- =============================================================================
-- FANTASY WEEK LIFECYCLE
-- =============================================================================
-- Zrizin is a weekly head-to-head game. This function advances the competitive
-- state whenever a league member opens/refetches the app. Calendar boundaries
-- are evaluated in the league creator's profile timezone so Saturday does not
-- end early just because the database server runs on UTC.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refresh_competition_state(_league_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    season_rec RECORD;
    member_rec RECORD;
    matchup_rec RECORD;
    result_code TEXT;
    streak_code TEXT;
    streak_count INT;
    league_timezone TEXT := 'America/New_York';
    local_today DATE;
BEGIN
    IF auth.uid() IS NOT NULL
       AND NOT public.is_league_member(auth.uid(), _league_id) THEN
        RAISE EXCEPTION 'Not authorized to refresh this league';
    END IF;

    SELECT COALESCE(p.timezone, 'America/New_York')
    INTO league_timezone
    FROM public.leagues l
    LEFT JOIN public.profiles p ON p.id = l.created_by
    WHERE l.id = _league_id;

    league_timezone := COALESCE(league_timezone, 'America/New_York');
    local_today := (now() AT TIME ZONE league_timezone)::DATE;

    FOR season_rec IN
        SELECT s.id
        FROM public.seasons s
        WHERE s.league_id = _league_id
          AND s.status = 'active'
    LOOP
        UPDATE public.weeks w
        SET is_locked = TRUE
        WHERE w.season_id = season_rec.id
          AND w.end_date < local_today
          AND w.is_locked = FALSE;

        UPDATE public.matchups m
        SET status = 'completed',
            winner_id = CASE
                WHEN m.user1_score > m.user2_score THEN m.user1_id
                WHEN m.user2_score > m.user1_score THEN m.user2_id
                ELSE NULL
            END,
            updated_at = now()
        FROM public.weeks w
        WHERE m.week_id = w.id
          AND w.season_id = season_rec.id
          AND w.end_date < local_today
          AND m.status <> 'completed';

        UPDATE public.matchups m
        SET status = 'in_progress',
            winner_id = NULL,
            updated_at = now()
        FROM public.weeks w
        WHERE m.week_id = w.id
          AND w.season_id = season_rec.id
          AND local_today BETWEEN w.start_date AND w.end_date
          AND m.status <> 'completed';

        UPDATE public.matchups m
        SET status = 'scheduled',
            winner_id = NULL,
            updated_at = now()
        FROM public.weeks w
        WHERE m.week_id = w.id
          AND w.season_id = season_rec.id
          AND w.start_date > local_today
          AND m.status <> 'completed';

        FOR member_rec IN
            SELECT lm.user_id
            FROM public.league_members lm
            WHERE lm.league_id = _league_id
        LOOP
            PERFORM public.update_season_standing(member_rec.user_id, season_rec.id);

            streak_code := NULL;
            streak_count := 0;

            FOR matchup_rec IN
                SELECT m.*
                FROM public.matchups m
                JOIN public.weeks w ON w.id = m.week_id
                WHERE w.season_id = season_rec.id
                  AND m.status = 'completed'
                  AND (m.user1_id = member_rec.user_id OR m.user2_id = member_rec.user_id)
                ORDER BY w.week_number DESC
            LOOP
                IF matchup_rec.winner_id IS NULL THEN
                    EXIT;
                ELSIF matchup_rec.winner_id = member_rec.user_id THEN
                    result_code := 'W';
                ELSE
                    result_code := 'L';
                END IF;

                IF streak_code IS NULL THEN
                    streak_code := result_code;
                    streak_count := 1;
                ELSIF streak_code = result_code THEN
                    streak_count := streak_count + 1;
                ELSE
                    EXIT;
                END IF;
            END LOOP;

            UPDATE public.season_standings ss
            SET current_streak = streak_count,
                streak_type = streak_code,
                updated_at = now()
            WHERE ss.season_id = season_rec.id
              AND ss.user_id = member_rec.user_id;
        END LOOP;

        -- Record is the primary ranking signal. Exact ties share a rank instead
        -- of being broken by an arbitrary UUID.
        WITH ranked AS (
            SELECT
                ss.user_id,
                RANK() OVER (
                    ORDER BY ss.wins DESC,
                             ss.ties DESC,
                             ss.total_points DESC,
                             ss.points_against ASC
                ) AS new_rank
            FROM public.season_standings ss
            WHERE ss.season_id = season_rec.id
        )
        UPDATE public.season_standings ss
        SET current_rank = ranked.new_rank,
            updated_at = now()
        FROM ranked
        WHERE ss.season_id = season_rec.id
          AND ss.user_id = ranked.user_id;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.refresh_competition_state IS
'Idempotently advances Zrizin weekly competition state in the league timezone: closes finished matchups, declares winners, marks the current slate live, and recomputes fantasy-style standings/ranks/streaks.';
