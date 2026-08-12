-- Scoring events are league-owned audit records. Make every ownership FK
-- cascade explicitly so transactional league/season/week deletion cannot be
-- blocked by a later-added NO ACTION relationship.

ALTER TABLE public.scoring_events
  DROP CONSTRAINT IF EXISTS scoring_events_user_id_fkey,
  DROP CONSTRAINT IF EXISTS scoring_events_week_id_fkey,
  DROP CONSTRAINT IF EXISTS scoring_events_season_id_fkey,
  DROP CONSTRAINT IF EXISTS scoring_events_league_id_fkey,
  DROP CONSTRAINT IF EXISTS scoring_events_task_instance_id_fkey;

ALTER TABLE public.scoring_events
  ADD CONSTRAINT scoring_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT scoring_events_week_id_fkey
    FOREIGN KEY (week_id) REFERENCES public.weeks(id) ON DELETE CASCADE,
  ADD CONSTRAINT scoring_events_season_id_fkey
    FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE,
  ADD CONSTRAINT scoring_events_league_id_fkey
    FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE,
  ADD CONSTRAINT scoring_events_task_instance_id_fkey
    FOREIGN KEY (task_instance_id) REFERENCES public.task_instances(id) ON DELETE CASCADE;
