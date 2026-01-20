-- =============================================================================
-- VERIFICATION LAYER FOR TASK TEMPLATES
-- =============================================================================
-- This migration adds verification requirements to task templates and creates
-- a check_verification function to validate check-ins before scoring.
--
-- RELIABILITY RULES:
-- 1. Each task has a verification_method: manual_action, auto_import, timer_based
-- 2. Check-ins must have proper metadata to be scored
-- 3. Admin overrides bypass verification requirements
-- 4. Verification runs BEFORE scoring to prevent abuse
-- =============================================================================

-- Update task_templates with verification configurations
-- Each template gets a verification_config JSONB field in default_config

-- 1) Daily Steps - Connected source preferred, manual allowed with flag
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'auto_import',
    'allowed_sources', ARRAY['apple_health', 'google_fit', 'manual'],
    'requires_confirmation', false,
    'manual_requires_flag', true,
    'confirmation_action', null,
    'description', 'Auto-imported from health apps. Manual entry is flagged for review.'
  )
)
WHERE name = 'Daily Steps';

-- 2) Workout - Requires explicit confirmation after entry
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'manual_action',
    'allowed_sources', ARRAY['manual', 'whoop', 'apple_health'],
    'requires_confirmation', true,
    'manual_requires_flag', false,
    'confirmation_action', 'complete_workout',
    'description', 'Press Complete Workout after entering duration.'
  )
)
WHERE name = 'Workout';

-- 3) Pushups - Manual entry with confirmation
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'manual_action',
    'allowed_sources', ARRAY['manual'],
    'requires_confirmation', true,
    'manual_requires_flag', false,
    'confirmation_action', 'complete_pushups',
    'description', 'Enter count and press Complete Pushups to confirm.'
  )
)
WHERE name = 'Pushups';

-- 4) Reading - Requires confirmation after entering minutes/pages
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'manual_action',
    'allowed_sources', ARRAY['manual'],
    'requires_confirmation', true,
    'manual_requires_flag', false,
    'confirmation_action', 'finish_reading',
    'description', 'Enter time and press Finished Reading to confirm.'
  )
)
WHERE name = 'Reading';

-- 5) Skill Practice / Learning Time - Requires confirmation
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'manual_action',
    'allowed_sources', ARRAY['manual'],
    'requires_confirmation', true,
    'manual_requires_flag', false,
    'confirmation_action', 'complete_practice',
    'description', 'Enter duration and press Practice Completed to confirm.'
  )
)
WHERE name IN ('Skill Practice', 'Learning Time');

-- 6) Screen Time Control - Auto-import ONLY
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'auto_import',
    'allowed_sources', ARRAY['screen_time'],
    'requires_confirmation', false,
    'manual_requires_flag', false,
    'confirmation_action', null,
    'auto_import_only', true,
    'description', 'Automatically imported from Screen Time API. Manual entry not allowed.'
  )
)
WHERE name = 'Screen Time';

-- 7) Journaling (Duration) - Timer-based or manual confirmation
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'timer_based',
    'allowed_sources', ARRAY['manual', 'timer'],
    'requires_confirmation', true,
    'manual_requires_flag', false,
    'confirmation_action', 'complete_journaling',
    'min_duration_seconds', 300,
    'description', 'Use built-in timer or enter duration and confirm.'
  )
)
WHERE name = 'Journaling' AND input_type = 'duration';

-- 8) Journaling (Binary) - Simple confirmation
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'manual_action',
    'allowed_sources', ARRAY['manual'],
    'requires_confirmation', true,
    'manual_requires_flag', false,
    'confirmation_action', 'complete_journaling',
    'description', 'Toggle and confirm to complete.'
  )
)
WHERE name = 'Journaling' AND input_type = 'binary';

-- 9) Meditation - Timer preferred, manual allowed
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'timer_based',
    'allowed_sources', ARRAY['manual', 'timer', 'apple_health'],
    'requires_confirmation', true,
    'manual_requires_flag', false,
    'confirmation_action', 'complete_meditation',
    'min_duration_seconds', 60,
    'description', 'Use timer or enter duration and confirm.'
  )
)
WHERE name = 'Meditation';

