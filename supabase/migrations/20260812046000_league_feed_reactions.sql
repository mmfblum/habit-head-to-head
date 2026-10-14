CREATE TABLE IF NOT EXISTS public.feed_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_key, user_id),
  CONSTRAINT feed_reaction_emoji_check CHECK (emoji IN ('🔥','😂','💀','👏','😤'))
);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_league_event ON public.feed_reactions(league_id,event_key);
ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feed_reactions_select ON public.feed_reactions;
CREATE POLICY feed_reactions_select ON public.feed_reactions FOR SELECT TO authenticated USING (public.is_league_member(auth.uid(), league_id));
DROP POLICY IF EXISTS feed_reactions_insert ON public.feed_reactions;
CREATE POLICY feed_reactions_insert ON public.feed_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_league_member(auth.uid(), league_id));
DROP POLICY IF EXISTS feed_reactions_update ON public.feed_reactions;
CREATE POLICY feed_reactions_update ON public.feed_reactions FOR UPDATE TO authenticated USING (auth.uid() = user_id AND public.is_league_member(auth.uid(), league_id)) WITH CHECK (auth.uid() = user_id AND public.is_league_member(auth.uid(), league_id));
DROP POLICY IF EXISTS feed_reactions_delete ON public.feed_reactions;
CREATE POLICY feed_reactions_delete ON public.feed_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id AND public.is_league_member(auth.uid(), league_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_reactions TO authenticated;
REVOKE ALL ON public.feed_reactions FROM anon;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='feed_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_reactions;
  END IF;
END $$;
