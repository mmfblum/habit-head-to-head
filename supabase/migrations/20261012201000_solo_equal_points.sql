-- Keep shared Solo fair and readable: every completed goal is worth 3 points.
-- Goal targets may differ, but performance above the target does not increase score.

CREATE OR REPLACE FUNCTION public.normalize_solo_task_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_game_format TEXT;
BEGIN
  SELECT l.game_format
  INTO v_game_format
  FROM public.seasons s
  JOIN public.leagues l ON l.id = s.league_id
  WHERE s.id = NEW.season_id;

  IF v_game_format = 'solo' THEN
    NEW.config_overrides :=
      COALESCE(NEW.config_overrides, '{}'::jsonb)
      || jsonb_build_object('scoring_mode', 'binary', 'binary_points', 3);
    NEW.max_daily_points := 3;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS normalize_solo_task_config_trigger
ON public.league_task_configs;

CREATE TRIGGER normalize_solo_task_config_trigger
BEFORE INSERT OR UPDATE OF season_id, config_overrides, max_daily_points
ON public.league_task_configs
FOR EACH ROW
EXECUTE FUNCTION public.normalize_solo_task_config();

UPDATE public.league_task_configs ltc
SET config_overrides =
      COALESCE(ltc.config_overrides, '{}'::jsonb)
      || jsonb_build_object('scoring_mode', 'binary', 'binary_points', 3),
    max_daily_points = 3
FROM public.seasons s
JOIN public.leagues l ON l.id = s.league_id
WHERE ltc.season_id = s.id
  AND l.game_format = 'solo';
