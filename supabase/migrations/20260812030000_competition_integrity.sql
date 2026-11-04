-- =============================================================================
-- COMPETITIVE INTEGRITY
-- =============================================================================
-- Client UI rules are not security rules. Enforce the fantasy scoring window in
-- Postgres so a custom client cannot future-date a check-in, alter a locked week,
-- or bypass verification by writing {"admin_override": true} into metadata.
-- =============================================================================

-- Verification may only be satisfied by the task's configured source/action.
-- The previous metadata-only admin override was user-spoofable, so remove it
-- until commissioner corrections are exposed through a dedicated privileged RPC.
CREATE OR REPLACE FUNCTION public.is_checkin_verified(
    _checkin RECORD,
    _task_instance RECORD
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    verification_config JSONB;
    metadata JSONB;
    requires_confirmation BOOLEAN;
    auto_import_only BOOLEAN;
    source TEXT;
BEGIN
    verification_config := (_task_instance.config->>'verification')::JSONB;

    IF verification_config IS NULL THEN
        RETURN TRUE;
    END IF;

    metadata := COALESCE(_checkin.metadata, '{}'::JSONB);

    auto_import_only := COALESCE((verification_config->>'auto_import_only')::BOOLEAN, FALSE);
    source := COALESCE(metadata->>'source', 'manual');

    IF auto_import_only AND source = 'manual' THEN
        RETURN FALSE;
    END IF;

    requires_confirmation := COALESCE((verification_config->>'requires_confirmation')::BOOLEAN, FALSE);
    IF requires_confirmation AND (metadata->>'confirmed')::BOOLEAN IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

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
    is_binary_missed BOOLEAN := FALSE;
    raw_val NUMERIC := 0;
    checkin_verified BOOLEAN;
    league_timezone TEXT := 'America/New_York';
    local_today DATE;
BEGIN
    SELECT * INTO task_inst
    FROM public.task_instances
    WHERE id = NEW.task_instance_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task instance not found';
    END IF;

    SELECT * INTO season_rec
    FROM public.seasons
    WHERE id = task_inst.season_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Season not found';
    END IF;

    IF season_rec.status <> 'active' THEN
        RAISE EXCEPTION 'Scoring is not open for this season';
    END IF;

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

    IF NOT FOUND THEN
        RAISE EXCEPTION 'This date is outside the active season';
    END IF;

    -- The week containing the check-in must be the week that is live *now*.
    -- This permits normal same-week backfilling/editing but blocks future-week
    -- pre-scoring and changes after Saturday lock.
    IF week_rec.is_locked
       OR local_today < week_rec.start_date
       OR local_today > week_rec.end_date THEN
        RAISE EXCEPTION 'Check-ins can only be scored during the live Sunday-to-Saturday week';
    END IF;

    IF auth.uid() IS NOT NULL AND NEW.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'You can only score your own check-ins';
    END IF;

    CASE task_inst.input_type::TEXT
        WHEN 'binary' THEN raw_val := CASE WHEN NEW.boolean_value THEN 1 ELSE 0 END;
        WHEN 'numeric' THEN raw_val := COALESCE(NEW.numeric_value, 0);
        WHEN 'time' THEN raw_val := EXTRACT(HOUR FROM NEW.time_value::TIME) * 60
                              + EXTRACT(MINUTE FROM NEW.time_value::TIME);
        WHEN 'duration' THEN raw_val := COALESCE(NEW.duration_minutes, 0);
        ELSE raw_val := 0;
    END CASE;

    -- Every edit reverses the previous audit event first. Weekly totals are then
    -- rebuilt from non-reversed events, preserving idempotency.
    UPDATE public.scoring_events
    SET is_reversed = TRUE
    WHERE daily_checkin_id = NEW.id
      AND is_reversed = FALSE;

    checkin_verified := public.is_checkin_verified(NEW, task_inst);

    IF NOT checkin_verified THEN
        INSERT INTO public.scoring_events (
            daily_checkin_id, user_id, week_id, season_id, league_id,
            task_instance_id, scoring_type, raw_value,
            points_before_cap, points_awarded, rule_applied,
            config_snapshot, derived_values, is_reversed
        ) VALUES (
            NEW.id, NEW.user_id, week_rec.id, task_inst.season_id, season_rec.league_id,
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
            week_rec.id,
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
            NEW.id, NEW.user_id, week_rec.id, task_inst.season_id, season_rec.league_id,
            task_inst.id, task_inst.scoring_type, raw_val,
            score_result.points_before_cap, final_points, score_result.rule_applied,
            task_inst.config, score_result.derived_values,
            powerup_result.powerup_applied, FALSE
        );
    END IF;

    PERFORM public.update_weekly_score(NEW.user_id, week_rec.id);
    PERFORM public.sync_matchup_score(NEW.user_id, week_rec.id);
    PERFORM public.update_season_standing(NEW.user_id, task_inst.season_id);

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.process_checkin_scoring IS
'Competitive scoring gate: only authenticated users own live-week check-ins can score; edits are audit-safe; verification and Power Plays are applied server-side.';
