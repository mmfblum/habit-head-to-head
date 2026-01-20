-- Create a function to auto-generate weeks when a season is created
CREATE OR REPLACE FUNCTION public.generate_season_weeks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    week_start DATE;
    week_end DATE;
    i INT;
BEGIN
    -- Generate weeks for the new season
    week_start := NEW.start_date::DATE;
    
    FOR i IN 1..NEW.weeks_count LOOP
        week_end := week_start + INTERVAL '6 days';
        
        INSERT INTO public.weeks (season_id, week_number, start_date, end_date)
        VALUES (NEW.id, i, week_start, week_end);
        
        week_start := week_end + INTERVAL '1 day';
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- Create trigger to run after season insert
DROP TRIGGER IF EXISTS trigger_generate_season_weeks ON public.seasons;
CREATE TRIGGER trigger_generate_season_weeks
AFTER INSERT ON public.seasons
FOR EACH ROW
EXECUTE FUNCTION public.generate_season_weeks();

-- Also generate weeks for existing seasons that don't have weeks yet
INSERT INTO public.weeks (season_id, week_number, start_date, end_date)
SELECT 
    s.id,
    generate_series(1, s.weeks_count) as week_number,
    s.start_date::date + ((generate_series(1, s.weeks_count) - 1) * 7) as start_date,
    s.start_date::date + ((generate_series(1, s.weeks_count) - 1) * 7) + 6 as end_date
FROM public.seasons s
WHERE NOT EXISTS (
    SELECT 1 FROM public.weeks w WHERE w.season_id = s.id
);