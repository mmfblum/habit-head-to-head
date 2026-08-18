REVOKE ALL ON public.punishment_options FROM anon;
REVOKE ALL ON public.punishment_spins FROM anon;
REVOKE SELECT ON public.accountability_shares FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_accountability_share(_league_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_share RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_league_member(auth.uid(),_league_id) THEN RAISE EXCEPTION 'You must belong to this league'; END IF;
  SELECT id,token,is_active INTO v_share FROM public.accountability_shares WHERE league_id=_league_id AND user_id=auth.uid();
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',v_share.id,'token',v_share.token,'is_active',v_share.is_active);
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_accountability_share(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_accountability_share(UUID) TO authenticated;
DROP FUNCTION IF EXISTS public.create_league(TEXT,TEXT);
