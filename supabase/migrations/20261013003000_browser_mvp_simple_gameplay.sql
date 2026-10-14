-- Browser-first MVP gameplay.
-- Every playable daily task is manual, goal-based, and worth exactly 1 point.

CREATE OR REPLACE FUNCTION public.zrizin_manual_verification()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'method', 'manual_action',
    'allowed_sources', jsonb_build_array('manual'),
    'requires_confirmation', false,
    'manual_requires_flag', false,
    'auto_import_only', false
  );
$$;

UPDATE public.task_templates
SET
  supports_integration = false,
  allowed_data_sources = ARRAY['manual']::text[]
WHERE is_active = true;

UPDATE public.task_templates
SET description = 'Do 30 pushups today. Enter the exact number if you want.',
    default_config = jsonb_build_object(
      'target', 30, 'unit_size', 1, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Pushups';

UPDATE public.task_templates
SET description = 'Run or walk intentionally for 20 minutes.',
    default_config = jsonb_build_object(
      'threshold', 20, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Run / Walk';

UPDATE public.task_templates
SET description = 'Reach 10,000 steps today. Enter your total manually.',
    default_config = jsonb_build_object(
      'target', 10000, 'unit_size', 1000, 'scoring_mode', 'binary', 'binary_points', 1,
      'prefer_exact_entry', true, 'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Steps';

UPDATE public.task_templates
SET description = 'Stretch or do mobility work for 10 minutes.',
    default_config = jsonb_build_object(
      'threshold', 10, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Stretching';

UPDATE public.task_templates
SET description = 'Complete 30 minutes of intentional exercise.',
    default_config = jsonb_build_object(
      'threshold', 30, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Workout';

UPDATE public.task_templates
SET description = 'Spend 20 minutes outside.',
    default_config = jsonb_build_object(
      'threshold', 20, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Outside Time';

UPDATE public.task_templates
SET description = 'Spend 30 focused minutes learning something.',
    default_config = jsonb_build_object(
      'target', 30, 'unit_size', 5, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Learning Time';

UPDATE public.task_templates
SET description = 'Read 20 pages.',
    default_config = jsonb_build_object(
      'target', 20, 'unit_size', 1, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Reading';

UPDATE public.task_templates
SET description = 'Practice a skill for 20 minutes.',
    default_config = jsonb_build_object(
      'target', 20, 'unit_size', 5, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Skill Practice';

UPDATE public.task_templates
SET description = 'Try, learn, build, visit, or do one new thing today.',
    default_config = jsonb_build_object(
      'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Something New';

UPDATE public.task_templates
SET description = 'Complete one focused 45-minute block without distractions.',
    default_config = jsonb_build_object(
      'threshold', 45, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Deep Work';

UPDATE public.task_templates
SET description = 'Keep total screen time at or under 2 hours. Enter your total manually.',
    default_config = jsonb_build_object(
      'daily_limit_minutes', 120, 'target', 120, 'unit_size', 15,
      'scoring_mode', 'binary', 'binary_points', 1, 'prefer_exact_entry', true,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Screen Time';

UPDATE public.task_templates
SET description = 'Be in bed by 11:00 PM.',
    default_config = jsonb_build_object(
      'target_time', '23:00', 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Bedtime';

UPDATE public.task_templates
SET description = 'Get at least 7 hours of sleep. Enter your total manually.',
    default_config = jsonb_build_object(
      'threshold', 7, 'unit_size', 0.5, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Sleep Duration';

UPDATE public.task_templates
SET description = 'Be up by 6:30 AM.',
    default_config = jsonb_build_object(
      'target_time', '06:30', 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Wake Time';

UPDATE public.task_templates
SET description = 'Finish the day without junk food.',
    default_config = jsonb_build_object(
      'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Healthy Eating';

UPDATE public.task_templates
SET description = 'Finish eating by 8:00 PM and keep the kitchen closed for the night.',
    default_config = jsonb_build_object(
      'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Stopped Eating After 8 PM';

UPDATE public.task_templates
SET description = 'Drink 8 glasses of water.',
    default_config = jsonb_build_object(
      'threshold', 8, 'unit_size', 1, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Water Intake';

UPDATE public.task_templates
SET description = 'Write something in your journal today.',
    default_config = jsonb_build_object(
      'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Journaling';

UPDATE public.task_templates
SET description = 'Meditate or practice mindfulness for 10 minutes.',
    default_config = jsonb_build_object(
      'threshold', 10, 'unit_size', 5, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Meditation';

UPDATE public.task_templates
SET description = 'Spend 20 intentional minutes with family or friends.',
    default_config = jsonb_build_object(
      'threshold', 20, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Connection Time';

UPDATE public.task_templates
SET default_config = jsonb_build_object(
      'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Custom Challenge — Checkoff';

UPDATE public.task_templates
SET default_config = jsonb_build_object(
      'threshold', 1, 'unit_size', 1, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Custom Challenge — Count';

UPDATE public.task_templates
SET default_config = jsonb_build_object(
      'threshold', 20, 'unit_size', 5, 'scoring_mode', 'binary', 'binary_points', 1,
      'verification', public.zrizin_manual_verification()
    )
WHERE name = 'Custom Challenge — Minutes';

-- Any league task configured in this MVP is normalized to equal-weight scoring.
CREATE OR REPLACE FUNCTION public.normalize_solo_task_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.config_overrides :=
    COALESCE(NEW.config_overrides, '{}'::jsonb)
    || jsonb_build_object('scoring_mode', 'binary', 'binary_points', 1);
  NEW.max_daily_points := 1;
  RETURN NEW;
END;
$function$;

UPDATE public.league_task_configs
SET config_overrides =
      COALESCE(config_overrides, '{}'::jsonb)
      || jsonb_build_object('scoring_mode', 'binary', 'binary_points', 1),
    max_daily_points = 1;

UPDATE public.task_instances
SET config =
      COALESCE(config, '{}'::jsonb)
      || jsonb_build_object('scoring_mode', 'binary', 'binary_points', 1, 'max_daily_points', 1);

CREATE OR REPLACE FUNCTION public.calc_score_binary_yesno(_boolean_value boolean, _config jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
    completion_points NUMERIC;
BEGIN
    completion_points := COALESCE(
        (_config->>'points_per_completion')::NUMERIC,
        (_config->>'points')::NUMERIC,
        (_config->>'binary_points')::NUMERIC,
        1
    );
    RETURN CASE WHEN _boolean_value = TRUE THEN completion_points ELSE 0 END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_checkin_score(_checkin daily_checkins, _task_instance task_instances)
RETURNS TABLE(points_before_cap numeric, points_awarded numeric, rule_applied text, derived_values jsonb)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
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
  scoring_mode := COALESCE(config->>'scoring_mode', 'binary');
  CASE input_type
    WHEN 'binary' THEN raw_value := CASE WHEN _checkin.boolean_value THEN 1 ELSE 0 END;
    WHEN 'numeric' THEN raw_value := COALESCE(_checkin.numeric_value, 0);
    WHEN 'time' THEN
      IF _checkin.time_value IS NOT NULL THEN
        raw_value := EXTRACT(HOUR FROM _checkin.time_value::TIME) * 60 + EXTRACT(MINUTE FROM _checkin.time_value::TIME);
      END IF;
    WHEN 'duration' THEN raw_value := COALESCE(_checkin.duration_minutes, 0);
    ELSE raw_value := 0;
  END CASE;

  IF scoring_mode = 'binary' THEN
    binary_points := COALESCE((config->>'binary_points')::NUMERIC, (config->>'points')::NUMERIC, 1);
    CASE input_type
      WHEN 'binary' THEN success := COALESCE(_checkin.boolean_value, FALSE);
      WHEN 'time' THEN
        IF _checkin.time_value IS NULL THEN success := FALSE;
        ELSIF scoring_type = 'time_after' THEN
          success := _checkin.time_value::TIME >= COALESCE((config->>'target_time')::TIME, '06:00'::TIME);
        ELSE
          success := public.time_meets_before_target(
            _checkin.time_value::TIME,
            COALESCE((config->>'target_time')::TIME, '23:59'::TIME)
          );
        END IF;
      ELSE
        IF config ? 'daily_limit_minutes' THEN
          target_value := (config->>'daily_limit_minutes')::NUMERIC;
          success := raw_value <= target_value;
        ELSE
          target_value := COALESCE((config->>'target')::NUMERIC, (config->>'threshold')::NUMERIC, 1);
          success := raw_value >= target_value;
        END IF;
    END CASE;

    result_points := CASE WHEN success THEN LEAST(binary_points, 1) ELSE 0 END;
    result_before := result_points;
    result_rule := 'simple_goal: success=' || success::TEXT;
    result_derived := jsonb_build_object(
      'scoring_mode','binary',
      'raw_value',raw_value,
      'target',target_value,
      'binary_points',1
    );
    RETURN QUERY SELECT result_before, result_points, result_rule, result_derived;
    RETURN;
  END IF;

  -- Legacy detailed configs are intentionally capped to the same one-point game.
  result_points := 0;
  result_before := 0;
  result_rule := 'simple_goal: unsupported_legacy_mode';
  result_derived := jsonb_build_object('scoring_mode', scoring_mode, 'raw_value', raw_value);
  RETURN QUERY SELECT result_before, result_points, result_rule, result_derived;
END;
$function$;

-- Weekly "tasks completed" should mean successful goals, not merely logged rows.
CREATE OR REPLACE FUNCTION public.update_weekly_score(_user_id uuid, _week_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    total NUMERIC := 0;
    tasks_done INT := 0;
    points_task JSONB := '{}'::jsonb;
BEGIN
    SELECT
        COALESCE(SUM(se.points_awarded), 0),
        COUNT(DISTINCT se.task_instance_id) FILTER (WHERE se.points_awarded > 0)
    INTO total, tasks_done
    FROM public.scoring_events se
    WHERE se.user_id = _user_id
      AND se.week_id = _week_id
      AND se.is_reversed = FALSE;

    SELECT jsonb_object_agg(task_instance_id::TEXT, task_points)
    INTO points_task
    FROM (
        SELECT task_instance_id, SUM(points_awarded) as task_points
        FROM public.scoring_events
        WHERE user_id = _user_id AND week_id = _week_id AND is_reversed = FALSE
        GROUP BY task_instance_id
    ) t;

    INSERT INTO public.weekly_scores (user_id, week_id, total_points, tasks_completed, points_by_task)
    VALUES (_user_id, _week_id, total, tasks_done, COALESCE(points_task, '{}'::jsonb))
    ON CONFLICT (user_id, week_id)
    DO UPDATE SET
        total_points = EXCLUDED.total_points,
        tasks_completed = EXCLUDED.tasks_completed,
        points_by_task = EXCLUDED.points_by_task,
        updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.zrizin_manual_verification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_solo_task_config() FROM PUBLIC, anon, authenticated;