-- 10) Bedtime - Button press captures timestamp
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'manual_action',
    'allowed_sources', ARRAY['manual'],
    'requires_confirmation', true,
    'manual_requires_flag', false,
    'confirmation_action', 'going_to_bed',
    'captures_timestamp', true,
    'description', 'Press Going to Bed button to record your bedtime.'
  )
)
WHERE name = 'Bedtime';

-- 11) Wake Time - Button press captures timestamp
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'manual_action',
    'allowed_sources', ARRAY['manual'],
    'requires_confirmation', true,
    'manual_requires_flag', false,
    'confirmation_action', 'im_awake',
    'captures_timestamp', true,
    'description', 'Press I Am Awake button to record your wake time.'
  )
)
WHERE name = 'Wake Time';

-- 12) Active Minutes - Connected source or manual with flag
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'auto_import',
    'allowed_sources', ARRAY['apple_health', 'google_fit', 'whoop', 'manual'],
    'requires_confirmation', false,
    'manual_requires_flag', true,
    'confirmation_action', null,
    'description', 'Auto-imported from fitness trackers. Manual entry is flagged.'
  )
)
WHERE name = 'Active Minutes';

-- 13) Water Intake - Manual with confirmation
UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object(
  'verification', jsonb_build_object(
    'method', 'manual_action',
    'allowed_sources', ARRAY['manual'],
    'requires_confirmation', true,
    'manual_requires_flag', false,
    'confirmation_action', 'log_water',
    'description', 'Enter glasses and confirm to log.'
  )
)
WHERE name = 'Water Intake';

-- =============================================================================
-- VERIFICATION CHECK FUNCTION
-- =============================================================================
-- This function validates check-in metadata before scoring.
-- Returns TRUE if check-in should be scored, FALSE otherwise.
--
-- Verification logic:
-- 1. If admin_override = true in metadata, always allow
-- 2. If requires_confirmation = true, check for confirmed = true
-- 3. If auto_import_only = true, check source is not manual
-- 4. Otherwise, allow the check-in
-- =============================================================================

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
    -- Get verification config from task instance config
    verification_config := (_task_instance.config->>'verification')::JSONB;
    
    -- If no verification config, allow (backwards compatibility)
    IF verification_config IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Get check-in metadata
    metadata := COALESCE(_checkin.metadata, '{}'::JSONB);
    
    -- ADMIN OVERRIDE: Always allow if admin has overridden
    -- This prevents abuse disputes from blocking legitimate entries
    IF (metadata->>'admin_override')::BOOLEAN = TRUE THEN
        RETURN TRUE;
    END IF;
    
    -- CHECK: Auto-import only tasks (e.g., Screen Time)
    -- These cannot be manually entered to prevent gaming
    auto_import_only := COALESCE((verification_config->>'auto_import_only')::BOOLEAN, FALSE);
    source := COALESCE(metadata->>'source', 'manual');
    
    IF auto_import_only AND source = 'manual' THEN
        RETURN FALSE;
    END IF;
    
    -- CHECK: Requires confirmation
    -- Tasks that need explicit user confirmation must have confirmed = true
    requires_confirmation := COALESCE((verification_config->>'requires_confirmation')::BOOLEAN, FALSE);
    
    IF requires_confirmation THEN
        IF (metadata->>'confirmed')::BOOLEAN IS NOT TRUE THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- All checks passed
    RETURN TRUE;
END;
$$;

-- =============================================================================
-- UPDATE SCORING TRIGGER TO CHECK VERIFICATION
-- =============================================================================
-- Modify the existing trigger to check verification before scoring.
-- Unverified check-ins are saved but receive 0 points.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.on_checkin_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    task_inst RECORD;
    score_result RECORD;
    week_id UUID;
    season RECORD;
    league_id UUID;
    raw_val NUMERIC;
    final_points NUMERIC;
    powerup_result RECORD;
    is_binary_missed BOOLEAN := FALSE;
    is_verified BOOLEAN;
