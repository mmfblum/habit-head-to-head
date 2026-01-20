-- =====================================================
-- DEFAULT TASK TEMPLATES SEED MIGRATION
-- =====================================================
-- This migration adds integration support columns and seeds
-- the initial 10 default task templates for the productivity league.
--
-- HOW TO ADD NEW DEFAULT TASK TEMPLATES:
-- -----------------------------------------------------
-- 1. Insert a new row into task_templates with:
--    - Unique name and description
--    - Appropriate category from task_category enum
--    - input_type matching how users will log the task
--    - unit matching the measurement type
--    - scoring_type matching one of the supported scoring algorithms
--    - default_config JSONB with scoring parameters
--    - is_active = true to make it available
--
-- 2. The scoring engine will automatically handle the new template
--    based on its scoring_type - NO CODE CHANGES REQUIRED.
--
-- 3. League admins can then select this template via league_task_configs
--    and optionally override default_config values.
-- =====================================================

-- Add integration support columns to task_templates
ALTER TABLE public.task_templates 
ADD COLUMN IF NOT EXISTS supports_integration BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.task_templates 
ADD COLUMN IF NOT EXISTS allowed_data_sources TEXT[] NOT NULL DEFAULT ARRAY['manual']::TEXT[];

-- Add index for filtering by category and active status
CREATE INDEX IF NOT EXISTS idx_task_templates_category_active 
ON public.task_templates(category, is_active);

-- =====================================================
-- SEED DEFAULT TASK TEMPLATES
-- =====================================================

-- 1) Steps (Connected)
-- Category: fitness (Physical)
-- Scoring: linear_per_unit - 1 point per 1000 steps, max 10 points/day
INSERT INTO public.task_templates (
  name, description, category, input_type, unit, scoring_type,
  default_config, supports_integration, allowed_data_sources,
  icon, is_active, is_premium
) VALUES (
  'Steps',
  'Track your daily step count. Connect to Apple Health or Google Fit for automatic tracking, or log manually.',
  'fitness',
  'numeric',
  'steps',
  'linear_per_unit',
  '{
    "points_per_unit": 1,
    "unit_size": 1000,
    "daily_cap": 10
  }'::jsonb,
  true,
  ARRAY['manual', 'apple_health', 'google_fit'],
  'footprints',
  true,
  false
);

-- 2) Workout (Minutes)
-- Category: fitness (Physical)
-- Scoring: threshold - must hit minimum minutes to earn points
INSERT INTO public.task_templates (
  name, description, category, input_type, unit, scoring_type,
  default_config, supports_integration, allowed_data_sources,
  icon, is_active, is_premium
) VALUES (
  'Workout',
  'Log your workout duration. Earn points by hitting your minimum workout time goal.',
  'fitness',
  'duration',
  'minutes',
  'threshold',
  '{
    "threshold": 30,
    "points_for_threshold": 5,
    "mode": "minutes"
  }'::jsonb,
  true,
  ARRAY['manual', 'apple_health', 'google_fit', 'whoop'],
  'dumbbell',
  true,
  false
);

-- 3) Pushups
-- Category: fitness (Physical)
-- Scoring: linear_per_unit - 0.1 points per rep, max 5 points/day
INSERT INTO public.task_templates (
  name, description, category, input_type, unit, scoring_type,
  default_config, supports_integration, allowed_data_sources,
  icon, is_active, is_premium
) VALUES (
  'Pushups',
  'Track your daily pushup count. Build strength and earn points for every rep.',
  'fitness',
  'numeric',
  'count',
  'linear_per_unit',
  '{
    "points_per_unit": 0.1,
    "unit_size": 1,
    "daily_cap": 5
  }'::jsonb,
  false,
  ARRAY['manual'],
  'chevrons-up',
  true,
  false
);

-- 4) Reading
-- Category: learning (Focus)
-- Scoring: threshold - must hit minimum time/pages to earn points
INSERT INTO public.task_templates (
  name, description, category, input_type, unit, scoring_type,
  default_config, supports_integration, allowed_data_sources,
  icon, is_active, is_premium
) VALUES (
  'Reading',
  'Track time spent reading books or articles. Hit your daily reading goal to earn points.',
  'learning',
  'duration',
  'minutes',
  'threshold',
  '{
    "threshold": 20,
    "points_for_threshold": 4,
    "mode": "minutes",
    "alternate_unit": "pages",
    "alternate_threshold": 10
  }'::jsonb,
  false,
  ARRAY['manual'],
  'book-open',
  true,
  false
);

-- 5) Skill Practice
-- Category: learning (Focus)
-- Scoring: linear_per_unit - 0.2 points per 5 minutes, max 6 points/day
INSERT INTO public.task_templates (
  name, description, category, input_type, unit, scoring_type,
  default_config, supports_integration, allowed_data_sources,
  icon, is_active, is_premium
) VALUES (
  'Skill Practice',
  'Practice a skill you are developing - music, language, coding, art, etc.',
  'learning',
  'duration',
  'minutes',
  'linear_per_unit',
  '{
    "points_per_unit": 0.2,
    "unit_size": 5,
    "daily_cap": 6
  }'::jsonb,
  false,
  ARRAY['manual'],
  'target',
  true,
  false
);

