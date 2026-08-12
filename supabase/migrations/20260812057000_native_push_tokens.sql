CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  token TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id
  ON public.device_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_enabled_user
  ON public.device_push_tokens(user_id, enabled)
  WHERE enabled = TRUE;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Tokens are credentials for notification delivery. Clients never read or write
-- the table directly; authenticated users register/unregister through narrow RPCs.
REVOKE ALL ON TABLE public.device_push_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.device_push_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.register_push_token(_platform TEXT, _token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_platform TEXT := lower(btrim(_platform));
  v_token TEXT := btrim(_token);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_platform NOT IN ('ios', 'android') THEN RAISE EXCEPTION 'Unsupported push platform'; END IF;
  IF length(v_token) < 16 OR length(v_token) > 4096 THEN RAISE EXCEPTION 'Invalid push token'; END IF;

  INSERT INTO public.device_push_tokens(user_id, platform, token, enabled, last_seen_at, updated_at)
  VALUES(v_user, v_platform, v_token, TRUE, now(), now())
  ON CONFLICT(platform, token) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      enabled = TRUE,
      last_seen_at = now(),
      updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_token(_platform TEXT, _token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  UPDATE public.device_push_tokens
  SET enabled = FALSE, updated_at = now()
  WHERE user_id = v_user
    AND platform = lower(btrim(_platform))
    AND token = btrim(_token);
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unregister_push_token(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_token(TEXT, TEXT) TO authenticated;
