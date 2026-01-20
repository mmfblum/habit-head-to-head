
-- =====================================================
-- EXTENSIBLE PRODUCTIVITY FANTASY LEAGUE SCHEMA
-- =====================================================

-- Drop existing tables/types if they exist (clean slate for new design)
DROP TABLE IF EXISTS task_completions CASCADE;
DROP TABLE IF EXISTS custom_tasks CASCADE;
DROP TABLE IF EXISTS task_templates CASCADE;
DROP TYPE IF EXISTS task_type CASCADE;

-- =====================================================
-- ENUMS
-- =====================================================

-- Input type determines what kind of value users enter
CREATE TYPE public.input_type AS ENUM (
  'binary',      -- yes/no toggle
  'numeric',     -- number input (steps, pages, minutes)
  'time',        -- time of day (bedtime, wake time)
  'duration'     -- length of time (workout duration)
);

-- Unit type for display and validation
CREATE TYPE public.unit_type AS ENUM (
  'steps',
  'minutes',
  'hours',
  'pages',
  'count',
  'bedtime_time',
  'waketime_time',
  'boolean',
  'words',
  'miles',
  'calories'
);

-- Scoring algorithm to apply
CREATE TYPE public.scoring_type AS ENUM (
  'binary_yesno',       -- 0 or max points
  'linear_per_unit',    -- points = value * points_per_unit (with cap)
  'threshold',          -- 0 below threshold, max at/above
  'time_before',        -- points for completing before target time
  'time_after',         -- points for completing after target time  
  'tiered',             -- multiple tiers with different point values
  'diminishing'         -- decreasing returns as value increases
);

-- Task category for organization
CREATE TYPE public.task_category AS ENUM (
  'fitness',
  'wellness',
  'learning',
  'productivity',
  'sleep',
  'nutrition',
  'mindfulness',
  'social',
  'custom'
);

-- League member role
CREATE TYPE public.league_role AS ENUM (
  'owner',
  'admin',
  'member'
);

-- Matchup status
CREATE TYPE public.matchup_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed'
);

-- Season status
CREATE TYPE public.season_status AS ENUM (
  'draft',
  'active',
  'completed',
  'archived'
);

-- =====================================================
-- PROFILES (references auth.users)
-- =====================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TASK TEMPLATES (The Growing Default Library)
-- =====================================================

CREATE TABLE public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  category task_category NOT NULL DEFAULT 'productivity',
  icon TEXT DEFAULT 'activity',
  
  -- Input configuration
  input_type input_type NOT NULL,
  unit unit_type NOT NULL,
  
  -- Scoring configuration
  scoring_type scoring_type NOT NULL,
  default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example default_config:
  -- {
  --   "points_per_unit": 0.01,
  --   "unit_size": 1000,
  --   "cap": 100,
  --   "threshold": 10000,
  --   "target_time": "22:00",
  --   "tiers": [{"min": 0, "max": 5000, "points": 25}, {"min": 5000, "max": 10000, "points": 50}]
  -- }
  
  -- Validation constraints
  min_value NUMERIC,
  max_value NUMERIC,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_templates_category ON public.task_templates(category);
CREATE INDEX idx_task_templates_active ON public.task_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_task_templates_scoring ON public.task_templates(scoring_type);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read active templates
CREATE POLICY "Anyone can view active templates" ON public.task_templates
  FOR SELECT USING (is_active = true);

-- =====================================================
-- LEAGUES
-- =====================================================

CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  
  -- Settings
  max_members INTEGER NOT NULL DEFAULT 12,
  min_members INTEGER NOT NULL DEFAULT 4,
  max_custom_tasks INTEGER NOT NULL DEFAULT 2,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leagues_invite_code ON public.leagues(invite_code);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- LEAGUE MEMBERS
-- =====================================================

CREATE TABLE public.league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role league_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(league_id, user_id)
);

CREATE INDEX idx_league_members_league ON public.league_members(league_id);
CREATE INDEX idx_league_members_user ON public.league_members(user_id);

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check league membership
CREATE OR REPLACE FUNCTION public.is_league_member(_user_id UUID, _league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members
    WHERE user_id = _user_id AND league_id = _league_id
  )
