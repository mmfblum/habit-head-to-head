-- =============================================================================
-- SCORING ENGINE: Comprehensive Database Trigger Implementation
-- =============================================================================
-- This migration creates a robust, extensible scoring engine that:
-- 1. Handles all scoring_type variants with explicit logic
-- 2. Supports power-ups and modifiers
-- 3. Maintains full audit trail via scoring_events
-- 4. Updates weekly_scores and season_standings in real-time
-- 5. Is idempotent (re-running for same check-in doesn't double-count)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Add powerups table for weekly modifiers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.powerups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
    task_instance_id UUID REFERENCES public.task_instances(id) ON DELETE SET NULL,
    powerup_type TEXT NOT NULL CHECK (powerup_type IN ('multiplier', 'forgiveness', 'flat_boost')),
    modifier_value NUMERIC NOT NULL DEFAULT 2,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, week_id, powerup_type)
);

ALTER TABLE public.powerups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own powerups"
    ON public.powerups FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can use their own powerups"
    ON public.powerups FOR UPDATE
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- STEP 2: Add punishments table for weekly lowest scorer
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.punishments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
    league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    punishment_type TEXT NOT NULL DEFAULT 'lowest_scorer',
    badge_name TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, week_id, punishment_type)
);

ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League members can view punishments"
    ON public.punishments FOR SELECT
    USING (public.is_league_member(auth.uid(), league_id));

-- -----------------------------------------------------------------------------
-- STEP 3: Enhance scoring_events with additional audit fields
-- -----------------------------------------------------------------------------
ALTER TABLE public.scoring_events 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS week_id UUID REFERENCES public.weeks(id),
ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES public.seasons(id),
ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id),
ADD COLUMN IF NOT EXISTS task_instance_id UUID REFERENCES public.task_instances(id),
ADD COLUMN IF NOT EXISTS powerup_applied JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT FALSE;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_scoring_events_checkin ON public.scoring_events(daily_checkin_id);
CREATE INDEX IF NOT EXISTS idx_scoring_events_user_week ON public.scoring_events(user_id, week_id);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_weekly_scores_user_week ON public.weekly_scores(user_id, week_id);

