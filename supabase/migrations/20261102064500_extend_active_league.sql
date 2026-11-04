CREATE OR REPLACE FUNCTION public.extend_league_season(
  _season_id uuid,
  _additional_weeks integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  season_rec RECORD;
  league_rec RECORD;
  last_week_rec RECORD;
  i integer;
  new_week_number integer;
  new_start date;
  new_end date;
BEGIN
  IF _additional_weeks < 1 OR _additional_weeks > 4 THEN
    RAISE EXCEPTION 'You can add between 1 and 4 weeks at a time';
  END IF;

  SELECT s.*, l.game_format, l.archived_at
  INTO season_rec
  FROM public.seasons s
  JOIN public.leagues l ON l.id = s.league_id
  WHERE s.id = _season_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Season not found';
  END IF;

  IF season_rec.archived_at IS NOT NULL OR season_rec.status <> 'active' THEN
    RAISE EXCEPTION 'Only an active league can be extended';
  END IF;

  IF NOT public.is_league_admin(auth.uid(), season_rec.league_id) THEN
    RAISE EXCEPTION 'Only the commissioner can extend the league';
  END IF;

  SELECT *
  INTO last_week_rec
  FROM public.weeks
  WHERE season_id = _season_id
    AND week_number > 0
  ORDER BY week_number DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No scoring weeks found';
  END IF;

  FOR i IN 1.._additional_weeks LOOP
    new_week_number := last_week_rec.week_number + i;
    new_start := last_week_rec.end_date + 1 + ((i - 1) * 7);
    new_end := new_start + 6;

    INSERT INTO public.weeks(season_id, week_number, start_date, end_date, is_locked)
    VALUES (_season_id, new_week_number, new_start, new_end, false);
  END LOOP;

  UPDATE public.seasons
  SET weeks_count = weeks_count + _additional_weeks,
      end_date = end_date + (_additional_weeks * 7),
      updated_at = now()
  WHERE id = _season_id;

  PERFORM public.refresh_season_matchups(_season_id);
  PERFORM public.grant_season_powerplays(_season_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.extend_league_season(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_league_season(uuid, integer) TO authenticated;
