-- =============================================================================
-- COMPETITIVE LOOP FOUNDATION
-- =============================================================================
-- 1. Generate real round-robin head-to-head matchups for every season week.
-- 2. Refresh future/unplayed matchups when league membership changes.
-- 3. Make the ACTIVE check-in trigger enforce verification.
-- 4. Recompute weekly totals from the scoring audit log and synchronize matchup
--    scores instead of incrementing matchup totals opportunistically.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- MATCHUP SCORE SYNCHRONIZATION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_matchup_score(
    _user_id UUID,
    _week_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_total NUMERIC := 0;
BEGIN
    SELECT COALESCE(ws.total_points, 0)
    INTO current_total
    FROM public.weekly_scores ws
    WHERE ws.user_id = _user_id
      AND ws.week_id = _week_id;

    IF NOT FOUND THEN
        current_total := 0;
    END IF;

    UPDATE public.matchups m
    SET user1_score = current_total,
        updated_at = now()
    WHERE m.week_id = _week_id
      AND m.user1_id = _user_id;

    UPDATE public.matchups m
    SET user2_score = current_total,
        updated_at = now()
    WHERE m.week_id = _week_id
      AND m.user2_id = _user_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- ROUND-ROBIN SCHEDULE GENERATION
-- -----------------------------------------------------------------------------
-- Uses the circle method. When there is an odd number of members, a NULL slot
-- represents a bye. Existing completed/started weeks are preserved. A week is
-- considered safe to rebuild only if it is unlocked, has no non-reversed
-- scoring events, and has no completed matchup.
CREATE OR REPLACE FUNCTION public.refresh_season_matchups(_season_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_league_id UUID;
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
    SELECT s.league_id
    INTO v_league_id
    FROM public.seasons s
    WHERE s.id = _season_id;

    IF v_league_id IS NULL THEN
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
            DELETE FROM public.matchups m
            WHERE m.week_id = week_rec.id;

            IF member_count >= 2 THEN
                FOR pair_index IN 1..(slot_count / 2) LOOP
                    left_user := rotation[pair_index];
                    right_user := rotation[slot_count - pair_index + 1];

                    IF left_user IS NOT NULL AND right_user IS NOT NULL THEN
                        INSERT INTO public.matchups (
                            week_id,
                            user1_id,
                            user2_id,
                            user1_score,
                            user2_score,
                            status
                        ) VALUES (
                            week_rec.id,
                            left_user,
                            right_user,
                            COALESCE((
                                SELECT ws.total_points
                                FROM public.weekly_scores ws
                                WHERE ws.week_id = week_rec.id AND ws.user_id = left_user
                            ), 0),
                            COALESCE((
                                SELECT ws.total_points
                                FROM public.weekly_scores ws
                                WHERE ws.week_id = week_rec.id AND ws.user_id = right_user
                            ), 0),
                            'scheduled'
                        );
                    END IF;
                END LOOP;
            END IF;
        END IF;

        -- Rotate all but the first slot so week N always maps to a deterministic
        -- round for the current membership set.
        IF slot_count > 2 THEN
            rotation := ARRAY[rotation[1], rotation[slot_count]] || rotation[2:slot_count - 1];
        END IF;
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- SEASON ACTIVATION / MEMBERSHIP HOOKS
-- -----------------------------------------------------------------------------
-- Keep the existing activation responsibilities and add schedule generation.
CREATE OR REPLACE FUNCTION public.on_season_activated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    member RECORD;
BEGIN
    IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
        PERFORM public.generate_task_instances_for_user(NEW.id, NULL);

        FOR member IN
            SELECT lm.user_id
            FROM public.league_members lm
            WHERE lm.league_id = NEW.league_id
        LOOP
            INSERT INTO public.season_standings (user_id, season_id)
            VALUES (member.user_id, NEW.id)
            ON CONFLICT (user_id, season_id) DO NOTHING;
        END LOOP;

        PERFORM public.refresh_season_matchups(NEW.id);
    END IF;

    RETURN NEW;
END;
$$;

-- Preserve the existing new-member responsibilities and refresh any active
-- season schedule. Unplayed weeks may change; already-scored weeks do not.
CREATE OR REPLACE FUNCTION public.on_league_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    active_season RECORD;
BEGIN
    FOR active_season IN
        SELECT s.id
        FROM public.seasons s
        WHERE s.league_id = NEW.league_id
          AND s.status = 'active'
    LOOP
        PERFORM public.generate_task_instances_for_user(active_season.id, NEW.user_id);

        INSERT INTO public.season_standings (user_id, season_id)
        VALUES (NEW.user_id, active_season.id)
        ON CONFLICT (user_id, season_id) DO NOTHING;

        PERFORM public.refresh_season_matchups(active_season.id);
    END LOOP;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_league_member_left()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    active_season RECORD;
BEGIN
    FOR active_season IN
        SELECT s.id
        FROM public.seasons s
        WHERE s.league_id = OLD.league_id
          AND s.status = 'active'
    LOOP
        PERFORM public.refresh_season_matchups(active_season.id);
    END LOOP;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_league_member_left_trigger ON public.league_members;
CREATE TRIGGER on_league_member_left_trigger
AFTER DELETE ON public.league_members
FOR EACH ROW
EXECUTE FUNCTION public.on_league_member_left();

-- -----------------------------------------------------------------------------
-- ACTIVE CHECK-IN SCORING TRIGGER
-- -----------------------------------------------------------------------------
-- The installed daily_checkins trigger calls process_checkin_scoring(). A later
-- migration introduced verification in a different function named
-- on_checkin_score(), leaving verification disconnected. This replaces the
-- function that the trigger actually invokes.
CREATE OR REPLACE FUNCTION public.process_checkin_scoring()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    task_inst RECORD;
    season_rec RECORD;
    v_week_id UUID;
    v_league_id UUID;
    score_result RECORD;
    powerup_result RECORD;
    final_points NUMERIC := 0;
    is_binary_missed BOOLEAN := FALSE;
    raw_val NUMERIC := 0;
    checkin_verified BOOLEAN;
BEGIN
    SELECT * INTO task_inst
    FROM public.task_instances
    WHERE id = NEW.task_instance_id;

    IF NOT FOUND THEN
        RAISE WARNING 'Task instance not found: %', NEW.task_instance_id;
        RETURN NEW;
    END IF;

    SELECT s.*, s.league_id AS resolved_league_id
    INTO season_rec
    FROM public.seasons s
    WHERE s.id = task_inst.season_id;

    IF NOT FOUND THEN
        RAISE WARNING 'Season not found for task instance: %', task_inst.season_id;
        RETURN NEW;
    END IF;

    v_league_id := season_rec.resolved_league_id;
    v_week_id := public.get_week_for_date(task_inst.season_id, NEW.checkin_date::DATE);

    IF v_week_id IS NULL THEN
        RAISE WARNING 'No week found for season % and date %', task_inst.season_id, NEW.checkin_date;
        RETURN NEW;
    END IF;

    CASE task_inst.input_type::TEXT
        WHEN 'binary' THEN raw_val := CASE WHEN NEW.boolean_value THEN 1 ELSE 0 END;
        WHEN 'numeric' THEN raw_val := COALESCE(NEW.numeric_value, 0);
        WHEN 'time' THEN raw_val := EXTRACT(HOUR FROM NEW.time_value::TIME) * 60
                              + EXTRACT(MINUTE FROM NEW.time_value::TIME);
        WHEN 'duration' THEN raw_val := COALESCE(NEW.duration_minutes, 0);
        ELSE raw_val := 0;
    END CASE;

    -- Reverse the previous audit event for this check-in before recalculating.
    UPDATE public.scoring_events se
    SET is_reversed = TRUE
    WHERE se.daily_checkin_id = NEW.id
      AND se.is_reversed = FALSE;

    checkin_verified := public.is_checkin_verified(NEW, task_inst);

    IF NOT checkin_verified THEN
        INSERT INTO public.scoring_events (
            daily_checkin_id, user_id, week_id, season_id, league_id,
            task_instance_id, scoring_type, raw_value,
            points_before_cap, points_awarded, rule_applied,
            config_snapshot, derived_values, is_reversed
        ) VALUES (
            NEW.id, NEW.user_id, v_week_id, task_inst.season_id, v_league_id,
            task_inst.id, task_inst.scoring_type, raw_val,
            0, 0, 'unverified_checkin', task_inst.config,
            jsonb_build_object('verification_failed', true, 'metadata', NEW.metadata),
            FALSE
        );
    ELSE
        SELECT * INTO score_result
        FROM public.calculate_checkin_score(NEW, task_inst);

        IF task_inst.scoring_type::TEXT = 'binary_yesno'
           AND (NEW.boolean_value IS NULL OR NEW.boolean_value = FALSE) THEN
            is_binary_missed := TRUE;
        END IF;

        SELECT * INTO powerup_result
        FROM public.apply_powerups(
            NEW.user_id,
            v_week_id,
            task_inst.id,
            score_result.points_awarded,
            is_binary_missed
        );

        final_points := powerup_result.final_points;

        INSERT INTO public.scoring_events (
            daily_checkin_id, user_id, week_id, season_id, league_id,
            task_instance_id, scoring_type, raw_value,
            points_before_cap, points_awarded, rule_applied,
            config_snapshot, derived_values, powerup_applied, is_reversed
        ) VALUES (
            NEW.id, NEW.user_id, v_week_id, task_inst.season_id, v_league_id,
            task_inst.id, task_inst.scoring_type, raw_val,
            score_result.points_before_cap, final_points, score_result.rule_applied,
            task_inst.config, score_result.derived_values,
            powerup_result.powerup_applied, FALSE
        );
    END IF;

    -- Always derive aggregates from the non-reversed audit events. This keeps
    -- edits, failed verification, and reversals idempotent.
    PERFORM public.update_weekly_score(NEW.user_id, v_week_id);
    PERFORM public.sync_matchup_score(NEW.user_id, v_week_id);
    PERFORM public.update_season_standing(NEW.user_id, task_inst.season_id);

    RETURN NEW;
END;
$$;

-- Backfill schedules for active seasons. The refresh function preserves weeks
-- that already have scoring activity or completed matchups.
DO $$
DECLARE
    season_rec RECORD;
BEGIN
    FOR season_rec IN
        SELECT s.id
        FROM public.seasons s
        WHERE s.status = 'active'
    LOOP
        PERFORM public.refresh_season_matchups(season_rec.id);
    END LOOP;
END $$;