$$;

-- Helper function to check league admin status
CREATE OR REPLACE FUNCTION public.is_league_admin(_user_id UUID, _league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members
    WHERE user_id = _user_id 
      AND league_id = _league_id 
      AND role IN ('owner', 'admin')
  )
$$;

-- RLS for leagues (must be after helper functions)
CREATE POLICY "Members can view their leagues" ON public.leagues
  FOR SELECT USING (public.is_league_member(auth.uid(), id));

CREATE POLICY "Admins can update their leagues" ON public.leagues
  FOR UPDATE USING (public.is_league_admin(auth.uid(), id));

CREATE POLICY "Any authenticated user can create a league" ON public.leagues
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS for league_members
CREATE POLICY "Members can view league members" ON public.league_members
  FOR SELECT USING (public.is_league_member(auth.uid(), league_id));

CREATE POLICY "Admins can manage members" ON public.league_members
  FOR ALL USING (public.is_league_admin(auth.uid(), league_id));

CREATE POLICY "Users can join leagues" ON public.league_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave leagues" ON public.league_members
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- SEASONS
-- =====================================================

CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  season_number INTEGER NOT NULL,
  
  status season_status NOT NULL DEFAULT 'draft',
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weeks_count INTEGER NOT NULL DEFAULT 4,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(league_id, season_number)
);

CREATE INDEX idx_seasons_league ON public.seasons(league_id);
CREATE INDEX idx_seasons_status ON public.seasons(status);
CREATE INDEX idx_seasons_dates ON public.seasons(start_date, end_date);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view seasons" ON public.seasons
  FOR SELECT USING (public.is_league_member(auth.uid(), league_id));

CREATE POLICY "Admins can manage seasons" ON public.seasons
  FOR ALL USING (public.is_league_admin(auth.uid(), league_id));

-- =====================================================
-- WEEKS
-- =====================================================

CREATE TABLE public.weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  is_locked BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(season_id, week_number)
);

CREATE INDEX idx_weeks_season ON public.weeks(season_id);
CREATE INDEX idx_weeks_dates ON public.weeks(start_date, end_date);

ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;

-- Helper to check season membership
CREATE OR REPLACE FUNCTION public.is_season_member(_user_id UUID, _season_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seasons s
    JOIN public.league_members lm ON lm.league_id = s.league_id
    WHERE s.id = _season_id AND lm.user_id = _user_id
  )
$$;

CREATE POLICY "Members can view weeks" ON public.weeks
  FOR SELECT USING (public.is_season_member(auth.uid(), season_id));

-- =====================================================
-- MATCHUPS
-- =====================================================

CREATE TABLE public.matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  
  user1_id UUID NOT NULL REFERENCES public.profiles(id),
  user2_id UUID NOT NULL REFERENCES public.profiles(id),
  
  user1_score NUMERIC NOT NULL DEFAULT 0,
  user2_score NUMERIC NOT NULL DEFAULT 0,
  
  winner_id UUID REFERENCES public.profiles(id),
  status matchup_status NOT NULL DEFAULT 'scheduled',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT different_users CHECK (user1_id != user2_id)
);

CREATE INDEX idx_matchups_week ON public.matchups(week_id);
CREATE INDEX idx_matchups_users ON public.matchups(user1_id, user2_id);
CREATE INDEX idx_matchups_status ON public.matchups(status);

ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;

-- Helper to check matchup visibility
CREATE OR REPLACE FUNCTION public.can_view_matchup(_user_id UUID, _matchup_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matchups m
    JOIN public.weeks w ON w.id = m.week_id
    JOIN public.seasons s ON s.id = w.season_id
    JOIN public.league_members lm ON lm.league_id = s.league_id
    WHERE m.id = _matchup_id AND lm.user_id = _user_id
  )
$$;

CREATE POLICY "Members can view matchups" ON public.matchups
  FOR SELECT USING (public.can_view_matchup(auth.uid(), id));

-- =====================================================
-- LEAGUE TASK CONFIGS (Per-season task selection & settings)
-- =====================================================

