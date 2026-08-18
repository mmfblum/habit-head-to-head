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
  base_name TEXT;
  quantity NUMERIC;
  quantity_text TEXT;
BEGIN
  FOR config_rec IN
    SELECT
      ltc.id AS league_task_config_id,
      ltc.config_overrides,
      ltc.max_daily_points,
      tt.name,
      tt.input_type,
      tt.scoring_type,
      tt.unit,
      tt.default_config
    FROM public.league_task_configs ltc
    JOIN public.task_templates tt ON tt.id = ltc.task_template_id
    WHERE ltc.season_id = _season_id
      AND ltc.is_enabled = TRUE
    ORDER BY ltc.display_order, ltc.id
  LOOP
    merged_config := COALESCE(config_rec.default_config, '{}'::JSONB)
      || COALESCE(config_rec.config_overrides, '{}'::JSONB)
      || jsonb_build_object('max_daily_points', config_rec.max_daily_points);

    base_name := COALESCE(
      NULLIF(BTRIM(config_rec.config_overrides->>'custom_name'), ''),
      config_rec.name
    );
    display_name := base_name;

    IF merged_config ? 'target_time'
       AND config_rec.unit::TEXT IN ('bedtime_time', 'waketime_time') THEN
      display_name := base_name || ' by ' ||
        TRIM(TO_CHAR((merged_config->>'target_time')::TIME, 'FMHH12:MI AM'));
    ELSIF merged_config ? 'daily_limit_minutes' THEN
      quantity := NULLIF(merged_config->>'daily_limit_minutes', '')::NUMERIC;
      IF quantity IS NOT NULL AND quantity > 0 THEN
        quantity_text := TRIM(TO_CHAR(quantity, 'FM999,999,999,990.##'));
        display_name := base_name || ' ≤ ' || quantity_text || ' min';
      END IF;
    ELSE
      quantity := COALESCE(
        NULLIF(merged_config->>'target', '')::NUMERIC,
        NULLIF(merged_config->>'threshold', '')::NUMERIC
      );

      IF quantity IS NOT NULL AND quantity > 0 THEN
        quantity_text := TRIM(TO_CHAR(quantity, 'FM999,999,999,990.##'));
        display_name := CASE config_rec.unit::TEXT
          WHEN 'count' THEN quantity_text || ' ' || base_name
          WHEN 'steps' THEN quantity_text || ' ' ||
            CASE WHEN LOWER(base_name) LIKE '%step%' THEN base_name ELSE 'steps ' || base_name END
          WHEN 'minutes' THEN quantity_text || ' min ' || base_name
          WHEN 'hours' THEN quantity_text || ' hr ' || base_name
          WHEN 'pages' THEN quantity_text || ' pages ' || base_name
          WHEN 'words' THEN quantity_text || ' words ' || base_name
          WHEN 'miles' THEN quantity_text || ' mi ' || base_name
          WHEN 'calories' THEN quantity_text || ' cal ' || base_name
          ELSE quantity_text || ' ' || base_name
        END;
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.task_instances
      WHERE season_id = _season_id
        AND league_task_config_id = config_rec.league_task_config_id
    ) THEN
      INSERT INTO public.task_instances(
        season_id,
        league_task_config_id,
        task_name,
        input_type,
        scoring_type,
        config
      )
      VALUES(
        _season_id,
        config_rec.league_task_config_id,
        display_name,
        config_rec.input_type,
        config_rec.scoring_type,
        merged_config
      );
    ELSE
      UPDATE public.task_instances
      SET config = merged_config,
          task_name = display_name,
          input_type = config_rec.input_type,
          scoring_type = config_rec.scoring_type
      WHERE season_id = _season_id
        AND league_task_config_id = config_rec.league_task_config_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_task_instances_for_user(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_task_instances_for_user(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_task_instances_for_user(UUID, UUID) TO authenticated;

-- Refresh existing task-instance labels/config without changing scores or check-ins.
DO $$
DECLARE
  season_rec RECORD;
BEGIN
  FOR season_rec IN SELECT id FROM public.seasons LOOP
    PERFORM public.generate_task_instances_for_user(season_rec.id, NULL);
  END LOOP;
END;
$$;
