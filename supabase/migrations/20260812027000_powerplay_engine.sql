-- =============================================================================
-- WEEKLY POWER PLAY ENGINE
-- =============================================================================
-- The original UI marked a power-up is_used=true when a user merely activated
-- it, while the scoring engine only looked for is_used=false. That made the
-- effect impossible to apply. Separate activation from consumption and issue
-- every member one 2x Power Play per scoring week.
-- =============================================================================

ALTER TABLE public.powerups
  ADD COLUMN IF NOT EXISTS is_activated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consumed_checkin_id UUID REFERENCES public.daily_checkins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_powerups_armed
  ON public.powerups (user_id, week_id, is_activated, is_used);

CREATE INDEX IF NOT EXISTS idx_powerups_consumed_checkin
  ON public.powerups (consumed_checkin_id)
  WHERE consumed_checkin_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- ISSUE ONE WEEKLY 2X POWER PLAY TO EVERY MEMBER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_season_powerplays(_season_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_league_id UUID;
BEGIN
    SELECT s.league_id
    INTO v_league_id
    FROM public.seasons s
    WHERE s.id = _season_id;

    IF v_league_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.powerups (
        user_id,
        week_id,
        powerup_type,
        modifier_value,
        is_activated,
        is_used
    )
    SELECT
        lm.user_id,
        w.id,
        'multiplier',
        2,
        FALSE,
        FALSE
    FROM public.weeks w
    CROSS JOIN public.league_members lm
    WHERE w.season_id = _season_id
      AND lm.league_id = v_league_id
    ON CONFLICT (user_id, week_id, powerup_type) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_powerplay_season_activated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status <> 'active') THEN
        PERFORM public.grant_season_powerplays(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_powerplay_season_activated_trigger ON public.seasons;
CREATE TRIGGER on_powerplay_season_activated_trigger
AFTER UPDATE ON public.seasons
FOR EACH ROW
EXECUTE FUNCTION public.on_powerplay_season_activated();

CREATE OR REPLACE FUNCTION public.on_powerplay_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    season_rec RECORD;
BEGIN
    FOR season_rec IN
        SELECT s.id
        FROM public.seasons s
        WHERE s.league_id = NEW.league_id
          AND s.status = 'active'
    LOOP
        PERFORM public.grant_season_powerplays(season_rec.id);
    END LOOP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_powerplay_member_joined_trigger ON public.league_members;
CREATE TRIGGER on_powerplay_member_joined_trigger
AFTER INSERT ON public.league_members
FOR EACH ROW
EXECUTE FUNCTION public.on_powerplay_member_joined();

-- -----------------------------------------------------------------------------
-- ARM A POWER-UP WITHOUT CONSUMING IT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_powerup(
    _powerup_id UUID,
    _task_instance_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    powerup_rec RECORD;
    league_timezone TEXT := 'America/New_York';
    local_today DATE;
BEGIN
    SELECT
        p.*,
        w.start_date,
        w.end_date,
        w.is_locked,
        s.id AS season_id,
        s.league_id,
        l.created_by
    INTO powerup_rec
    FROM public.powerups p
    JOIN public.weeks w ON w.id = p.week_id
    JOIN public.seasons s ON s.id = w.season_id
    JOIN public.leagues l ON l.id = s.league_id
    WHERE p.id = _powerup_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Power Play not found';
    END IF;

    IF auth.uid() IS NULL OR auth.uid() <> powerup_rec.user_id THEN
        RAISE EXCEPTION 'You can only activate your own Power Play';
    END IF;

    IF powerup_rec.is_used THEN
        RAISE EXCEPTION 'This Power Play has already been used';
    END IF;

    IF powerup_rec.is_activated THEN
        RETURN;
    END IF;

    SELECT COALESCE(pr.timezone, 'America/New_York')
    INTO league_timezone
    FROM public.profiles pr
    WHERE pr.id = powerup_rec.created_by;

    league_timezone := COALESCE(league_timezone, 'America/New_York');
    local_today := (now() AT TIME ZONE league_timezone)::DATE;

    IF powerup_rec.is_locked
       OR local_today < powerup_rec.start_date
       OR local_today > powerup_rec.end_date THEN
        RAISE EXCEPTION 'Power Plays can only be activated during a live scoring week';
    END IF;

    IF _task_instance_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.task_instances ti
        WHERE ti.id = _task_instance_id
          AND ti.season_id = powerup_rec.season_id
    ) THEN
        RAISE EXCEPTION 'That task does not belong to this season';
    END IF;

    UPDATE public.powerups
    SET is_activated = TRUE,
        activated_at = now(),
        task_instance_id = _task_instance_id
    WHERE id = _powerup_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_powerup(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_powerup(UUID, UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- APPLY ARMED POWER-UPS AND PRESERVE THEM ACROSS CHECK-IN EDITS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_armed_powerups(
    _user_id UUID,
    _week_id UUID,
    _task_instance_id UUID,
    _daily_checkin_id UUID,
    _base_points NUMERIC,
    _is_binary_missed BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
    final_points NUMERIC,
    powerup_applied JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    powerup RECORD;
    result_points NUMERIC := _base_points;
    applied JSONB := '[]'::jsonb;
    had_consumed_powerup BOOLEAN := FALSE;
BEGIN
    -- If this check-in previously consumed a Power Play, editing the value must
    -- recalculate with the same effect instead of silently losing the boost.
    FOR powerup IN
        SELECT p.*
        FROM public.powerups p
        WHERE p.user_id = _user_id
          AND p.week_id = _week_id
          AND p.consumed_checkin_id = _daily_checkin_id
          AND p.is_used = TRUE
        ORDER BY p.used_at, p.id
    LOOP
        had_consumed_powerup := TRUE;

        CASE powerup.powerup_type
            WHEN 'multiplier' THEN
                result_points := result_points * powerup.modifier_value;
            WHEN 'flat_boost' THEN
                result_points := result_points + powerup.modifier_value;
            WHEN 'forgiveness' THEN
                IF _is_binary_missed THEN
                    result_points := GREATEST(result_points, powerup.modifier_value);
                END IF;
        END CASE;

        applied := applied || jsonb_build_array(jsonb_build_object(
            'type', powerup.powerup_type,
            'value', powerup.modifier_value,
            'powerup_id', powerup.id,
            'reapplied', TRUE
        ));
    END LOOP;

    IF had_consumed_powerup THEN
        RETURN QUERY SELECT result_points, applied;
        RETURN;
    END IF;

    -- Consume all armed power-ups that are eligible for this scoring action.
    FOR powerup IN
        SELECT p.*
        FROM public.powerups p
        WHERE p.user_id = _user_id
          AND p.week_id = _week_id
          AND p.is_activated = TRUE
          AND p.is_used = FALSE
          AND (p.task_instance_id IS NULL OR p.task_instance_id = _task_instance_id)
        ORDER BY p.activated_at, p.created_at, p.id
        FOR UPDATE
    LOOP
        IF powerup.powerup_type = 'multiplier' AND _base_points <= 0 THEN
            CONTINUE;
        END IF;

        IF powerup.powerup_type = 'forgiveness' AND NOT _is_binary_missed THEN
            CONTINUE;
        END IF;

        CASE powerup.powerup_type
            WHEN 'multiplier' THEN
                result_points := result_points * powerup.modifier_value;
            WHEN 'flat_boost' THEN
                result_points := result_points + powerup.modifier_value;
            WHEN 'forgiveness' THEN
                result_points := GREATEST(result_points, powerup.modifier_value);
            ELSE
                CONTINUE;
        END CASE;

        UPDATE public.powerups
        SET is_used = TRUE,
            used_at = now(),
            consumed_checkin_id = _daily_checkin_id,
            task_instance_id = COALESCE(task_instance_id, _task_instance_id)
        WHERE id = powerup.id;

        applied := applied || jsonb_build_array(jsonb_build_object(
            'type', powerup.powerup_type,
            'value', powerup.modifier_value,
            'powerup_id', powerup.id
        ));
    END LOOP;

    RETURN QUERY SELECT result_points, NULLIF(applied, '[]'::jsonb);
END;
$$;

-- -----------------------------------------------------------------------------
-- CONNECT POWER PLAYS TO THE ACTIVE, VERIFIED SCORING TRIGGER
-- -----------------------------------------------------------------------------
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
        FROM public.apply_armed_powerups(
            NEW.user_id,
            v_week_id,
            task_inst.id,
            NEW.id,
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

    PERFORM public.update_weekly_score(NEW.user_id, v_week_id);
    PERFORM public.sync_matchup_score(NEW.user_id, v_week_id);
    PERFORM public.update_season_standing(NEW.user_id, task_inst.season_id);

    RETURN NEW;
END;
$$;

-- Backfill one weekly multiplier for currently active seasons.
DO $$
DECLARE
    season_rec RECORD;
BEGIN
    FOR season_rec IN
        SELECT s.id
        FROM public.seasons s
        WHERE s.status = 'active'
    LOOP
        PERFORM public.grant_season_powerplays(season_rec.id);
    END LOOP;
END $$;
