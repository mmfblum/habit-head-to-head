-- =============================================================================
-- SECURITY FIX: Add search_path to all scoring functions
-- =============================================================================

-- Fix calc_score_binary_yesno
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
    points_for_completion NUMERIC;
BEGIN
    points_for_completion := COALESCE((_config->>'points_per_completion')::NUMERIC, 10);
    
    IF _boolean_value = TRUE THEN
        RETURN points_for_completion;
    ELSE
        RETURN 0;
    END IF;
END;
$$;

-- Fix calc_score_linear_per_unit
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
    daily_cap := (_config->>'daily_cap')::NUMERIC;
    
    IF unit_size = 0 THEN unit_size := 1; END IF;
    
    points_before_cap := (_numeric_value / unit_size) * points_per_unit;
    
    IF daily_cap IS NOT NULL AND points_before_cap > daily_cap THEN
        points_awarded := daily_cap;
    ELSE
        points_awarded := points_before_cap;
    END IF;
END;
$$;

-- Fix calc_score_threshold
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
    points_for_threshold NUMERIC;
BEGIN
    threshold_value := COALESCE((_config->>'threshold')::NUMERIC, 0);
    points_for_threshold := COALESCE((_config->>'points_for_threshold')::NUMERIC, 10);
    
    IF _numeric_value >= threshold_value THEN
        RETURN points_for_threshold;
    ELSE
        RETURN 0;
    END IF;
END;
$$;

-- Fix calc_score_time_before
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
    points_for_success NUMERIC;
BEGIN
    target_time := COALESCE((_config->>'target_time')::TIME, '22:00:00'::TIME);
    points_for_success := COALESCE((_config->>'points_for_success')::NUMERIC, 10);
    
    IF _time_value IS NULL THEN
        RETURN 0;
    END IF;
    
    IF _time_value <= target_time THEN
        RETURN points_for_success;
    ELSE
        RETURN 0;
    END IF;
END;
$$;

-- Fix calc_score_time_after
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
    points_for_success NUMERIC;
BEGIN
    target_time := COALESCE((_config->>'target_time')::TIME, '06:00:00'::TIME);
    points_for_success := COALESCE((_config->>'points_for_success')::NUMERIC, 10);
    
    IF _time_value IS NULL THEN
        RETURN 0;
    END IF;
    
    IF _time_value >= target_time THEN
        RETURN points_for_success;
    ELSE
        RETURN 0;
    END IF;
END;
$$;

-- Fix calc_score_tiered
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
    result NUMERIC := 0;
BEGIN
    tiers := _config->'tiers';
    
    IF tiers IS NULL OR jsonb_array_length(tiers) = 0 THEN
        RETURN public.calc_score_threshold(_numeric_value, _config);
    END IF;
    
    FOR tier IN SELECT * FROM jsonb_array_elements(tiers)
    LOOP
        tier_min := COALESCE((tier->>'min')::NUMERIC, 0);
        tier_max := (tier->>'max')::NUMERIC;
        tier_points := COALESCE((tier->>'points')::NUMERIC, 0);
        
        IF _numeric_value >= tier_min AND (tier_max IS NULL OR _numeric_value < tier_max) THEN
            result := tier_points;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$;

