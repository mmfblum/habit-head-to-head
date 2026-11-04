-- Promote any legacy non-H2H preseason into the real first scoring week.
DO $promote$
DECLARE
  r RECORD;
  local_today DATE;
  week0_id UUID;
  old_week1_id UUID;
  scorer RECORD;
BEGIN
  FOR r IN
    SELECT s.id AS season_id,
           s.weeks_count,
           COALESCE(p.timezone, 'America/New_York') AS timezone
    FROM public.seasons s
    JOIN public.leagues l ON l.id = s.league_id
    LEFT JOIN public.profiles p ON p.id = l.created_by
    WHERE s.status = 'active'
      AND l.game_format IN ('solo', 'leaderboard')
  LOOP
    local_today := (now() AT TIME ZONE COALESCE(r.timezone, 'America/New_York'))::DATE;

    SELECT w.id
    INTO week0_id
    FROM public.weeks w
    WHERE w.season_id = r.season_id
      AND w.week_number = 0
    LIMIT 1;

    IF week0_id IS NOT NULL THEN
      SELECT w.id
      INTO old_week1_id
      FROM public.weeks w
      WHERE w.season_id = r.season_id
        AND w.week_number = 1
      LIMIT 1;

      IF old_week1_id IS NOT NULL THEN
        DELETE FROM public.weekly_scores WHERE week_id = old_week1_id;
        DELETE FROM public.leaderboard_week_results WHERE week_id = old_week1_id;
        DELETE FROM public.powerups WHERE week_id = old_week1_id;
        DELETE FROM public.matchups WHERE week_id = old_week1_id;
        DELETE FROM public.league_events WHERE week_id = old_week1_id;
        DELETE FROM public.weeks WHERE id = old_week1_id;
      END IF;

      UPDATE public.weeks
      SET week_number = 1,
          start_date = local_today,
          end_date = local_today + 6,
          is_locked = FALSE
      WHERE id = week0_id;

      UPDATE public.weeks w
      SET start_date = local_today + ((w.week_number - 1) * 7),
          end_date = local_today + ((w.week_number - 1) * 7) + 6,
          is_locked = FALSE
      WHERE w.season_id = r.season_id
        AND w.week_number >= 2;

      UPDATE public.seasons
      SET start_date = local_today,
          end_date = local_today + (weeks_count * 7) - 1,
          updated_at = now()
      WHERE id = r.season_id;

      FOR scorer IN
        SELECT DISTINCT se.user_id
        FROM public.scoring_events se
        WHERE se.season_id = r.season_id
          AND se.week_id = week0_id
          AND se.is_reversed = FALSE
      LOOP
        PERFORM public.update_weekly_score(scorer.user_id, week0_id);
        PERFORM public.update_season_standing(scorer.user_id, r.season_id);
      END LOOP;
    ELSIF EXISTS (
      SELECT 1
      FROM public.weeks w
      WHERE w.season_id = r.season_id
        AND w.week_number = 1
        AND w.start_date > local_today
    ) THEN
      UPDATE public.weeks w
      SET start_date = local_today + ((w.week_number - 1) * 7),
          end_date = local_today + ((w.week_number - 1) * 7) + 6,
          is_locked = FALSE
      WHERE w.season_id = r.season_id
        AND w.week_number > 0;

      UPDATE public.seasons
      SET start_date = local_today,
          end_date = local_today + (weeks_count * 7) - 1,
          updated_at = now()
      WHERE id = r.season_id;
    END IF;

    week0_id := NULL;
    old_week1_id := NULL;
  END LOOP;
END;
$promote$;