-- -----------------------------------------------------------------------------
-- STEP 4: Helper function to get the current week for a season and date
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_week_for_date(
    _season_id UUID,
    _date DATE
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.weeks
    WHERE season_id = _season_id
      AND _date >= start_date::date
      AND _date <= end_date::date
    LIMIT 1
$$;

-- -----------------------------------------------------------------------------
-- STEP 5: Scoring calculation functions for each scoring_type
-- These are pure functions that take inputs and config, return points
-- -----------------------------------------------------------------------------

-- Binary Yes/No scoring: completed = fixed points, else 0
CREATE OR REPLACE FUNCTION public.calc_score_binary_yesno(
    _boolean_value BOOLEAN,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
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

-- Linear per unit: points = (value / unit_size) * points_per_unit, with optional cap
CREATE OR REPLACE FUNCTION public.calc_score_linear_per_unit(
    _numeric_value NUMERIC,
    _config JSONB,
    OUT points_before_cap NUMERIC,
    OUT points_awarded NUMERIC
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    unit_size NUMERIC;
    points_per_unit NUMERIC;
    daily_cap NUMERIC;
BEGIN
    unit_size := COALESCE((_config->>'unit_size')::NUMERIC, 1);
    points_per_unit := COALESCE((_config->>'points_per_unit')::NUMERIC, 1);
    daily_cap := (_config->>'daily_cap')::NUMERIC;
    
    -- Prevent division by zero
    IF unit_size = 0 THEN unit_size := 1; END IF;
    
    -- Calculate raw points (fractional scoring allowed)
    points_before_cap := (_numeric_value / unit_size) * points_per_unit;
    
    -- Apply daily cap if defined
    IF daily_cap IS NOT NULL AND points_before_cap > daily_cap THEN
        points_awarded := daily_cap;
    ELSE
        points_awarded := points_before_cap;
    END IF;
END;
$$;

-- Threshold scoring: full points only if value >= threshold
CREATE OR REPLACE FUNCTION public.calc_score_threshold(
    _numeric_value NUMERIC,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
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

-- Time before scoring: points if time_value <= target_time
CREATE OR REPLACE FUNCTION public.calc_score_time_before(
    _time_value TIME,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
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

-- Time after scoring: points if time_value >= target_time
CREATE OR REPLACE FUNCTION public.calc_score_time_after(
    _time_value TIME,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
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

-- Tiered scoring: award points based on value tiers in config
CREATE OR REPLACE FUNCTION public.calc_score_tiered(
    _numeric_value NUMERIC,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
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
        -- Fallback to simple threshold
        RETURN public.calc_score_threshold(_numeric_value, _config);
    END IF;
    
    -- Find matching tier (first match wins)
    FOR tier IN SELECT * FROM jsonb_array_elements(tiers)
    LOOP
        tier_min := COALESCE((tier->>'min')::NUMERIC, 0);
        tier_max := (tier->>'max')::NUMERIC; -- can be null for unlimited
        tier_points := COALESCE((tier->>'points')::NUMERIC, 0);
        
        IF _numeric_value >= tier_min AND (tier_max IS NULL OR _numeric_value < tier_max) THEN
            result := tier_points;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$;

-- Diminishing returns scoring (bonus)
CREATE OR REPLACE FUNCTION public.calc_score_diminishing(
    _numeric_value NUMERIC,
    _config JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
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
        -- Full points up to threshold, then diminishing
        result := threshold * base_points + 
                  ((_numeric_value - threshold) * base_points * diminish_rate);
    END IF;
    
    RETURN result;
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 6: Main scoring calculation function
-- Determines scoring_type and calls appropriate calculator
-- -----------------------------------------------------------------------------
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
    
    -- Determine raw value based on input type
    CASE _task_instance.input_type::TEXT
        WHEN 'binary' THEN
            raw_value := CASE WHEN _checkin.boolean_value THEN 1 ELSE 0 END;
        WHEN 'numeric' THEN
            raw_value := COALESCE(_checkin.numeric_value, 0);
        WHEN 'time' THEN
            -- Convert time to minutes for calculations if needed
            raw_value := EXTRACT(HOUR FROM _checkin.time_value::TIME) * 60 + 
                        EXTRACT(MINUTE FROM _checkin.time_value::TIME);
        WHEN 'duration' THEN
            raw_value := COALESCE(_checkin.duration_minutes, 0);
        ELSE
            raw_value := 0;
    END CASE;
    
    -- Apply scoring logic based on type
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

-- -----------------------------------------------------------------------------
-- STEP 7: Apply power-ups to calculated score
-- -----------------------------------------------------------------------------
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
AS $$
DECLARE
    powerup RECORD;
    applied JSONB := NULL;
    result_points NUMERIC := _base_points;
BEGIN
    -- Check for forgiveness (only for missed binary tasks)
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
            -- Award base points despite missing
            result_points := powerup.modifier_value;
            applied := jsonb_build_object('type', 'forgiveness', 'value', powerup.modifier_value);
            
            UPDATE public.powerups
            SET is_used = TRUE, used_at = now()
            WHERE id = powerup.id;
        END IF;
    END IF;
    
    -- Check for multiplier
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
    
    -- Check for flat boost
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

-- -----------------------------------------------------------------------------
-- STEP 8: Update weekly scores (upsert)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_weekly_score(
    _user_id UUID,
    _week_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total NUMERIC := 0;
    tasks_done INT := 0;
    points_task JSONB := '{}'::jsonb;
    checkin RECORD;
    week RECORD;
BEGIN
    -- Get week info
    SELECT * INTO week FROM public.weeks WHERE id = _week_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    -- Aggregate all scoring events for this user/week
    SELECT 
        COALESCE(SUM(se.points_awarded), 0),
        COUNT(DISTINCT se.task_instance_id)
    INTO total, tasks_done
    FROM public.scoring_events se
    WHERE se.user_id = _user_id 
      AND se.week_id = _week_id
      AND se.is_reversed = FALSE;
    
    -- Build points by task breakdown
    SELECT jsonb_object_agg(task_instance_id::TEXT, task_points)
    INTO points_task
    FROM (
        SELECT task_instance_id, SUM(points_awarded) as task_points
        FROM public.scoring_events
        WHERE user_id = _user_id AND week_id = _week_id AND is_reversed = FALSE
        GROUP BY task_instance_id
    ) t;
    
    -- Upsert weekly score
    INSERT INTO public.weekly_scores (user_id, week_id, total_points, tasks_completed, points_by_task)
    VALUES (_user_id, _week_id, total, tasks_done, COALESCE(points_task, '{}'::jsonb))
    ON CONFLICT (user_id, week_id) 
    DO UPDATE SET 
        total_points = EXCLUDED.total_points,
        tasks_completed = EXCLUDED.tasks_completed,
        points_by_task = EXCLUDED.points_by_task,
        updated_at = now();
END;
$$;

-- Create unique constraint on weekly_scores if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'weekly_scores_user_week_unique'
    ) THEN
        ALTER TABLE public.weekly_scores ADD CONSTRAINT weekly_scores_user_week_unique UNIQUE (user_id, week_id);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 9: Update season standings
-- -----------------------------------------------------------------------------
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
BEGIN
    -- Calculate total points from weekly scores
    SELECT COALESCE(SUM(ws.total_points), 0),
           COALESCE(MAX(ws.total_points), 0),
           COALESCE(MIN(ws.total_points), 0)
    INTO total_pts, high_weekly, low_weekly
    FROM public.weekly_scores ws
    JOIN public.weeks w ON w.id = ws.week_id
    WHERE ws.user_id = _user_id AND w.season_id = _season_id;
    
    -- Calculate matchup record
    SELECT 
        COUNT(*) FILTER (WHERE winner_id = _user_id),
        COUNT(*) FILTER (WHERE winner_id IS NOT NULL AND winner_id != _user_id AND 
                        (user1_id = _user_id OR user2_id = _user_id)),
        COUNT(*) FILTER (WHERE winner_id IS NULL AND status = 'completed')
    INTO wins_count, losses_count, ties_count
    FROM public.matchups m
    JOIN public.weeks w ON w.id = m.week_id
    WHERE w.season_id = _season_id AND (m.user1_id = _user_id OR m.user2_id = _user_id);
    
    -- Calculate points for/against from matchups
    SELECT 
        COALESCE(SUM(CASE WHEN user1_id = _user_id THEN user1_score ELSE user2_score END), 0),
        COALESCE(SUM(CASE WHEN user1_id = _user_id THEN user2_score ELSE user1_score END), 0)
    INTO pts_for, pts_against
    FROM public.matchups m
    JOIN public.weeks w ON w.id = m.week_id
    WHERE w.season_id = _season_id AND (m.user1_id = _user_id OR m.user2_id = _user_id);
    
    -- Upsert season standing
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
END;
$$;

-- Create unique constraint on season_standings if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'season_standings_user_season_unique'
    ) THEN
        ALTER TABLE public.season_standings ADD CONSTRAINT season_standings_user_season_unique UNIQUE (user_id, season_id);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 10: Main scoring trigger function
-- Handles INSERT and UPDATE on daily_checkins
-- Idempotent: reverses prior scoring before recalculating
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_checkin_scoring()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    task_inst RECORD;
    season RECORD;
    week_id UUID;
    league_id UUID;
    score_result RECORD;
    powerup_result RECORD;
    final_points NUMERIC;
    is_binary_missed BOOLEAN := FALSE;
    raw_val NUMERIC;
BEGIN
    -- Get task instance details
    SELECT * INTO task_inst
    FROM public.task_instances
    WHERE id = NEW.task_instance_id;
    
    IF NOT FOUND THEN
        RAISE WARNING 'Task instance not found: %', NEW.task_instance_id;
        RETURN NEW;
    END IF;
    
    -- Get season and league
    SELECT s.*, l.id as league_id INTO season
    FROM public.seasons s
    JOIN public.leagues l ON l.id = s.league_id
    WHERE s.id = task_inst.season_id;
    
    IF NOT FOUND THEN
        RAISE WARNING 'Season not found for task instance: %', task_inst.season_id;
        RETURN NEW;
    END IF;
    
    league_id := season.league_id;
    
    -- Get the week for this check-in date
    week_id := public.get_week_for_date(task_inst.season_id, NEW.checkin_date::DATE);
    
    IF week_id IS NULL THEN
        RAISE WARNING 'No week found for season % and date %', task_inst.season_id, NEW.checkin_date;
        RETURN NEW;
    END IF;
    
    -- IDEMPOTENCY: Mark any existing scoring events for this checkin as reversed
    UPDATE public.scoring_events
    SET is_reversed = TRUE
    WHERE daily_checkin_id = NEW.id AND is_reversed = FALSE;
    
    -- Calculate score
    SELECT * INTO score_result
    FROM public.calculate_checkin_score(NEW, task_inst);
    
    -- Determine raw value for audit
    CASE task_inst.input_type::TEXT
        WHEN 'binary' THEN raw_val := CASE WHEN NEW.boolean_value THEN 1 ELSE 0 END;
        WHEN 'numeric' THEN raw_val := COALESCE(NEW.numeric_value, 0);
        WHEN 'time' THEN raw_val := EXTRACT(HOUR FROM NEW.time_value::TIME) * 60 + EXTRACT(MINUTE FROM NEW.time_value::TIME);
        WHEN 'duration' THEN raw_val := COALESCE(NEW.duration_minutes, 0);
        ELSE raw_val := 0;
    END CASE;
    
    -- Check if this is a missed binary task (for forgiveness power-up)
    IF task_inst.scoring_type::TEXT = 'binary_yesno' AND (NEW.boolean_value IS NULL OR NEW.boolean_value = FALSE) THEN
        is_binary_missed := TRUE;
    END IF;
    
    -- Apply power-ups
    SELECT * INTO powerup_result
    FROM public.apply_powerups(NEW.user_id, week_id, task_inst.id, score_result.points_awarded, is_binary_missed);
    
    final_points := powerup_result.final_points;
    
    -- Create scoring event (audit record)
    INSERT INTO public.scoring_events (
        daily_checkin_id,
        user_id,
        week_id,
        season_id,
        league_id,
        task_instance_id,
        scoring_type,
        raw_value,
        points_before_cap,
        points_awarded,
        rule_applied,
        config_snapshot,
        derived_values,
        powerup_applied,
        is_reversed
    ) VALUES (
        NEW.id,
        NEW.user_id,
        week_id,
        task_inst.season_id,
        league_id,
        task_inst.id,
        task_inst.scoring_type,
        raw_val,
        score_result.points_before_cap,
        final_points,
        score_result.rule_applied,
        task_inst.config,
        score_result.derived_values,
        powerup_result.powerup_applied,
        FALSE
    );
    
    -- Update weekly scores
    PERFORM public.update_weekly_score(NEW.user_id, week_id);
    
    -- Update season standings
    PERFORM public.update_season_standing(NEW.user_id, task_inst.season_id);
    
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 11: Create the trigger on daily_checkins
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_checkin_scoring ON public.daily_checkins;

CREATE TRIGGER trigger_checkin_scoring
AFTER INSERT OR UPDATE ON public.daily_checkins
FOR EACH ROW
EXECUTE FUNCTION public.process_checkin_scoring();

-- -----------------------------------------------------------------------------
-- STEP 12: Weekly punishment assignment function (to be called by cron/edge function)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_weekly_punishments(_week_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    week RECORD;
    lowest_scorer RECORD;
    league_id UUID;
    punishments_assigned INT := 0;
BEGIN
    -- Get week details
    SELECT w.*, s.league_id INTO week
    FROM public.weeks w
    JOIN public.seasons s ON s.id = w.season_id
    WHERE w.id = _week_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    league_id := week.league_id;
    
    -- Find lowest scorer for this week in the league
    SELECT ws.user_id, ws.total_points INTO lowest_scorer
    FROM public.weekly_scores ws
    WHERE ws.week_id = _week_id
    ORDER BY ws.total_points ASC
    LIMIT 1;
    
    IF FOUND THEN
        -- Insert punishment (ignore if already exists)
        INSERT INTO public.punishments (user_id, week_id, league_id, punishment_type, badge_name)
        VALUES (lowest_scorer.user_id, _week_id, league_id, 'lowest_scorer', 'Slacker of the Week')
        ON CONFLICT (user_id, week_id, punishment_type) DO NOTHING;
        
        punishments_assigned := 1;
    END IF;
    
    RETURN punishments_assigned;
END;
$$;

-- -----------------------------------------------------------------------------
-- COMMENTS: HOW TO ADD NEW TASK TEMPLATES
-- -----------------------------------------------------------------------------
-- To add new default task templates WITHOUT changing this scoring engine:
-- 
-- 1. INSERT into task_templates with appropriate:
--    - scoring_type: one of the supported types (binary_yesno, linear_per_unit, etc.)
--    - input_type: binary, numeric, time, or duration
--    - default_config: JSON with type-specific parameters
--
-- Example configs by scoring_type:
--
-- binary_yesno:
--   {"points_per_completion": 10}
--
-- linear_per_unit (e.g., steps):
--   {"unit_size": 1000, "points_per_unit": 1, "daily_cap": 15}
--
-- linear_per_unit (e.g., reading pages):
--   {"unit_size": 10, "points_per_unit": 2, "daily_cap": 20}
--
-- threshold (e.g., water intake):
--   {"threshold": 64, "points_for_threshold": 10}
--
-- time_before (e.g., bedtime):
--   {"target_time": "22:30:00", "points_for_success": 10}
--
-- time_after (e.g., wake time):
--   {"target_time": "06:00:00", "points_for_success": 10}
--
-- tiered (e.g., workout minutes):
--   {"tiers": [
--     {"min": 0, "max": 15, "points": 2},
--     {"min": 15, "max": 30, "points": 5},
--     {"min": 30, "max": 60, "points": 10},
--     {"min": 60, "max": null, "points": 15}
--   ]}
--
-- League admins can override any config values via league_task_configs.config_overrides
-- which merges with the template's default_config at runtime.
-- -----------------------------------------------------------------------------