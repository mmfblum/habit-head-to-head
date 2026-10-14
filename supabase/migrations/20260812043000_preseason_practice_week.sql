-- =============================================================================
-- PRESEASON PRACTICE WEEK
-- =============================================================================
-- Week 0 is a temporary, non-competitive practice window that opens immediately
-- after the commissioner schedules the season when official Week 1 is still in
-- the future. Practice scores use the normal scoring pipeline so players can test
-- the league, but they never count toward season standings, W-L-T records, or
-- Power Play usage. Official Week 1 remains Sunday-to-Saturday.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.grant_season_powerplays(_season_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_league_id UUID;
BEGIN
    SELECT s.league_id INTO v_league_id
    FROM public.seasons s
    WHERE s.id = _season_id;

    IF v_league_id IS NULL THEN RETURN; END IF;

    INSERT INTO public.powerups (
        user_id, week_id, powerup_type, modifier_value, is_activated, is_used
    )
    SELECT lm.user_id, w.id, 'multiplier', 2, FALSE, FALSE
    FROM public.weeks w
    CROSS JOIN public.league_members lm
    WHERE w.season_id = _season_id
      AND w.week_number > 0
      AND lm.league_id = v_league_id
    ON CONFLICT (user_id, week_id, powerup_type) DO NOTHING;
END;
$$;

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

    IF v_league_id IS NULL THEN RETURN; END IF;

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
          AND w.week_number > 0
        ORDER BY w.week_number
    LOOP
        can_rebuild := NOT week_rec.is_locked
            AND NOT EXISTS (
                SELECT 1 FROM public.scoring_events se
                WHERE se.week_id = week_rec.id AND se.is_reversed = FALSE
            )
            AND NOT EXISTS (
                SELECT 1 FROM public.matchups m
                WHERE m.week_id = week_rec.id AND m.status = 'completed'
            );

        IF can_rebuild THEN
            DELETE FROM public.matchups m WHERE m.week_id = week_rec.id;
            IF member_count >= 2 THEN
                FOR pair_index IN 1..(slot_count / 2) LOOP
                    left_user := rotation[pair_index];
                    right_user := rotation[slot_count - pair_index + 1];
                    IF left_user IS NOT NULL AND right_user IS NOT NULL THEN
                        INSERT INTO public.matchups (
                            week_id, user1_id, user2_id, user1_score, user2_score, status
                        ) VALUES (
                            week_rec.id, left_user, right_user,
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
      AND w.season_id = _season_id
      AND w.week_number > 0;

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
          AND w.week_number > 0
          AND (m.user1_id = _user_id OR m.user2_id = _user_id);

        SELECT
            COALESCE(SUM(CASE WHEN user1_id = _user_id THEN user1_score ELSE user2_score END), 0),
            COALESCE(SUM(CASE WHEN user1_id = _user_id THEN user2_score ELSE user1_score END), 0)
        INTO pts_for, pts_against
        FROM public.matchups m
        JOIN public.weeks w ON w.id = m.week_id
        WHERE w.season_id = _season_id
          AND w.week_number > 0
          AND (m.user1_id = _user_id OR m.user2_id = _user_id);
    ELSE
        pts_for := total_pts;
        pts_against := 0;
    END IF;

    INSERT INTO public.season_standings (
        user_id, season_id, total_points, wins, losses, ties,
        points_for, points_against, highest_weekly_score, lowest_weekly_score
    ) VALUES (
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
            SELECT ss.user_id, RANK() OVER (ORDER BY ss.total_points DESC) AS new_rank
            FROM public.season_standings ss
            WHERE ss.season_id = _season_id
        )
        UPDATE public.season_standings ss
        SET current_rank = ranked.new_rank, updated_at = now()
        FROM ranked
        WHERE ss.season_id = _season_id
          AND ss.user_id = ranked.user_id;
    END IF;
END;
$$;

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

    SELECT COALESCE(p.timezone, 'America/New_York') INTO league_timezone
    FROM public.profiles p WHERE p.id = season_rec.created_by;

    league_timezone := COALESCE(league_timezone, 'America/New_York');
    local_today := (now() AT TIME ZONE league_timezone)::DATE;
    kickoff_date := local_today + ((7 - EXTRACT(DOW FROM local_today)::INT) % 7);

    SELECT COUNT(*) INTO member_count
    FROM public.league_members lm WHERE lm.league_id = season_rec.league_id;

    IF member_count < 2 THEN
        IF season_rec.game_format = 'leaderboard' THEN
            RAISE EXCEPTION 'Invite at least one other player before starting the leaderboard';
        ELSE
            RAISE EXCEPTION 'Invite at least one opponent before starting the season';
        END IF;
    END IF;

    SELECT COUNT(*) INTO task_count
    FROM public.league_task_configs ltc
    WHERE ltc.season_id = _season_id AND ltc.is_enabled = TRUE;

    IF task_count < 3 THEN
        RAISE EXCEPTION 'Configure at least three scoring tasks before starting the season';
    END IF;

    DELETE FROM public.weeks w
    WHERE w.season_id = _season_id AND w.week_number = 0;

    UPDATE public.weeks w
    SET start_date = kickoff_date + ((w.week_number - 1) * 7),
        end_date = kickoff_date + ((w.week_number - 1) * 7) + 6,
        is_locked = FALSE
    WHERE w.season_id = _season_id
      AND w.week_number > 0;

    IF kickoff_date > local_today THEN
        INSERT INTO public.weeks (season_id, week_number, start_date, end_date, is_locked)
        VALUES (_season_id, 0, local_today, kickoff_date - 1, FALSE);
    END IF;

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

CREATE OR REPLACE FUNCTION public.process_checkin_scoring()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    task_inst RECORD;
    season_rec RECORD;
    week_rec RECORD;
    league_rec RECORD;
    score_result RECORD;
    powerup_result RECORD;
    final_points NUMERIC := 0;
    powerup_json JSONB := NULL;
    is_binary_missed BOOLEAN := FALSE;
    raw_val NUMERIC := 0;
    checkin_verified BOOLEAN;
    league_timezone TEXT := 'America/New_York';
    local_today DATE;
    derived_json JSONB := '{}'::JSONB;
BEGIN
    SELECT * INTO task_inst FROM public.task_instances WHERE id = NEW.task_instance_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task instance not found'; END IF;

    SELECT * INTO season_rec FROM public.seasons WHERE id = task_inst.season_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
    IF season_rec.status <> 'active' THEN RAISE EXCEPTION 'Scoring is not open for this season'; END IF;

    SELECT l.*, COALESCE(p.timezone, 'America/New_York') AS league_timezone
    INTO league_rec
    FROM public.leagues l
    LEFT JOIN public.profiles p ON p.id = l.created_by
    WHERE l.id = season_rec.league_id;

    league_timezone := COALESCE(league_rec.league_timezone, 'America/New_York');
    local_today := (now() AT TIME ZONE league_timezone)::DATE;

    SELECT * INTO week_rec
    FROM public.weeks
    WHERE season_id = task_inst.season_id
      AND NEW.checkin_date BETWEEN start_date AND end_date
    LIMIT 1;

    IF NOT FOUND THEN RAISE EXCEPTION 'This date is outside the active season'; END IF;

    IF week_rec.is_locked
       OR local_today < week_rec.start_date
       OR local_today > week_rec.end_date THEN
        RAISE EXCEPTION 'Check-ins can only be scored during the live scoring window';
    END IF;

    IF auth.uid() IS NOT NULL AND NEW.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'You can only score your own check-ins';
    END IF;

    CASE task_inst.input_type::TEXT
        WHEN 'binary' THEN raw_val := CASE WHEN NEW.boolean_value THEN 1 ELSE 0 END;
        WHEN 'numeric' THEN raw_val := COALESCE(NEW.numeric_value, 0);
        WHEN 'time' THEN raw_val := EXTRACT(HOUR FROM NEW.time_value::TIME) * 60 + EXTRACT(MINUTE FROM NEW.time_value::TIME);
        WHEN 'duration' THEN raw_val := COALESCE(NEW.duration_minutes, 0);
        ELSE raw_val := 0;
    END CASE;

    UPDATE public.scoring_events
    SET is_reversed = TRUE
    WHERE daily_checkin_id = NEW.id AND is_reversed = FALSE;

    checkin_verified := public.is_checkin_verified(NEW, task_inst);

    IF NOT checkin_verified THEN
        derived_json := jsonb_build_object('verification_failed', true, 'metadata', NEW.metadata);
        IF week_rec.week_number = 0 THEN
            derived_json := derived_json || jsonb_build_object('preseason', true);
        END IF;

        INSERT INTO public.scoring_events (
            daily_checkin_id, user_id, week_id, season_id, league_id,
            task_instance_id, scoring_type, raw_value,
            points_before_cap, points_awarded, rule_applied,
            config_snapshot, derived_values, is_reversed
        ) VALUES (
            NEW.id, NEW.user_id, week_rec.id, task_inst.season_id, season_rec.league_id,
            task_inst.id, task_inst.scoring_type, raw_val,
            0, 0, CASE WHEN week_rec.week_number = 0 THEN 'preseason:unverified_checkin' ELSE 'unverified_checkin' END,
            task_inst.config, derived_json, FALSE
        );
    ELSE
        SELECT * INTO score_result FROM public.calculate_checkin_score(NEW, task_inst);

        IF task_inst.scoring_type::TEXT = 'binary_yesno'
           AND (NEW.boolean_value IS NULL OR NEW.boolean_value = FALSE) THEN
            is_binary_missed := TRUE;
        END IF;

        IF week_rec.week_number = 0 THEN
            final_points := score_result.points_awarded;
            powerup_json := NULL;
            derived_json := COALESCE(score_result.derived_values, '{}'::JSONB) || jsonb_build_object('preseason', true);
        ELSE
            SELECT * INTO powerup_result
            FROM public.apply_armed_powerups(
                NEW.user_id, week_rec.id, task_inst.id, NEW.id,
                score_result.points_awarded, is_binary_missed
            );
            final_points := powerup_result.final_points;
            powerup_json := powerup_result.powerup_applied;
            derived_json := COALESCE(score_result.derived_values, '{}'::JSONB);
        END IF;

        INSERT INTO public.scoring_events (
            daily_checkin_id, user_id, week_id, season_id, league_id,
            task_instance_id, scoring_type, raw_value,
            points_before_cap, points_awarded, rule_applied,
            config_snapshot, derived_values, powerup_applied, is_reversed
        ) VALUES (
            NEW.id, NEW.user_id, week_rec.id, task_inst.season_id, season_rec.league_id,
            task_inst.id, task_inst.scoring_type, raw_val,
            score_result.points_before_cap, final_points,
            CASE WHEN week_rec.week_number = 0 THEN 'preseason:' || score_result.rule_applied ELSE score_result.rule_applied END,
            task_inst.config, derived_json, powerup_json, FALSE
        );
    END IF;

    PERFORM public.update_weekly_score(NEW.user_id, week_rec.id);

    IF week_rec.week_number > 0 THEN
        PERFORM public.sync_matchup_score(NEW.user_id, week_rec.id);
        PERFORM public.update_season_standing(NEW.user_id, task_inst.season_id);
    END IF;

    RETURN NEW;
END;
$$;

-- Backfill a practice window for active seasons whose official kickoff is still
-- in the future. This makes the migration useful for seasons already scheduled.
DO $$
DECLARE
    r RECORD;
    local_today DATE;
BEGIN
    FOR r IN
        SELECT s.id AS season_id, s.start_date,
               COALESCE(p.timezone, 'America/New_York') AS league_timezone
        FROM public.seasons s
        JOIN public.leagues l ON l.id = s.league_id
        LEFT JOIN public.profiles p ON p.id = l.created_by
        WHERE s.status = 'active'
    LOOP
        local_today := (now() AT TIME ZONE COALESCE(r.league_timezone, 'America/New_York'))::DATE;
        IF r.start_date > local_today THEN
            INSERT INTO public.weeks (season_id, week_number, start_date, end_date, is_locked)
            VALUES (r.season_id, 0, local_today, r.start_date - 1, FALSE)
            ON CONFLICT (season_id, week_number)
            DO UPDATE SET start_date = EXCLUDED.start_date,
                          end_date = EXCLUDED.end_date,
                          is_locked = FALSE;
        END IF;
    END LOOP;
END $$;

COMMENT ON FUNCTION public.start_league_season(UUID) IS
'Schedules official Week 1 for Sunday and opens an immediate non-competitive Week 0 preseason practice window when kickoff is in the future.';
