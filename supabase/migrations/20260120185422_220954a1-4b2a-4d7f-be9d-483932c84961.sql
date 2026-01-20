-- Create a function to generate task instances for a user in a season
CREATE OR REPLACE FUNCTION public.generate_task_instances_for_user(_season_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    config RECORD;
    template RECORD;
    merged_config JSONB;
BEGIN
    -- Loop through all enabled task configs for this season
    FOR config IN
        SELECT ltc.*, tt.*
        FROM league_task_configs ltc
        JOIN task_templates tt ON tt.id = ltc.task_template_id
        WHERE ltc.season_id = _season_id AND ltc.is_enabled = TRUE
    LOOP
        -- Merge template's default_config with any overrides
        merged_config := config.default_config || config.config_overrides;
        
        -- Check if task instance already exists for this user/config
        IF NOT EXISTS (
            SELECT 1 FROM task_instances
            WHERE season_id = _season_id
              AND league_task_config_id = config.id
        ) THEN
            -- Insert task instance (shared by all members, not per-user)
            INSERT INTO task_instances (
                season_id,
                league_task_config_id,
                task_name,
                input_type,
                scoring_type,
                config
            ) VALUES (
                _season_id,
                config.id,
                config.name,
                config.input_type,
                config.scoring_type,
                merged_config
            );
        END IF;
    END LOOP;
END;
$$;

-- Create function to generate task instances when season becomes active
CREATE OR REPLACE FUNCTION public.on_season_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    member RECORD;
BEGIN
    -- Only run when status changes to 'active'
    IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
        -- Generate task instances for the season (done once, shared by all)
        PERFORM generate_task_instances_for_user(NEW.id, NULL);
        
        -- Create season standings for all existing members
        FOR member IN
            SELECT lm.user_id
            FROM league_members lm
            WHERE lm.league_id = NEW.league_id
        LOOP
            INSERT INTO season_standings (user_id, season_id)
            VALUES (member.user_id, NEW.id)
            ON CONFLICT (user_id, season_id) DO NOTHING;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for season activation
DROP TRIGGER IF EXISTS on_season_activated_trigger ON seasons;
CREATE TRIGGER on_season_activated_trigger
    AFTER UPDATE ON seasons
    FOR EACH ROW
    EXECUTE FUNCTION on_season_activated();

-- Create function to handle new league members joining
CREATE OR REPLACE FUNCTION public.on_league_member_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    active_season RECORD;
BEGIN
    -- Find any active season for this league
    FOR active_season IN
        SELECT id FROM seasons
        WHERE league_id = NEW.league_id
          AND status = 'active'
    LOOP
        -- Ensure task instances exist (they should, but just in case)
        PERFORM generate_task_instances_for_user(active_season.id, NEW.user_id);
        
        -- Create season standing for new member
        INSERT INTO season_standings (user_id, season_id)
        VALUES (NEW.user_id, active_season.id)
        ON CONFLICT (user_id, season_id) DO NOTHING;
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- Create trigger for new league members
DROP TRIGGER IF EXISTS on_league_member_joined_trigger ON league_members;
CREATE TRIGGER on_league_member_joined_trigger
    AFTER INSERT ON league_members
    FOR EACH ROW
    EXECUTE FUNCTION on_league_member_joined();

-- Backfill: Generate task instances for any existing seasons with task configs
DO $$
DECLARE
    season_rec RECORD;
BEGIN
    FOR season_rec IN
        SELECT DISTINCT s.id, s.league_id
        FROM seasons s
        JOIN league_task_configs ltc ON ltc.season_id = s.id
        WHERE NOT EXISTS (
            SELECT 1 FROM task_instances ti WHERE ti.season_id = s.id
        )
    LOOP
        PERFORM generate_task_instances_for_user(season_rec.id, NULL);
    END LOOP;
END $$;