CREATE TABLE public.league_task_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  
  -- Override settings (merged with template default_config)
  config_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example: {"points_per_unit": 0.02, "cap": 150}
  
  -- League-specific limits
  max_daily_points INTEGER NOT NULL DEFAULT 100,
  
  -- Enabled/ordering
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(season_id, task_template_id)
);

CREATE INDEX idx_league_task_configs_season ON public.league_task_configs(season_id);
CREATE INDEX idx_league_task_configs_template ON public.league_task_configs(task_template_id);
CREATE INDEX idx_league_task_configs_enabled ON public.league_task_configs(is_enabled) WHERE is_enabled = true;

ALTER TABLE public.league_task_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view task configs" ON public.league_task_configs
  FOR SELECT USING (public.is_season_member(auth.uid(), season_id));

CREATE POLICY "Admins can manage task configs" ON public.league_task_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.seasons s
      WHERE s.id = season_id AND public.is_league_admin(auth.uid(), s.league_id)
    )
  );

-- =====================================================
-- USER CUSTOM TASKS
-- =====================================================

CREATE TABLE public.user_custom_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Same config structure as templates
  input_type input_type NOT NULL DEFAULT 'binary',
  unit unit_type NOT NULL DEFAULT 'boolean',
  scoring_type scoring_type NOT NULL DEFAULT 'binary_yesno',
  config JSONB NOT NULL DEFAULT '{"max_points": 50}'::jsonb,
  
  -- Approval
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES public.profiles(id),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_custom_tasks_user ON public.user_custom_tasks(user_id);
CREATE INDEX idx_user_custom_tasks_season ON public.user_custom_tasks(season_id);

ALTER TABLE public.user_custom_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view custom tasks in their seasons" ON public.user_custom_tasks
  FOR SELECT USING (public.is_season_member(auth.uid(), season_id));

CREATE POLICY "Users can create own custom tasks" ON public.user_custom_tasks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND public.is_season_member(auth.uid(), season_id)
  );

CREATE POLICY "Users can update own custom tasks" ON public.user_custom_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can approve custom tasks" ON public.user_custom_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.seasons s
      WHERE s.id = season_id AND public.is_league_admin(auth.uid(), s.league_id)
    )
  );

-- =====================================================
-- TASK INSTANCES (Unified reference for check-ins)
-- =====================================================

-- This table provides a unified way to reference tasks from either
-- league_task_configs (templates) or user_custom_tasks
CREATE TABLE public.task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  
  -- Polymorphic reference (only one should be set)
  league_task_config_id UUID REFERENCES public.league_task_configs(id) ON DELETE CASCADE,
  user_custom_task_id UUID REFERENCES public.user_custom_tasks(id) ON DELETE CASCADE,
  
  -- Denormalized for query performance
  task_name TEXT NOT NULL,
  input_type input_type NOT NULL,
  scoring_type scoring_type NOT NULL,
  config JSONB NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT one_source CHECK (
    (league_task_config_id IS NOT NULL AND user_custom_task_id IS NULL) OR
    (league_task_config_id IS NULL AND user_custom_task_id IS NOT NULL)
  )
);

CREATE INDEX idx_task_instances_season ON public.task_instances(season_id);
CREATE INDEX idx_task_instances_config ON public.task_instances(league_task_config_id);
CREATE INDEX idx_task_instances_custom ON public.task_instances(user_custom_task_id);

ALTER TABLE public.task_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view task instances" ON public.task_instances
  FOR SELECT USING (public.is_season_member(auth.uid(), season_id));

-- =====================================================
-- DAILY CHECK-INS
-- =====================================================

CREATE TABLE public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_instance_id UUID NOT NULL REFERENCES public.task_instances(id) ON DELETE CASCADE,
  
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Input values (use appropriate field based on input_type)
  numeric_value NUMERIC,
  boolean_value BOOLEAN,
  time_value TIME,
  duration_minutes INTEGER,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Example: {"notes": "Great workout!", "location": "gym"}
  
  -- Status
  is_verified BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, task_instance_id, checkin_date)
);

