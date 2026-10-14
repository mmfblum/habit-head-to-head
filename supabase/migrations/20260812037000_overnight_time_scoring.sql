-- =============================================================================
-- OVERNIGHT TIME SEMANTICS
-- =============================================================================
-- SQL TIME compares 00:30 < 23:00, but for an evening bedtime target 00:30 is
-- actually late, not early. Treat after-midnight values as belonging after an
-- evening target while preserving normal morning-target behavior.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.time_meets_before_target(
    _time_value TIME,
    _target_time TIME
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN _time_value IS NULL OR _target_time IS NULL THEN FALSE
        WHEN _target_time >= '12:00:00'::TIME AND _time_value < '12:00:00'::TIME THEN FALSE
        ELSE _time_value <= _target_time
    END
$$;

CREATE OR REPLACE FUNCTION public.calc_score_time_before(
    _time_value TIME,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    target_time TIME;
    on_time_points NUMERIC;
    penalty_per_minute NUMERIC;
    grace_minutes NUMERIC;
    max_penalty NUMERIC;
    value_minutes NUMERIC;
    target_minutes NUMERIC;
    minutes_late NUMERIC;
    penalty NUMERIC;
BEGIN
    IF _time_value IS NULL THEN
        RETURN 0;
    END IF;

    target_time := COALESCE((_config->>'target_time')::TIME, '22:00:00'::TIME);
    on_time_points := COALESCE(
        (_config->>'points_for_success')::NUMERIC,
        (_config->>'points_on_time')::NUMERIC,
        (_config->>'points')::NUMERIC,
        10
    );
    penalty_per_minute := COALESCE((_config->>'penalty_per_minute')::NUMERIC, 0);
    grace_minutes := COALESCE((_config->>'grace_minutes')::NUMERIC, 0);
    max_penalty := COALESCE((_config->>'max_penalty')::NUMERIC, on_time_points);

    IF public.time_meets_before_target(_time_value, target_time) THEN
        RETURN on_time_points;
    END IF;

    IF penalty_per_minute <= 0 THEN
        RETURN 0;
    END IF;

    value_minutes := EXTRACT(HOUR FROM _time_value) * 60 + EXTRACT(MINUTE FROM _time_value);
    target_minutes := EXTRACT(HOUR FROM target_time) * 60 + EXTRACT(MINUTE FROM target_time);

    IF target_time >= '12:00:00'::TIME AND _time_value < '12:00:00'::TIME THEN
        minutes_late := (1440 - target_minutes) + value_minutes;
    ELSE
        minutes_late := GREATEST(value_minutes - target_minutes, 0);
    END IF;

    minutes_late := GREATEST(minutes_late - grace_minutes, 0);
    penalty := LEAST(minutes_late * penalty_per_minute, max_penalty);

    RETURN GREATEST(on_time_points - penalty, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_checkin_score(
    _checkin RECORD,
    _task_instance RECORD
)
RETURNS TABLE(
    points_before_cap NUMERIC,
    points_awarded NUMERIC,
    rule_applied TEXT,
    derived_values JSONB
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    config JSONB := COALESCE(_task_instance.config, '{}'::JSONB);
    scoring_type TEXT := _task_instance.scoring_type::TEXT;
    input_type TEXT := _task_instance.input_type::TEXT;
    scoring_mode TEXT;
    raw_value NUMERIC := 0;
    target_value NUMERIC;
    target_time TIME;
    binary_points NUMERIC;
    success BOOLEAN := FALSE;
    result_before NUMERIC := 0;
    result_points NUMERIC := 0;
    result_rule TEXT;
    result_derived JSONB := '{}'::JSONB;
BEGIN
    scoring_mode := COALESCE(config->>'scoring_mode', 'detailed');

    CASE input_type
        WHEN 'binary' THEN
            raw_value := CASE WHEN _checkin.boolean_value THEN 1 ELSE 0 END;
        WHEN 'numeric' THEN
            raw_value := COALESCE(_checkin.numeric_value, 0);
        WHEN 'time' THEN
            IF _checkin.time_value IS NOT NULL THEN
                raw_value := EXTRACT(HOUR FROM _checkin.time_value::TIME) * 60
                           + EXTRACT(MINUTE FROM _checkin.time_value::TIME);
            END IF;
        WHEN 'duration' THEN
            raw_value := COALESCE(_checkin.duration_minutes, 0);
        ELSE
            raw_value := 0;
    END CASE;

    IF scoring_mode = 'binary' THEN
        binary_points := COALESCE(
            (config->>'binary_points')::NUMERIC,
            (config->>'points')::NUMERIC,
            3
        );

        CASE input_type
            WHEN 'binary' THEN
                success := COALESCE(_checkin.boolean_value, FALSE);
            WHEN 'time' THEN
                IF _checkin.time_value IS NULL THEN
                    success := FALSE;
                ELSE
                    target_time := COALESCE((config->>'target_time')::TIME, '23:59'::TIME);
                    IF scoring_type = 'time_after' THEN
                        success := _checkin.time_value::TIME >= target_time;
                    ELSE
                        success := public.time_meets_before_target(_checkin.time_value::TIME, target_time);
                    END IF;
                END IF;
            ELSE
                IF config ? 'daily_limit_minutes' THEN
                    target_value := (config->>'daily_limit_minutes')::NUMERIC;
                    success := raw_value <= target_value;
                ELSE
                    target_value := COALESCE(
                        (config->>'target')::NUMERIC,
                        (config->>'threshold')::NUMERIC,
                        1
                    );
                    success := raw_value >= target_value;
                END IF;
        END CASE;

        result_points := CASE WHEN success THEN binary_points ELSE 0 END;
        result_before := result_points;
        result_rule := 'binary_mode: success=' || success::TEXT;
        result_derived := jsonb_build_object(
            'scoring_mode', 'binary',
            'raw_value', raw_value,
            'target', target_value,
            'target_time', target_time,
            'binary_points', binary_points
        );

        RETURN QUERY SELECT result_before, result_points, result_rule, result_derived;
        RETURN;
    END IF;

    CASE scoring_type
        WHEN 'binary_yesno' THEN
            result_points := public.calc_score_binary_yesno(_checkin.boolean_value, config);
            result_before := result_points;
            result_rule := 'binary_yesno';
        WHEN 'linear_per_unit' THEN
            SELECT l.points_before_cap, l.points_awarded
            INTO result_before, result_points
            FROM public.calc_score_linear_per_unit(raw_value, config) l;
            result_rule := 'linear_per_unit';
        WHEN 'threshold' THEN
            result_points := public.calc_score_threshold(raw_value, config);
            result_before := result_points;
            result_rule := 'threshold';
        WHEN 'time_before' THEN
            result_points := public.calc_score_time_before(_checkin.time_value::TIME, config);
            result_before := result_points;
            result_rule := 'time_before';
        WHEN 'time_after' THEN
            result_points := public.calc_score_time_after(_checkin.time_value::TIME, config);
            result_before := result_points;
            result_rule := 'time_after';
        WHEN 'tiered' THEN
            result_points := public.calc_score_tiered(raw_value, config);
            result_before := result_points;
            result_rule := 'tiered';
        WHEN 'diminishing' THEN
            result_points := public.calc_score_diminishing(raw_value, config);
            result_before := result_points;
            result_rule := 'diminishing';
        ELSE
            result_points := 0;
            result_before := 0;
            result_rule := 'unknown_scoring_type:' || scoring_type;
    END CASE;

    result_derived := jsonb_build_object(
        'scoring_mode', 'detailed',
        'raw_value', raw_value
    );

    RETURN QUERY SELECT result_before, result_points, result_rule, result_derived;
END;
$$;
