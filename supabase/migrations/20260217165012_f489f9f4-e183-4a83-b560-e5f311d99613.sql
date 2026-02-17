-- Allow authenticated users to find leagues by invite code (needed for joining)
CREATE POLICY "Authenticated users can find leagues by invite code"
ON public.leagues
FOR SELECT
USING (auth.uid() IS NOT NULL AND invite_code IS NOT NULL);