CREATE INDEX idx_daily_checkins_user ON public.daily_checkins(user_id);
CREATE INDEX idx_daily_checkins_task ON public.daily_checkins(task_instance_id);
CREATE INDEX idx_daily_checkins_date ON public.daily_checkins(checkin_date);
CREATE INDEX idx_daily_checkins_user_date ON public.daily_checkins(user_id, checkin_date);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

-- Helper to check checkin access
CREATE OR REPLACE FUNCTION public.can_access_checkin(_user_id UUID, _task_instance_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_instances ti
    WHERE ti.id = _task_instance_id 
      AND public.is_season_member(_user_id, ti.season_id)
  )
$$;

CREATE POLICY "Users can view checkins in their leagues" ON public.daily_checkins
  FOR SELECT USING (public.can_access_checkin(auth.uid(), task_instance_id));

CREATE POLICY "Users can create own checkins" ON public.daily_checkins
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND public.can_access_checkin(auth.uid(), task_instance_id)
  );

CREATE POLICY "Users can update own checkins" ON public.daily_checkins
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- SCORING EVENTS (Audit Trail)
-- =====================================================

CREATE TABLE public.scoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_checkin_id UUID NOT NULL REFERENCES public.daily_checkins(id) ON DELETE CASCADE,
  
  -- What scoring rule was applied
  scoring_type scoring_type NOT NULL,
  rule_applied TEXT NOT NULL,
  -- Example: "linear_per_unit: 12500 steps * 0.01 = 125, capped at 100"
  
  -- Scoring details
  raw_value NUMERIC NOT NULL,
  points_before_cap NUMERIC NOT NULL,
  points_awarded NUMERIC NOT NULL,
  
  -- Derived values for transparency
  derived_values JSONB DEFAULT '{}'::jsonb,
  -- Example: {"unit_size": 1000, "units_completed": 12.5, "cap_applied": true}
  
  -- Version tracking (if scoring rules change)
  config_snapshot JSONB NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scoring_events_checkin ON public.scoring_events(daily_checkin_id);
CREATE INDEX idx_scoring_events_created ON public.scoring_events(created_at);

ALTER TABLE public.scoring_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scoring for accessible checkins" ON public.scoring_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.daily_checkins dc
      WHERE dc.id = daily_checkin_id 
        AND public.can_access_checkin(auth.uid(), dc.task_instance_id)
    )
  );

-- =====================================================
-- WEEKLY SCORES (Materialized Totals)
-- =====================================================

CREATE TABLE public.weekly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  
  total_points NUMERIC NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  perfect_days INTEGER NOT NULL DEFAULT 0,
  
  -- Breakdown by task (for analytics)
  points_by_task JSONB DEFAULT '{}'::jsonb,
  -- Example: {"task_id_1": 150, "task_id_2": 75}
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, week_id)
);

CREATE INDEX idx_weekly_scores_user ON public.weekly_scores(user_id);
CREATE INDEX idx_weekly_scores_week ON public.weekly_scores(week_id);
CREATE INDEX idx_weekly_scores_points ON public.weekly_scores(total_points DESC);

ALTER TABLE public.weekly_scores ENABLE ROW LEVEL SECURITY;

-- Helper for weekly scores access
CREATE OR REPLACE FUNCTION public.can_view_weekly_score(_user_id UUID, _week_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.weeks w
    WHERE w.id = _week_id 
      AND public.is_season_member(_user_id, w.season_id)
  )
$$;

CREATE POLICY "Members can view weekly scores" ON public.weekly_scores
  FOR SELECT USING (public.can_view_weekly_score(auth.uid(), week_id));

-- =====================================================
-- SEASON STANDINGS
-- =====================================================

CREATE TABLE public.season_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  
  -- Win/Loss record
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  ties INTEGER NOT NULL DEFAULT 0,
  
  -- Points
  total_points NUMERIC NOT NULL DEFAULT 0,
  points_for NUMERIC NOT NULL DEFAULT 0,
  points_against NUMERIC NOT NULL DEFAULT 0,
  
  -- Ranking
  current_rank INTEGER,
  highest_weekly_score NUMERIC DEFAULT 0,
  lowest_weekly_score NUMERIC,
  
  -- Streak tracking
  current_streak INTEGER NOT NULL DEFAULT 0,
  streak_type TEXT, -- 'W' or 'L'
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, season_id)
);

