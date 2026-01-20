-- Fix league_members SELECT policy to allow users to see their own memberships
DROP POLICY IF EXISTS "Members can view league members" ON public.league_members;

CREATE POLICY "Members can view league members" ON public.league_members
  FOR SELECT USING (
    auth.uid() = user_id 
    OR public.is_league_member(auth.uid(), league_id)
  );