BEGIN
    -- Get the task instance
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
    
    -- =============================================================================
    -- VERIFICATION CHECK
    -- =============================================================================
    -- Check if the check-in meets verification requirements.
    -- Unverified check-ins receive 0 points but are still recorded for audit.
    -- This prevents abuse by requiring explicit confirmation or valid data sources.
    -- =============================================================================
    is_verified := public.is_checkin_verified(NEW, task_inst);
    
    IF NOT is_verified THEN
        -- Log unverified check-in with 0 points
        raw_val := 0;
        CASE task_inst.input_type::TEXT
            WHEN 'binary' THEN raw_val := CASE WHEN NEW.boolean_value THEN 1 ELSE 0 END;
            WHEN 'numeric' THEN raw_val := COALESCE(NEW.numeric_value, 0);
            WHEN 'time' THEN raw_val := EXTRACT(HOUR FROM NEW.time_value::TIME) * 60 + EXTRACT(MINUTE FROM NEW.time_value::TIME);
            WHEN 'duration' THEN raw_val := COALESCE(NEW.duration_minutes, 0);
            ELSE raw_val := 0;
        END CASE;
        
        INSERT INTO public.scoring_events (
            daily_checkin_id, user_id, week_id, season_id, league_id,
            task_instance_id, scoring_type, raw_value,
            points_before_cap, points_awarded, rule_applied,
            config_snapshot, derived_values, is_reversed
        ) VALUES (
            NEW.id, NEW.user_id, week_id, season.id, league_id,
            task_inst.id, task_inst.scoring_type, raw_val,
            0, 0, 'unverified_checkin',
            task_inst.config,
            jsonb_build_object('verification_failed', true, 'metadata', NEW.metadata),
            FALSE
        );
        
        RETURN NEW;
    END IF;
    
    -- Calculate score (only for verified check-ins)
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
        daily_checkin_id, user_id, week_id, season_id, league_id,
        task_instance_id, scoring_type, raw_value,
        points_before_cap, points_awarded, rule_applied,
        config_snapshot, derived_values, powerup_applied, is_reversed
    ) VALUES (
        NEW.id, NEW.user_id, week_id, season.id, league_id,
        task_inst.id, task_inst.scoring_type, raw_val,
        score_result.points_before_cap, final_points, score_result.rule_applied,
        task_inst.config, score_result.derived_values, powerup_result.powerup_applied,
        FALSE
    );
    
    -- Update weekly_scores
    INSERT INTO public.weekly_scores (user_id, week_id, total_points, tasks_completed)
    VALUES (NEW.user_id, week_id, final_points, 1)
    ON CONFLICT (user_id, week_id) DO UPDATE
    SET total_points = weekly_scores.total_points + EXCLUDED.total_points,
        tasks_completed = weekly_scores.tasks_completed + 1,
        updated_at = NOW();
    
    -- Update matchup scores
    UPDATE public.matchups
    SET user1_score = user1_score + final_points
    WHERE week_id = week_id AND user1_id = NEW.user_id;
    
    UPDATE public.matchups
    SET user2_score = user2_score + final_points
    WHERE week_id = week_id AND user2_id = NEW.user_id;
    
    RETURN NEW;
END;
$$;

-- Add comment explaining the verification system
COMMENT ON FUNCTION public.is_checkin_verified IS 
'Validates check-in metadata before scoring. Returns TRUE if check-in should be scored.
Verification rules:
1. Admin override always allows scoring
2. Auto-import-only tasks reject manual entries
3. Confirmation-required tasks need confirmed=true in metadata
This prevents gaming and improves data integrity.';

COMMENT ON FUNCTION public.on_checkin_score IS 
'Trigger function for scoring check-ins. Now includes verification check.
Unverified check-ins receive 0 points but are recorded for audit.';