-- =============================================================================
-- LEADERBOARD LEAGUE FORMAT
-- =============================================================================
-- Zrizin supports two competition layers over the same scoring engine:
--   head_to_head = weekly opponents, W/L/T standings, matchup slate
--   leaderboard  = no matchups; weekly + season rankings are point-based
-- Existing leagues remain head_to_head.
-- =============================================================================

ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS game_format TEXT NOT NULL DEFAULT 'head_to_head';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leagues_game_format_check'
      AND conrelid = 'public.leagues'::regclass
  ) THEN
    ALTER TABLE public.leagues
      ADD CONSTRAINT leagues_game_format_check
      CHECK (game_format IN ('head_to_head', 'leaderboard'));
  END IF;
END $$;

UPDATE public.leagues
SET game_format = 'head_to_head'
WHERE game_format IS NULL;

-- Leaderboard seasons must never create phantom head-to-head matchups.
CREATE OR REPLACE FUNCTION public.refresh_season_matchups(_season_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_league_id UUID;
    v_game_format TEXT := 'head_to_head';
    member_ids UUID[];
    rotation UUID[];
    member_count INT := 0;
    slot_count INT := 0;
    pair_index INT;
    left_user UUID;
    right_user UUID;
    week_rec RECORD;
    can_rebuild BOOLEAN;
BEGIN
    SELECT s.league_id, COALESCE(l.game_format, 'head_to_head')
    INTO v_league_id, v_game_format
    FROM public.seasons s
    JOIN public.leagues l ON l.id = s.league_id
    WHERE s.id = _season_id;

    IF v_league_id IS NULL THEN
        RETURN;
    END IF;

    IF v_game_format = 'leaderboard' THEN
        DELETE FROM public.matchups m
        USING public.weeks w
        WHERE m.week_id = w.id
          AND w.season_id = _season_id;
        RETURN;
    END IF;

    SELECT array_agg(lm.user_id ORDER BY lm.joined_at, lm.user_id)
    INTO member_ids
    FROM public.league_members lm
    WHERE lm.league_id = v_league_id;

    member_count := COALESCE(array_length(member_ids, 1), 0);

    IF member_count > 0 THEN
        rotation := member_ids;
        IF member_count % 2 = 1 THEN
            rotation := array_append(rotation, NULL::UUID);
        END IF;
        slot_count := array_length(rotation, 1);
    END IF;

    FOR week_rec IN
        SELECT w.id, w.week_number, w.is_locked
        FROM public.weeks w
        WHERE w.season_id = _season_id
        ORDER BY w.week_number
    LOOP
        can_rebuild := NOT week_rec.is_locked
            AND NOT EXISTS (
                SELECT 1
                FROM public.scoring_events se
                WHERE se.week_id = week_rec.id
                  AND se.is_reversed = FALSE
            )
            AND NOT EXISTS (
                SELECT 1
                FROM public.matchups m
                WHERE m.week_id = week_rec.id
                  AND m.status = 'completed'
            );

        IF can_rebuild THEN
            DELETE FROM public.matchups m WHERE m.week_id = week_rec.id;

            IF member_count >= 2 THEN
                FOR pair_index IN 1..(slot_count / 2) LOOP
                    left_user := rotation[pair_index];
                    right_user := rotation[slot_count - pair_index + 1];

                    IF left_user IS NOT NULL AND right_user IS NOT NULL THEN
                        INSERT INTO public.matchups (
                            week_id, user1_id, user2_id,
                            user1_score, user2_score, status
                        ) VALUES (
                            week_rec.id,
                            left_user,
                            right_user,
                            COALESCE((SELECT ws.total_points FROM public.weekly_scores ws WHERE ws.week_id = week_rec.id AND ws.user_id = left_user), 0),
                            COALESCE((SELECT ws.total_points FROM public.weekly_scores ws WHERE ws.week_id = week_rec.id AND ws.user_id = right_user), 0),
                            'scheduled'
                        );
                    END IF;
                END LOOP;
            END IF;
        END IF;

        IF slot_count > 2 THEN
            rotation := ARRAY[rotation[1], rotation[slot_count]] || rotation[2:slot_count - 1];
        END IF;
    END LOOP;
END;
$$;

-- Keep the common season totals but make the competitive record format-aware.
CREATE OR REPLACE FUNCTION public.update_season_standing(
    _user_id UUID,
    _season_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_pts NUMERIC := 0;
    wins_count INT := 0;
    losses_count INT := 0;
    ties_count INT := 0;
    pts_for NUMERIC := 0;
    pts_against NUMERIC := 0;
    high_weekly NUMERIC := 0;
    low_weekly NUMERIC := 0;
    v_game_format TEXT := 'head_to_head';
BEGIN
    SELECT COALESCE(l.game_format, 'head_to_head')
    INTO v_game_format
    FROM public.seasons s
    JOIN public.leagues l ON l.id = s.league_id
    WHERE s.id = _season_id;

    SELECT COALESCE(SUM(ws.total_points), 0),
           COALESCE(MAX(ws.total_points), 0),
           COALESCE(MIN(ws.total_points), 0)
    INTO total_pts, high_weekly, low_weekly
    FROM public.weekly_scores ws
    JOIN public.weeks w ON w.id = ws.week_id
    WHERE ws.user_id = _user_id
      AND w.season_id = _season_id;

    IF v_game_format = 'head_to_head' THEN
        SELECT
            COUNT(*) FILTER (WHERE winner_id = _user_id),
            COUNT(*) FILTER (
                WHERE winner_id IS NOT NULL
                  AND winner_id != _user_id
                  AND (user1_id = _user_id OR user2_id = _user_id)
            ),
            COUNT(*) FILTER (WHERE winner_id IS NULL AND status = 'completed')
        INTO wins_count, losses_count, ties_count
        FROM public.matchups m
        JOIN public.weeks w ON w.id = m.week_id
        WHERE w.season_id = _season_id
          AND (m.user1_id = _user_id OR m.user2_id = _user_id);

        SELECT
            COALESCE(SUM(CASE WHEN user1_id = _user_id THEN user1_score ELSE user2_score END), 0),
            COALESCE(SUM(CASE WHEN user1_id = _user_id THEN user2_score ELSE user1_score END), 0)
        INTO pts_for, pts_against
        FROM public.matchups m
        JOIN public.weeks w ON w.id = m.week_id
        WHERE w.season_id = _season_id
          AND (m.user1_id = _user_id OR m.user2_id = _user_id);
    ELSE
        pts_for := total_pts;
        pts_against := 0;
    END IF;

    INSERT INTO public.season_standings (
        user_id, season_id, total_points, wins, losses, ties,
        points_for, points_against, highest_weekly_score, lowest_weekly_score
    )
    VALUES (
        _user_id, _season_id, total_pts, wins_count, losses_count, ties_count,
        pts_for, pts_against, high_weekly, low_weekly
    )
    ON CONFLICT (user_id, season_id)
    DO UPDATE SET
        total_points = EXCLUDED.total_points,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        ties = EXCLUDED.ties,
        points_for = EXCLUDED.points_for,
        points_against = EXCLUDED.points_against,
        highest_weekly_score = EXCLUDED.highest_weekly_score,
        lowest_weekly_score = EXCLUDED.lowest_weekly_score,
        updated_at = now();

    IF v_game_format = 'leaderboard' THEN
        WITH ranked AS (
            SELECT ss.user_id,
                   RANK() OVER (ORDER BY ss.total_points DESC) AS new_rank
            FROM public.season_standings ss
            WHERE ss.season_id = _season_id
        )
        UPDATE public.season_standings ss
        SET current_rank = ranked.new_rank,
            updated_at = now()
        FROM ranked
        WHERE ss.season_id = _season_id
          AND ss.user_id = ranked.user_id;
    END IF;
END;
$$;

-- Starting a season uses the same Sunday week cadence for both formats.
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
    SELECT s.*, l.created_by, COALESCE(l.game_format, 'head_to_head') AS game_format
    INTO season_rec
    FROM public.seasons s
    JOIN public.leagues l ON l.id = s.league_id
    WHERE s.id = _season_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
    IF NOT public.is_league_admin(auth.uid(), season_rec.league_id) THEN
        RAISE EXCEPTION 'Only a league owner or admin can start the season';
    END IF;
    IF season_rec.status = 'active' THEN RETURN; END IF;
    IF season_rec.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft season can be started'; END IF;

    SELECT COALESCE(p.timezone, 'America/New_York')
    INTO league_timezone
    FROM public.profiles p
    WHERE p.id = season_rec.created_by;

    league_timezone := COALESCE(league_timezone, 'America/New_York');
    local_today := (now() AT TIME ZONE league_timezone)::DATE;
    kickoff_date := local_today + ((7 - EXTRACT(DOW FROM local_today)::INT) % 7);

    SELECT COUNT(*) INTO member_count
    FROM public.league_members lm
    WHERE lm.league_id = season_rec.league_id;

    IF member_count < 2 THEN
        IF season_rec.game_format = 'leaderboard' THEN
            RAISE EXCEPTION 'Invite at least one other player before starting the leaderboard';
        ELSE
            RAISE EXCEPTION 'Invite at least one opponent before starting the season';
        END IF;
    END IF;

    SELECT COUNT(*) INTO task_count
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
END;
$$;

REVOKE ALL ON FUNCTION public.start_league_season(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_league_season(UUID) TO authenticated;

-- Advance week state and rank according to the league's chosen format.
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
    v_game_format TEXT := 'head_to_head';
BEGIN
    IF auth.uid() IS NOT NULL
       AND NOT public.is_league_member(auth.uid(), _league_id) THEN
        RAISE EXCEPTION 'Not authorized to refresh this league';
    END IF;

    SELECT COALESCE(l.game_format, 'head_to_head'),
           COALESCE(p.timezone, 'America/New_York')
    INTO v_game_format, league_timezone
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

        IF v_game_format = 'head_to_head' THEN
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
            SET status = 'in_progress', winner_id = NULL, updated_at = now()
            FROM public.weeks w
            WHERE m.week_id = w.id
              AND w.season_id = season_rec.id
              AND local_today BETWEEN w.start_date AND w.end_date
              AND m.status <> 'completed';

            UPDATE public.matchups m
            SET status = 'scheduled', winner_id = NULL, updated_at = now()
            FROM public.weeks w
            WHERE m.week_id = w.id
              AND w.season_id = season_rec.id
              AND w.start_date > local_today
              AND m.status <> 'completed';
        END IF;

        FOR member_rec IN
            SELECT lm.user_id
            FROM public.league_members lm
            WHERE lm.league_id = _league_id
        LOOP
            PERFORM public.update_season_standing(member_rec.user_id, season_rec.id);

            IF v_game_format = 'leaderboard' THEN
                UPDATE public.season_standings ss
                SET current_streak = 0,
                    streak_type = NULL,
                    updated_at = now()
                WHERE ss.season_id = season_rec.id
                  AND ss.user_id = member_rec.user_id;
                CONTINUE;
            END IF;

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

        IF v_game_format = 'leaderboard' THEN
            WITH ranked AS (
                SELECT ss.user_id,
                       RANK() OVER (ORDER BY ss.total_points DESC) AS new_rank
                FROM public.season_standings ss
                WHERE ss.season_id = season_rec.id
            )
            UPDATE public.season_standings ss
            SET current_rank = ranked.new_rank,
                updated_at = now()
            FROM ranked
            WHERE ss.season_id = season_rec.id
              AND ss.user_id = ranked.user_id;
        ELSE
            WITH ranked AS (
                SELECT ss.user_id,
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
        END IF;
    END LOOP;
END;
$$;

COMMENT ON COLUMN public.leagues.game_format IS
'Competition layer: head_to_head uses weekly matchups; leaderboard ranks players directly by points.';
