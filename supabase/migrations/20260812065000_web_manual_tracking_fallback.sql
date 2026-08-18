-- Web-first launch: device integrations remain optional. Until native tracking is
-- proven in real use, every integration-backed scorecard task must be fully
-- scoreable by a confirmed manual check-in.

UPDATE public.task_templates
SET
  allowed_data_sources = CASE name
    WHEN 'Steps' THEN ARRAY['manual', 'apple_health', 'health_connect']::TEXT[]
    WHEN 'Workout' THEN ARRAY['manual', 'apple_health', 'google_fit', 'whoop']::TEXT[]
    WHEN 'Screen Time' THEN ARRAY['manual', 'screen_time', 'android_usage']::TEXT[]
    ELSE allowed_data_sources
  END,
  default_config = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(default_config, '{}'::JSONB),
        '{verification,auto_import_only}',
        'false'::JSONB,
        true
      ),
      '{verification,manual_requires_flag}',
      'false'::JSONB,
      true
    ),
    '{verification,description}',
    to_jsonb(
      CASE name
        WHEN 'Steps' THEN 'Check off the daily Steps goal manually or log the exact total. Device sync can replace the manual result later.'
        WHEN 'Workout' THEN 'Check off the daily Workout goal manually or log the exact duration. Device sync can replace the manual result later.'
        WHEN 'Screen Time' THEN 'Check off the Screen Time limit manually or log the exact total. Device sync can replace the manual result later.'
        ELSE COALESCE(default_config->'verification'->>'description', '')
      END
    ),
    true
  ),
  updated_at = now()
WHERE is_active = TRUE
  AND name IN ('Steps', 'Workout', 'Screen Time');

-- Ensure the verification source allowlists also describe the web fallback.
UPDATE public.task_templates
SET default_config = jsonb_set(
  default_config,
  '{verification,allowed_sources}',
  CASE name
    WHEN 'Steps' THEN '["manual","apple_health","health_connect"]'::JSONB
    WHEN 'Workout' THEN '["manual","apple_health","google_fit","whoop"]'::JSONB
    WHEN 'Screen Time' THEN '["manual","screen_time","android_usage"]'::JSONB
    ELSE default_config->'verification'->'allowed_sources'
  END,
  true
)
WHERE is_active = TRUE
  AND name IN ('Steps', 'Workout', 'Screen Time');

-- Existing draft/active seasons inherit the revised template verification
-- contract without touching any check-in or scoring-event rows.
DO $$
DECLARE
  season_rec RECORD;
BEGIN
  FOR season_rec IN
    SELECT id FROM public.seasons WHERE status IN ('draft', 'active')
  LOOP
    PERFORM public.generate_task_instances_for_user(season_rec.id, NULL);
  END LOOP;
END;
$$;
