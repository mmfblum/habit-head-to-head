
-- Create user_notifications table
CREATE TABLE public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notify_date DATE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate daily notifications
ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_unique_daily UNIQUE (user_id, type, notify_date);

-- Enable RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own notifications
CREATE POLICY "Users can insert own notifications"
  ON public.user_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Create league_events table
CREATE TABLE public.league_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  actor_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.league_events ENABLE ROW LEVEL SECURITY;

-- League members can read events
CREATE POLICY "League members can read events"
  ON public.league_events FOR SELECT
  USING (public.is_league_member(auth.uid(), league_id));

-- Authenticated users can insert events
CREATE POLICY "Authenticated users can insert events"
  ON public.league_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
