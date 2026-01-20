-- 1. Add created_by column to leagues
ALTER TABLE public.leagues 
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- 2. Add SELECT policy for creators
CREATE POLICY "Creators can view their leagues" ON public.leagues
  FOR SELECT USING (auth.uid() = created_by);

-- 3. Update INSERT policy to require created_by
DROP POLICY "Any authenticated user can create a league" ON public.leagues;

CREATE POLICY "Authenticated users can create leagues" ON public.leagues
  FOR INSERT WITH CHECK (auth.uid() = created_by);