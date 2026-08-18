-- =============================================================================
-- SCORING CONTRACT NORMALIZATION
-- =============================================================================
-- Zrizin accumulated several generations of task config keys. Normalize them in
-- one scoring contract and, critically, honor the league UI's scoring_mode:
--   binary   = equal baseline points for hitting the configured goal
--   detailed = task-specific progressive/threshold/tiered scoring
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calc_score_binary_yesno(
    _boolean_value BOOLEAN,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    completion_points NUMERIC;
BEGIN
    completion_points := COALESCE(
        (_config->>'points_per_completion')::NUMERIC,
        (_config->>'points')::NUMERIC,
        (_config->>'binary_points')::NUMERIC,
        3
    );

    RETURN CASE WHEN _boolean_value = TRUE THEN completion_points ELSE 0 END;
END;
$$;

CREATE OR REPLACE FUNCTION public.calc_score_linear_per_unit(
    _numeric_value NUMERIC,
    _config JSONB,
    OUT points_before_cap NUMERIC,
    OUT points_awarded NUMERIC
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    unit_size NUMERIC;
    points_per_unit NUMERIC;
    daily_cap NUMERIC;
BEGIN
    unit_size := COALESCE((_config->>'unit_size')::NUMERIC, 1);
    points_per_unit := COALESCE((_config->>'points_per_unit')::NUMERIC, 1);
    daily_cap := COALESCE(
        (_config->>'daily_cap')::NUMERIC,
        (_config->>'max_points')::NUMERIC,
        (_config->>'max_daily_points')::NUMERIC,
        (_config->>'cap')::NUMERIC
    );

    IF unit_size = 0 THEN
        unit_size := 1;
    END IF;

    points_before_cap := (_numeric_value / unit_size) * points_per_unit;
    points_awarded := CASE
        WHEN daily_cap IS NOT NULL THEN LEAST(points_before_cap, daily_cap)
        ELSE points_before_cap
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.calc_score_threshold(
    _numeric_value NUMERIC,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    threshold_value NUMERIC;
    threshold_points NUMERIC;
    bonus_per_unit NUMERIC;
    max_bonus NUMERIC;
    overall_cap NUMERIC;
    bonus NUMERIC := 0;
    result NUMERIC := 0;
BEGIN
    threshold_value := COALESCE(
        (_config->>'threshold')::NUMERIC,
        (_config->>'target')::NUMERIC,
        0
    );
    threshold_points := COALESCE(
        (_config->>'points_for_threshold')::NUMERIC,
        (_config->>'points_at_threshold')::NUMERIC,
        (_config->>'points')::NUMERIC,
        10
    );
    bonus_per_unit := COALESCE(
        (_config->>'bonus_per_unit')::NUMERIC,
        (_config->>'bonus_per_minute')::NUMERIC,
        0
    );
    max_bonus := (_config->>'max_bonus')::NUMERIC;
    overall_cap := COALESCE(
        (_config->>'daily_cap')::NUMERIC,
        (_config->>'max_points')::NUMERIC,
        (_config->>'max_daily_points')::NUMERIC,
        (_config->>'cap')::NUMERIC
    );

    IF _numeric_value < threshold_value THEN
        RETURN 0;
    END IF;

    IF bonus_per_unit > 0 THEN
        bonus := GREATEST(_numeric_value - threshold_value, 0) * bonus_per_unit;
        IF max_bonus IS NOT NULL THEN
            bonus := LEAST(bonus, max_bonus);
        END IF;
    END IF;

    result := threshold_points + bonus;
    IF overall_cap IS NOT NULL THEN
        result := LEAST(result, overall_cap);
    END IF;

    RETURN result;
END;
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

    IF _time_value <= target_time THEN
        RETURN on_time_points;
    END IF;

    IF penalty_per_minute <= 0 THEN
        RETURN 0;
    END IF;

    minutes_late := EXTRACT(EPOCH FROM (_time_value - target_time)) / 60;
    minutes_late := GREATEST(minutes_late - grace_minutes, 0);
    penalty := LEAST(minutes_late * penalty_per_minute, max_penalty);

    RETURN GREATEST(on_time_points - penalty, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.calc_score_time_after(
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
    success_points NUMERIC;
BEGIN
    IF _time_value IS NULL THEN
        RETURN 0;
    END IF;

    target_time := COALESCE((_config->>'target_time')::TIME, '06:00:00'::TIME);
    success_points := COALESCE(
        (_config->>'points_for_success')::NUMERIC,
        (_config->>'points_on_time')::NUMERIC,
        (_config->>'points')::NUMERIC,
        10
    );

    RETURN CASE WHEN _time_value >= target_time THEN success_points ELSE 0 END;
END;
$$;

CREATE OR REPLACE FUNCTION public.calc_score_tiered(
    _numeric_value NUMERIC,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    tiers JSONB;
    tier JSONB;
    tier_min NUMERIC;
    tier_max NUMERIC;
    tier_points NUMERIC;
BEGIN
    tiers := _config->'tiers';

    IF tiers IS NULL OR jsonb_typeof(tiers) <> 'array' OR jsonb_array_length(tiers) = 0 THEN
        RETURN public.calc_score_threshold(_numeric_value, _config);
    END IF;

    -- Preserve configured array order. Support both historical {min,max} tiers
    -- and the later {max_value,points} upper-bound format.
    FOR tier IN SELECT * FROM jsonb_array_elements(tiers)
    LOOP
        tier_points := COALESCE((tier->>'points')::NUMERIC, 0);

        IF tier ? 'max_value' THEN
            tier_max := (tier->>'max_value')::NUMERIC;
            IF tier_max IS NULL OR _numeric_value <= tier_max THEN
                RETURN tier_points;
            END IF;
        ELSE
            tier_min := COALESCE((tier->>'min')::NUMERIC, 0);
            tier_max := (tier->>'max')::NUMERIC;
            IF _numeric_value >= tier_min AND (tier_max IS NULL OR _numeric_value < tier_max) THEN
                RETURN tier_points;
            END IF;
        END IF;
    END LOOP;

    RETURN 0;
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

    -- Equal-weight binary mode: the input can remain numeric/time/duration for
    -- verification and transparency, but points are all-or-nothing at the goal.
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
                ELSIF scoring_type = 'time_after' THEN
                    success := _checkin.time_value::TIME >= COALESCE((config->>'target_time')::TIME, '06:00'::TIME);
                ELSE
                    success := _checkin.time_value::TIME <= COALESCE((config->>'target_time')::TIME, '23:59'::TIME);
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

-- Ensure generated task instances always carry the league-level daily cap into
-- the config consumed by the scoring functions.
CREATE OR REPLACE FUNCTION public.generate_task_instances_for_user(_season_id UUID, _user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    config_rec RECORD;
    merged_config JSONB;
BEGIN
    FOR config_rec IN
        SELECT
            ltc.id AS league_task_config_id,
            ltc.config_overrides,
            ltc.max_daily_points,
            tt.name,
            tt.input_type,
            tt.scoring_type,
            tt.default_config
        FROM public.league_task_configs ltc
        JOIN public.task_templates tt ON tt.id = ltc.task_template_id
        WHERE ltc.season_id = _season_id
          AND ltc.is_enabled = TRUE
    LOOP
        merged_config := COALESCE(config_rec.default_config, '{}'::JSONB)
            || COALESCE(config_rec.config_overrides, '{}'::JSONB)
            || jsonb_build_object('max_daily_points', config_rec.max_daily_points);

        IF NOT EXISTS (
            SELECT 1
            FROM public.task_instances ti
            WHERE ti.season_id = _season_id
              AND ti.league_task_config_id = config_rec.league_task_config_id
        ) THEN
            INSERT INTO public.task_instances (
                season_id,
                league_task_config_id,
                task_name,
                input_type,
                scoring_type,
                config
            ) VALUES (
                _season_id,
                config_rec.league_task_config_id,
                config_rec.name,
                config_rec.input_type,
                config_rec.scoring_type,
                merged_config
            );
        ELSE
            UPDATE public.task_instances ti
            SET config = merged_config,
                task_name = config_rec.name,
                input_type = config_rec.input_type,
                scoring_type = config_rec.scoring_type
            WHERE ti.season_id = _season_id
              AND ti.league_task_config_id = config_rec.league_task_config_id;
        END IF;
    END LOOP;
END;
$$;

-- Bring existing active/draft task instances onto the same normalized contract.
DO $$
DECLARE
    season_rec RECORD;
BEGIN
    FOR season_rec IN
        SELECT s.id
        FROM public.seasons s
        WHERE s.status IN ('active', 'draft')
    LOOP
        PERFORM public.generate_task_instances_for_user(season_rec.id, NULL);
    END LOOP;
END $$;
