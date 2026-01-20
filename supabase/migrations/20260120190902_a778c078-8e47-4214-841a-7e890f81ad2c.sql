-- ================================================
-- CONSOLIDATE DUPLICATE TASK TEMPLATES
-- ================================================

-- Soft-delete duplicate templates (keep the better-configured version)
UPDATE task_templates SET is_active = false WHERE id IN (
  'cecf44a0-d07b-484e-b2f7-f359c72b0346', -- duplicate Wake Time (less detailed)
  '3506229c-3d9a-45c7-bef2-b429c5fec247', -- duplicate Bedtime (less detailed)  
  '181462c6-2f25-42be-82ab-a9349b57b233', -- duplicate Workout (threshold only)
  'a3d08bfb-08f4-4c3b-95ed-304290a8af47', -- duplicate Steps (same as Daily Steps)
  'e65c968c-4915-4761-bc26-f5427235b491', -- duplicate Reading (linear - keep threshold)
  'c26f2e0c-c65e-48a2-9aa4-e4ce8f66f9f9'  -- duplicate Meditation (tiered - keep linear)
);

-- Update retained templates with enhanced, flexible default_config
-- Each config now supports both binary and detailed modes

-- Wake Time (time_after scoring)
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'target_time', '06:30',
  'points_on_time', 50,
  'penalty_per_minute', 1,
  'grace_minutes', 15,
  'max_penalty', 50,
  'binary_points', 3
),
description = 'Earn points by waking up before your target time. Customize the target for your league.'
WHERE id = '8fb7d9fd-1f98-4a32-8fa9-56d13e4e784e';

-- Bedtime (time_before scoring)
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'target_time', '22:30',
  'points_on_time', 50,
  'penalty_per_minute', 1,
  'grace_minutes', 15,
  'max_penalty', 50,
  'binary_points', 3
),
description = 'Earn points by going to bed before your target time. Customize the target for your league.'
WHERE id = '61c1a3f0-0c49-4b3c-8e35-5f8e85e0b3c9';

-- Workout (threshold scoring)
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'threshold', 30,
  'points_at_threshold', 50,
  'bonus_per_unit', 1,
  'max_bonus', 20,
  'binary_points', 5
),
description = 'Earn points by completing your workout goal. Set the minimum minutes for your league.'
WHERE id = 'a10e2a0e-74b3-4ed9-a7ab-c7d8e9f01234';

-- Daily Steps (linear_per_unit scoring)
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'target', 10000,
  'points_per_unit', 5,
  'unit_size', 1000,
  'max_points', 50,
  'binary_points', 3
),
description = 'Earn points for steps walked. Customize the daily target for your league.'
WHERE id = '6b29b7ca-e3d5-4f8a-9b1c-2d3e4f5a6b7c';

-- Reading (threshold scoring)
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'threshold', 30,
  'points_at_threshold', 50,
  'bonus_per_unit', 1,
  'max_bonus', 20,
  'binary_points', 3
),
description = 'Earn points by reading for your target duration. Set the minimum minutes for your league.'
WHERE id = 'b3d05725-89c1-4d6e-b4a2-8e9f0a1b2c3d';

-- Meditation (linear_per_unit scoring) 
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'target', 15,
  'points_per_unit', 5,
  'unit_size', 5,
  'max_points', 30,
  'binary_points', 3
),
description = 'Earn points for meditation practice. Set the target duration for your league.'
WHERE id = 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a';

-- Journaling (binary scoring - already simple, just enhance config)
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'points', 50,
  'binary_points', 3
),
description = 'Earn points by completing your daily journal entry.'
WHERE id = 'f0a1b2c3-d4e5-6f7a-8b9c-0d1e2f3a4b5c';

-- Screen Time (tiered scoring)
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'tiers', jsonb_build_array(
    jsonb_build_object('max_value', 60, 'points', 50),
    jsonb_build_object('max_value', 120, 'points', 30),
    jsonb_build_object('max_value', 180, 'points', 10),
    jsonb_build_object('max_value', 999, 'points', 0)
  ),
  'binary_points', 3
),
description = 'Earn points by limiting screen time. Configure the tier thresholds for your league.'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Water Intake
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'target', 8,
  'points_per_unit', 6,
  'unit_size', 1,
  'max_points', 50,
  'binary_points', 3
),
description = 'Earn points for drinking water. Set the target glasses for your league.'
WHERE id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

-- No Alcohol
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'points', 50,
  'binary_points', 3
),
description = 'Earn points by abstaining from alcohol.'
WHERE id = 'c3d4e5f6-a7b8-9012-cdef-345678901234';

-- Healthy Meals
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'target', 3,
  'points_per_unit', 15,
  'unit_size', 1,
  'max_points', 45,
  'binary_points', 3
),
description = 'Earn points for eating healthy meals. Set the target meals for your league.'
WHERE id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

-- Social Connection
UPDATE task_templates 
SET default_config = jsonb_build_object(
  'points', 50,
  'binary_points', 3
),
description = 'Earn points by making meaningful social connections.'
WHERE id = 'e5f6a7b8-c9d0-1234-efab-567890123456';