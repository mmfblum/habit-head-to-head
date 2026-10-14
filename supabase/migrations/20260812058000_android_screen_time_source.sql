-- Android Screen Time can be imported from UsageStatsManager after the user
-- explicitly grants Zrizin special Usage Access in system Settings.
UPDATE public.task_templates
SET supports_integration = TRUE,
    allowed_data_sources = ARRAY['manual','android_usage']::text[],
    updated_at = now()
WHERE name = 'Screen Time';
