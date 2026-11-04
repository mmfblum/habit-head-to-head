-- =============================================================================
-- SCREEN TIME MVP FALLBACK
-- =============================================================================
-- Browser/PWA builds cannot currently import iOS Screen Time directly. Keep the
-- integration-ready task but allow a confirmed manual value until a native data
-- bridge is available, rather than exposing an impossible-to-complete task.
-- =============================================================================

UPDATE public.task_templates
SET default_config = COALESCE(default_config, '{}'::JSONB)
    || jsonb_build_object(
        'daily_limit_minutes', COALESCE((default_config->>'daily_limit_minutes')::NUMERIC, 120),
        'target', COALESCE((default_config->>'target')::NUMERIC, 120),
        'verification', jsonb_build_object(
            'method', 'manual_action',
            'allowed_sources', ARRAY['manual', 'screen_time'],
            'requires_confirmation', TRUE,
            'manual_requires_flag', TRUE,
            'confirmation_action', 'log_screen_time',
            'auto_import_only', FALSE,
            'description', 'Enter your device Screen Time total and confirm it. Native import can replace manual entry later.'
        )
    )
WHERE name = 'Screen Time';

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