-- Fix calc_score_diminishing
CREATE OR REPLACE FUNCTION public.calc_score_diminishing(
    _numeric_value NUMERIC,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    base_points NUMERIC;
    diminish_rate NUMERIC;
    threshold NUMERIC;
    result NUMERIC;
BEGIN
    base_points := COALESCE((_config->>'base_points')::NUMERIC, 1);
    diminish_rate := COALESCE((_config->>'diminish_rate')::NUMERIC, 0.5);
    threshold := COALESCE((_config->>'threshold')::NUMERIC, 100);
    
    IF _numeric_value <= threshold THEN
        result := _numeric_value * base_points;
    ELSE
        result := threshold * base_points + 
                  ((_numeric_value - threshold) * base_points * diminish_rate);
    END IF;
    
    RETURN result;
END;
$$;

-- Fix calculate_checkin_score
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
    config JSONB;
    scoring_type TEXT;
    raw_value NUMERIC;
    result_points_before NUMERIC := 0;
    result_points NUMERIC := 0;
    result_rule TEXT;
    result_derived JSONB := '{}'::jsonb;
BEGIN
    config := _task_instance.config;
    scoring_type := _task_instance.scoring_type::TEXT;
    
    CASE _task_instance.input_type::TEXT
        WHEN 'binary' THEN
            raw_value := CASE WHEN _checkin.boolean_value THEN 1 ELSE 0 END;
        WHEN 'numeric' THEN
            raw_value := COALESCE(_checkin.numeric_value, 0);
        WHEN 'time' THEN
            raw_value := EXTRACT(HOUR FROM _checkin.time_value::TIME) * 60 + 
                        EXTRACT(MINUTE FROM _checkin.time_value::TIME);
        WHEN 'duration' THEN
            raw_value := COALESCE(_checkin.duration_minutes, 0);
        ELSE
            raw_value := 0;
    END CASE;
    
    CASE scoring_type
        WHEN 'binary_yesno' THEN
            result_points := public.calc_score_binary_yesno(_checkin.boolean_value, config);
            result_points_before := result_points;
            result_rule := 'binary_yesno: completed=' || COALESCE(_checkin.boolean_value::TEXT, 'false');
            
        WHEN 'linear_per_unit' THEN
            SELECT lpu.points_before_cap, lpu.points_awarded
            INTO result_points_before, result_points
            FROM public.calc_score_linear_per_unit(raw_value, config) lpu;
            result_rule := 'linear_per_unit: value=' || raw_value || 
                          ', unit_size=' || COALESCE((config->>'unit_size'), '1') ||
                          ', points_per_unit=' || COALESCE((config->>'points_per_unit'), '1');
            result_derived := jsonb_build_object('raw_value', raw_value, 'unit_size', (config->>'unit_size')::NUMERIC);
            
        WHEN 'threshold' THEN
            result_points := public.calc_score_threshold(raw_value, config);
            result_points_before := result_points;
            result_rule := 'threshold: value=' || raw_value || 
                          ', threshold=' || COALESCE((config->>'threshold'), '0');
            
        WHEN 'time_before' THEN
            result_points := public.calc_score_time_before(_checkin.time_value::TIME, config);
            result_points_before := result_points;
            result_rule := 'time_before: time=' || COALESCE(_checkin.time_value, 'null') || 
                          ', target=' || COALESCE((config->>'target_time'), '22:00:00');
            
        WHEN 'time_after' THEN
            result_points := public.calc_score_time_after(_checkin.time_value::TIME, config);
            result_points_before := result_points;
            result_rule := 'time_after: time=' || COALESCE(_checkin.time_value, 'null') || 
                          ', target=' || COALESCE((config->>'target_time'), '06:00:00');
            
        WHEN 'tiered' THEN
            result_points := public.calc_score_tiered(raw_value, config);
            result_points_before := result_points;
            result_rule := 'tiered: value=' || raw_value;
            
        WHEN 'diminishing' THEN
            result_points := public.calc_score_diminishing(raw_value, config);
            result_points_before := result_points;
            result_rule := 'diminishing: value=' || raw_value;
            
        ELSE
            result_points := 0;
            result_points_before := 0;
            result_rule := 'unknown_scoring_type: ' || scoring_type;
    END CASE;
    
    RETURN QUERY SELECT result_points_before, result_points, result_rule, result_derived;
END;
$$;

-- Fix apply_powerups
CREATE OR REPLACE FUNCTION public.apply_powerups(
    _user_id UUID,
    _week_id UUID,
    _task_instance_id UUID,
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
    applied JSONB := NULL;
    result_points NUMERIC := _base_points;
BEGIN
    IF _is_binary_missed THEN
        SELECT * INTO powerup
        FROM public.powerups
        WHERE user_id = _user_id
          AND week_id = _week_id
          AND powerup_type = 'forgiveness'
          AND is_used = FALSE
          AND (task_instance_id IS NULL OR task_instance_id = _task_instance_id)
        LIMIT 1;
        
        IF FOUND THEN
            result_points := powerup.modifier_value;
            applied := jsonb_build_object('type', 'forgiveness', 'value', powerup.modifier_value);
            
            UPDATE public.powerups
            SET is_used = TRUE, used_at = now()
            WHERE id = powerup.id;
        END IF;
    END IF;
    
    SELECT * INTO powerup
    FROM public.powerups
    WHERE user_id = _user_id
      AND week_id = _week_id
      AND powerup_type = 'multiplier'
      AND is_used = FALSE
      AND (task_instance_id = _task_instance_id)
    LIMIT 1;
    
    IF FOUND THEN
        result_points := result_points * powerup.modifier_value;
        applied := COALESCE(applied, '{}'::jsonb) || 
                   jsonb_build_object('type', 'multiplier', 'value', powerup.modifier_value);
        
        UPDATE public.powerups
        SET is_used = TRUE, used_at = now()
        WHERE id = powerup.id;
    END IF;
    
    SELECT * INTO powerup
    FROM public.powerups
    WHERE user_id = _user_id
      AND week_id = _week_id
      AND powerup_type = 'flat_boost'
      AND is_used = FALSE
      AND (task_instance_id IS NULL OR task_instance_id = _task_instance_id)
    LIMIT 1;
    
    IF FOUND THEN
        result_points := result_points + powerup.modifier_value;
        applied := COALESCE(applied, '{}'::jsonb) || 
                   jsonb_build_object('type', 'flat_boost', 'value', powerup.modifier_value);
        
        UPDATE public.powerups
        SET is_used = TRUE, used_at = now()
        WHERE id = powerup.id;
    END IF;
    
    RETURN QUERY SELECT result_points, applied;
END;
$$;