CREATE INDEX idx_season_standings_season ON public.season_standings(season_id);
CREATE INDEX idx_season_standings_rank ON public.season_standings(season_id, current_rank);
CREATE INDEX idx_season_standings_wins ON public.season_standings(season_id, wins DESC);

ALTER TABLE public.season_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view standings" ON public.season_standings
  FOR SELECT USING (public.is_season_member(auth.uid(), season_id));

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_task_templates_updated_at BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_leagues_updated_at BEFORE UPDATE ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_matchups_updated_at BEFORE UPDATE ON public.matchups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_league_task_configs_updated_at BEFORE UPDATE ON public.league_task_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_user_custom_tasks_updated_at BEFORE UPDATE ON public.user_custom_tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_daily_checkins_updated_at BEFORE UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_weekly_scores_updated_at BEFORE UPDATE ON public.weekly_scores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_season_standings_updated_at BEFORE UPDATE ON public.season_standings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.season_standings;

-- =====================================================
-- SEED DATA: 10 TASK TEMPLATES
-- =====================================================

INSERT INTO public.task_templates (name, description, category, icon, input_type, unit, scoring_type, default_config, min_value, max_value) VALUES
-- Fitness
('Daily Steps', 'Track your daily step count', 'fitness', 'footprints', 'numeric', 'steps', 'linear_per_unit', 
  '{"points_per_unit": 0.01, "unit_size": 1000, "cap": 100, "target": 10000}'::jsonb, 0, 50000),

('Workout', 'Complete a workout session', 'fitness', 'dumbbell', 'duration', 'minutes', 'threshold',
  '{"threshold": 30, "points_at_threshold": 50, "bonus_per_minute": 1, "cap": 75}'::jsonb, 0, 180),

('Active Minutes', 'Minutes of moderate to vigorous activity', 'fitness', 'activity', 'numeric', 'minutes', 'tiered',
  '{"tiers": [{"min": 0, "max": 15, "points": 15}, {"min": 15, "max": 30, "points": 35}, {"min": 30, "max": 60, "points": 50}], "cap": 50}'::jsonb, 0, 120),

-- Learning
('Reading', 'Pages or minutes of reading', 'learning', 'book-open', 'numeric', 'pages', 'linear_per_unit',
  '{"points_per_unit": 2, "unit_size": 1, "cap": 50, "target": 25}'::jsonb, 0, 100),

('Learning Time', 'Time spent learning something new', 'learning', 'graduation-cap', 'duration', 'minutes', 'linear_per_unit',
  '{"points_per_unit": 1.5, "unit_size": 1, "cap": 45, "target": 30}'::jsonb, 0, 120),

-- Wellness
('Journaling', 'Write in your journal', 'mindfulness', 'pencil', 'binary', 'boolean', 'binary_yesno',
  '{"max_points": 40}'::jsonb, NULL, NULL),

('Meditation', 'Practice meditation or mindfulness', 'mindfulness', 'brain', 'duration', 'minutes', 'tiered',
  '{"tiers": [{"min": 5, "max": 10, "points": 20}, {"min": 10, "max": 20, "points": 35}, {"min": 20, "max": 999, "points": 50}], "minimum": 5}'::jsonb, 0, 60),

-- Sleep
('Bedtime', 'Go to bed by target time', 'sleep', 'moon', 'time', 'bedtime_time', 'time_before',
  '{"target_time": "22:30", "points_on_time": 50, "penalty_per_minute": 1, "grace_minutes": 15}'::jsonb, NULL, NULL),

('Wake Time', 'Wake up by target time', 'sleep', 'sun', 'time', 'waketime_time', 'time_before',
  '{"target_time": "06:30", "points_on_time": 50, "penalty_per_minute": 1, "grace_minutes": 15}'::jsonb, NULL, NULL),

-- Nutrition
('Water Intake', 'Glasses of water consumed', 'nutrition', 'droplet', 'numeric', 'count', 'threshold',
  '{"threshold": 8, "points_at_threshold": 40, "partial_points_per_unit": 4}'::jsonb, 0, 20);
