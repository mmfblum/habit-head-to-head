-- Allow league owners to delete their leagues
CREATE POLICY "Owners can delete their leagues"
ON public.leagues
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM league_members
    WHERE league_members.league_id = leagues.id
    AND league_members.user_id = auth.uid()
    AND league_members.role = 'owner'
  )
);