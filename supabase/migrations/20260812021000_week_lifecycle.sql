-- =============================================================================
-- FANTASY WEEK LIFECYCLE
-- =============================================================================
-- Zrizin is a weekly head-to-head game. This function advances the competitive
-- state whenever a league member opens/refetches the app:
--   * past weeks are locked
--   * past matchups are finalized and winners are declared
--   * the current week's matchups are marked in progress
--   * standings, ranks, and win/loss streaks are recomputed
--
-- This is intentionally idempotent so it is safe to call on normal app loads.
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
BEGIN
    -- Client callers may only refresh leagues they belong to. Database-side
    -- callers (where auth.uid() is null) remain available for future cron use.
    IF auth.uid() IS NOT NULL
       AND NOT public.is_league_member(auth.uid(), _league_id) THEN
        RAISE EXCEPTION 'Not authorized to refresh this league';
    END IF;

    FOR season_rec IN
        SELECT s.id
        FROM public.seasons s
        WHERE s.league_id = _league_id
          AND s.status = 'active'
    LOOP
        -- Close weeks whose final calendar day has passed.
        UPDATE public.weeks w
        SET is_locked = TRUE
        WHERE w.season_id = season_rec.id
          AND w.end_date < CURRENT_DATE
          AND w.is_locked = FALSE;

        -- Finalize every matchup in a finished week. A tie intentionally has a
        -- NULL winner_id and counts as a tie in update_season_standing().
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
          AND w.end_date < CURRENT_DATE
          AND m.status <> 'completed';

        -- The current slate is live. Future weeks remain scheduled.
        UPDATE public.matchups m
        SET status = 'in_progress',
            winner_id = NULL,
            updated_at = now()
        FROM public.weeks w
        WHERE m.week_id = w.id
          AND w.season_id = season_rec.id
          AND CURRENT_DATE BETWEEN w.start_date AND w.end_date
          AND m.status <> 'completed';

        UPDATE public.matchups m
        SET status = 'scheduled',
            winner_id = NULL,
            updated_at = now()
        FROM public.weeks w
        WHERE m.week_id = w.id
          AND w.season_id = season_rec.id
          AND w.start_date > CURRENT_DATE
          AND m.status <> 'completed';

        -- Recompute every member rather than only the person whose most recent
        -- check-in changed. This keeps wins/losses and points-against coherent
        -- immediately after a week closes.
        FOR member_rec IN
            SELECT lm.user_id
            FROM public.league_members lm
            WHERE lm.league_id = _league_id
        LOOP
            PERFORM public.update_season_standing(member_rec.user_id, season_rec.id);

            -- Determine the current W/L streak from the newest completed game
            -- backwards. A tie breaks a streak rather than inventing a T streak.
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

        -- Fantasy-style standings: record first, season points as the tiebreaker.
        WITH ranked AS (
            SELECT
                ss.user_id,
                RANK() OVER (
                    ORDER BY ss.wins DESC,
                             ss.ties DESC,
                             ss.total_points DESC,
                             ss.points_against ASC,
                             ss.user_id
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
'Idempotently advances Zrizin weekly competition state: closes finished matchups, declares winners, marks the current slate live, and recomputes fantasy-style standings/ranks/streaks.';
