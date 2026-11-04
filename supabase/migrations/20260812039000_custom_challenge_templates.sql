-- =============================================================================
-- FIRST-CLASS LEAGUE CUSTOM CHALLENGES
-- =============================================================================
-- A league-wide custom challenge should use the same scoring/audit path as every
-- other league task. We seed three generic templates and let config_overrides
-- supply the commissioner-facing name/description and daily goal.
-- =============================================================================

INSERT INTO public.task_templates (
  name, description, category, icon, input_type, unit, scoring_type,
  default_config, min_value, max_value, supports_integration, allowed_data_sources
)
SELECT
  'Custom Challenge — Checkoff',
  'A league-defined daily challenge completed with a simple yes/no.',
  'custom', 'sparkles', 'binary', 'boolean', 'binary_yesno',
  '{"scoring_mode":"binary","binary_points":3,"verification":{"method":"manual_action","allowed_sources":["manual"],"requires_confirmation":false,"manual_requires_flag":false,"confirmation_action":null,"description":"Player confirms completion."}}'::jsonb,
  NULL, NULL, FALSE, ARRAY['manual']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_templates WHERE name = 'Custom Challenge — Checkoff'
);

INSERT INTO public.task_templates (
  name, description, category, icon, input_type, unit, scoring_type,
  default_config, min_value, max_value, supports_integration, allowed_data_sources
)
SELECT
  'Custom Challenge — Minutes',
  'A league-defined daily challenge measured in minutes.',
  'custom', 'timer', 'duration', 'minutes', 'threshold',
  '{"scoring_mode":"binary","binary_points":3,"threshold":20,"points_at_threshold":3,"cap":3,"verification":{"method":"manual_action","allowed_sources":["manual"],"requires_confirmation":true,"manual_requires_flag":false,"confirmation_action":"log_score","description":"Player enters minutes and confirms the score."}}'::jsonb,
  0, 480, FALSE, ARRAY['manual']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_templates WHERE name = 'Custom Challenge — Minutes'
);

INSERT INTO public.task_templates (
  name, description, category, icon, input_type, unit, scoring_type,
  default_config, min_value, max_value, supports_integration, allowed_data_sources
)
SELECT
  'Custom Challenge — Count',
  'A league-defined daily challenge measured by a count.',
  'custom', 'hash', 'numeric', 'count', 'threshold',
  '{"scoring_mode":"binary","binary_points":3,"threshold":1,"points_at_threshold":3,"cap":3,"verification":{"method":"manual_action","allowed_sources":["manual"],"requires_confirmation":true,"manual_requires_flag":false,"confirmation_action":"log_score","description":"Player enters a count and confirms the score."}}'::jsonb,
  0, 100000, FALSE, ARRAY['manual']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_templates WHERE name = 'Custom Challenge — Count'
);

CREATE OR REPLACE FUNCTION public.generate_task_instances_for_user(_season_id UUID, _user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    config_rec RECORD;
    merged_config JSONB;
    display_name TEXT;
BEGIN
    FOR config_rec IN
        SELECT
            ltc.id AS league_task_config_id,
            ltc.config_overrides,
            ltc.max_daily_points,
            tt.name,
            tt.input_type,
            tt.scoring_type,
            tt.default_config
        FROM public.league_task_configs ltc
        JOIN public.task_templates tt ON tt.id = ltc.task_template_id
        WHERE ltc.season_id = _season_id
          AND ltc.is_enabled = TRUE
    LOOP
        merged_config := COALESCE(config_rec.default_config, '{}'::JSONB)
            || COALESCE(config_rec.config_overrides, '{}'::JSONB)
            || jsonb_build_object('max_daily_points', config_rec.max_daily_points);

        display_name := COALESCE(
            NULLIF(BTRIM(config_rec.config_overrides->>'custom_name'), ''),
            config_rec.name
        );

        IF NOT EXISTS (
            SELECT 1
            FROM public.task_instances ti
            WHERE ti.season_id = _season_id
              AND ti.league_task_config_id = config_rec.league_task_config_id
        ) THEN
            INSERT INTO public.task_instances (
                season_id,
                league_task_config_id,
                task_name,
                input_type,
                scoring_type,
                config
            ) VALUES (
                _season_id,
                config_rec.league_task_config_id,
                display_name,
                config_rec.input_type,
                config_rec.scoring_type,
                merged_config
            );
        ELSE
            UPDATE public.task_instances ti
            SET config = merged_config,
                task_name = display_name,
                input_type = config_rec.input_type,
                scoring_type = config_rec.scoring_type
            WHERE ti.season_id = _season_id
              AND ti.league_task_config_id = config_rec.league_task_config_id;
        END IF;
    END LOOP;
END;
$$;