-- 6) Screen Time Control
-- Category: productivity (Digital Discipline)
-- Scoring: tiered - earn points for staying under limit, lose points for going over
INSERT INTO public.task_templates (
  name, description, category, input_type, unit, scoring_type,
  default_config, supports_integration, allowed_data_sources,
  icon, is_active, is_premium
) VALUES (
  'Screen Time',
  'Track your daily screen time. Stay under your limit to earn points.',
  'productivity',
  'numeric',
  'minutes',
  'tiered',
  '{
    "tiers": [
      {"min": 0, "max": 60, "points": 5},
      {"min": 60, "max": 120, "points": 3},
      {"min": 120, "max": 180, "points": 0},
      {"min": 180, "max": null, "points": -3}
    ],
    "daily_limit_minutes": 120
  }'::jsonb,
  true,
  ARRAY['screen_time'],
  'smartphone',
  true,
  false
);

-- 7) Journaling
-- Category: mindfulness (Mental)
-- Scoring: threshold - must journal for minimum time to earn points
INSERT INTO public.task_templates (
  name, description, category, input_type, unit, scoring_type,
  default_config, supports_integration, allowed_data_sources,
  icon, is_active, is_premium
) VALUES (
  'Journaling',
  'Write in your journal daily. Reflect on your day, goals, or gratitude.',
  'mindfulness',
  'duration',
  'minutes',
  'threshold',
  '{
    "threshold": 5,
    "points_for_threshold": 3
  }'::jsonb,
  false,
  ARRAY['manual'],
  'pencil',
  true,
  false
);

-- 8) Meditation
-- Category: mindfulness (Mental)
-- Scoring: linear_per_unit - 0.2 points per 5 minutes, max 5 points/day
INSERT INTO public.task_templates (
  name, description, category, input_type, unit, scoring_type,
  default_config, supports_integration, allowed_data_sources,
  icon, is_active, is_premium
) VALUES (
  'Meditation',
  'Practice mindfulness or meditation. Calm your mind and earn points.',
  'mindfulness',
  'duration',
  'minutes',
  'linear_per_unit',
  '{
    "points_per_unit": 0.2,
    "unit_size": 5,
    "daily_cap": 5
  }'::jsonb,
  false,
  ARRAY['manual'],
  'brain',
  true,
  false
);

-- 9) Bedtime Before Target
-- Category: sleep
-- Scoring: time_before - earn points if in bed before target time
INSERT INTO public.task_templates (
  name, description, category, input_type, unit, scoring_type,
  default_config, supports_integration, allowed_data_sources,
  icon, is_active, is_premium
) VALUES (
  'Bedtime',
  'Get to bed on time. Log when you go to sleep and earn points for hitting your target.',
  'sleep',
  'time',
  'bedtime_time',
  'time_before',
  '{
    "target_time": "23:00",
    "points_for_success": 3
  }'::jsonb,
  false,
  ARRAY['manual'],
  'moon',
  true,
  false
);

-- 10) Wake Time Before Target
-- Category: sleep
-- Scoring: time_before - earn points if awake before target time
INSERT INTO public.task_templates (
  name, description, category, input_type, unit, scoring_type,
  default_config, supports_integration, allowed_data_sources,
  icon, is_active, is_premium
) VALUES (
  'Wake Time',
  'Wake up on time. Log when you wake and earn points for rising before your target.',
  'sleep',
  'time',
  'waketime_time',
  'time_before',
  '{
    "target_time": "07:00",
    "points_for_success": 3
  }'::jsonb,
  false,
  ARRAY['manual'],
  'sun',
  true,
  false
);

-- =====================================================
-- DOCUMENTATION: ADDING NEW TASK TEMPLATES
-- =====================================================
-- To add a new default task template in the future:
--
-- INSERT INTO public.task_templates (
--   name,                    -- Unique display name
--   description,             -- User-facing description
--   category,                -- One of: fitness, wellness, learning, productivity, sleep, nutrition, mindfulness, social, custom
--   input_type,              -- One of: binary, numeric, time, duration
--   unit,                    -- One of: steps, minutes, hours, pages, count, bedtime_time, waketime_time, boolean, words, miles, calories
--   scoring_type,            -- One of: binary_yesno, linear_per_unit, threshold, time_before, time_after, tiered, diminishing
--   default_config,          -- JSONB with scoring parameters (see examples above)
--   supports_integration,    -- true if can sync with external apps
--   allowed_data_sources,    -- ARRAY of: manual, apple_health, google_fit, screen_time, whoop, etc.
--   icon,                    -- Lucide icon name for UI
--   is_active,               -- true to make available
--   is_premium               -- true if premium-only feature
-- ) VALUES (...);
--
-- The scoring engine will automatically handle the new template
-- based on its scoring_type. No code changes required!
-- =====================================================