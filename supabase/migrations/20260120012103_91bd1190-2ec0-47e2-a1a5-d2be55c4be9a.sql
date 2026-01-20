
-- Create enum for task types
CREATE TYPE public.task_type AS ENUM ('steps', 'workout', 'reading', 'sleep_bedtime', 'sleep_wake', 'journaling', 'custom_binary', 'custom_numeric');

-- Create task_templates table (default/hard-coded tasks)
CREATE TABLE public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  task_type task_type NOT NULL,
  icon TEXT NOT NULL DEFAULT 'activity',
  points_per_unit NUMERIC NOT NULL DEFAULT 1,
  max_points INTEGER NOT NULL DEFAULT 100,
  target NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create custom_tasks table (user-defined tasks)
CREATE TABLE public.custom_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  task_type task_type NOT NULL CHECK (task_type IN ('custom_binary', 'custom_numeric')),
  points_per_unit NUMERIC NOT NULL DEFAULT 10,
  max_points INTEGER NOT NULL DEFAULT 50,
  target NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create task_completions table (daily task tracking)
CREATE TABLE public.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_template_id UUID REFERENCES public.task_templates(id) ON DELETE CASCADE,
  custom_task_id UUID REFERENCES public.custom_tasks(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value NUMERIC NOT NULL DEFAULT 0,
  points_earned NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_task_reference CHECK (
    (task_template_id IS NOT NULL AND custom_task_id IS NULL) OR
    (task_template_id IS NULL AND custom_task_id IS NOT NULL)
  ),
  UNIQUE (user_id, task_template_id, completion_date),
  UNIQUE (user_id, custom_task_id, completion_date)
);

-- Enable RLS
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

-- Task templates policies (everyone can read active templates)
CREATE POLICY "Anyone can view active task templates"
  ON public.task_templates FOR SELECT
  USING (is_active = true);

-- Custom tasks policies
CREATE POLICY "Users can view their own custom tasks"
  ON public.custom_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom tasks"
  ON public.custom_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom tasks"
  ON public.custom_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom tasks"
  ON public.custom_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Task completions policies
CREATE POLICY "Users can view their own completions"
  ON public.task_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own completions"
  ON public.task_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own completions"
  ON public.task_completions FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert default task templates
INSERT INTO public.task_templates (name, description, task_type, icon, points_per_unit, max_points, target, unit) VALUES
  ('Steps', 'Track your daily steps', 'steps', 'footprints', 0.01, 100, 10000, 'steps'),
  ('Workout', 'Complete a workout session', 'workout', 'dumbbell', 25, 50, 2, 'workouts'),
  ('Reading', 'Read books or articles', 'reading', 'book-open', 1, 30, 30, 'minutes'),
  ('Bedtime', 'Get to bed before target time', 'sleep_bedtime', 'moon', 20, 20, 1, null),
  ('Wake Up', 'Wake up before target time', 'sleep_wake', 'sun', 20, 20, 1, null),
  ('Journaling', 'Write in your journal', 'journaling', 'pencil', 15, 15, 1, null);

-- Enable realtime for task_completions
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_completions;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at_task_templates
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_custom_tasks
  BEFORE UPDATE ON public.custom_tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_task_completions
  BEFORE UPDATE ON public.task_completions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
