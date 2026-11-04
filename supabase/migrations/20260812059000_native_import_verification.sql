-- Native device imports are automated measurements and should not require the
-- manual confirmation flag used by exact-entry UI flows such as Screen Time.
-- The source/imported metadata is still recorded on the check-in for auditability.
CREATE OR REPLACE FUNCTION public.is_checkin_verified(
  _checkin public.daily_checkins,
  _task_instance public.task_instances
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
  is_native_import BOOLEAN;
BEGIN
  verification_config := (_task_instance.config->>'verification')::JSONB;
  IF verification_config IS NULL THEN
    RETURN TRUE;
  END IF;

  metadata := COALESCE(_checkin.metadata, '{}'::JSONB);
  source := COALESCE(metadata->>'source', 'manual');
  auto_import_only := COALESCE((verification_config->>'auto_import_only')::BOOLEAN, FALSE);
  is_native_import := COALESCE((metadata->>'imported')::BOOLEAN, FALSE)
    AND source IN ('apple_health', 'health_connect', 'android_usage', 'screen_time');

  IF auto_import_only AND source = 'manual' THEN
    RETURN FALSE;
  END IF;

  requires_confirmation := COALESCE((verification_config->>'requires_confirmation')::BOOLEAN, FALSE);
  IF requires_confirmation
     AND NOT is_native_import
     AND (metadata->>'confirmed')::BOOLEAN IS NOT TRUE THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Keep the human-readable verification contract consistent with the Android
-- UsageStatsManager implementation. `screen_time` is retained for backwards
-- compatibility with older check-ins.
UPDATE public.task_templates
SET default_config = jsonb_set(
      default_config,
      '{verification,allowed_sources}',
      '["manual","screen_time","android_usage"]'::jsonb,
      TRUE
    ),
    supports_integration = TRUE,
    allowed_data_sources = ARRAY['manual','android_usage']::text[],
    updated_at = now()
WHERE name = 'Screen Time';
