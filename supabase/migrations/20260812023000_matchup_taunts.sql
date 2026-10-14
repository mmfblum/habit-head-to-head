-- =============================================================================
-- MATCHUP TAUNTS
-- =============================================================================
-- Lightweight rivalry interaction: a participant can send a short taunt during
-- a live matchup. It appears in the league feed and creates an in-app
-- notification for the opponent.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.send_matchup_taunt(
    _matchup_id UUID,
    _body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    matchup_rec RECORD;
    sender_id UUID := auth.uid();
    opponent_id UUID;
    sender_name TEXT;
    opponent_name TEXT;
    event_id UUID;
    clean_body TEXT := btrim(_body);
BEGIN
    IF sender_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF clean_body IS NULL OR length(clean_body) = 0 THEN
        RAISE EXCEPTION 'Taunt cannot be empty';
    END IF;

    IF length(clean_body) > 160 THEN
        RAISE EXCEPTION 'Taunt must be 160 characters or fewer';
    END IF;

    SELECT
        m.id,
        m.user1_id,
        m.user2_id,
        m.status,
        s.league_id
    INTO matchup_rec
    FROM public.matchups m
    JOIN public.weeks w ON w.id = m.week_id
    JOIN public.seasons s ON s.id = w.season_id
    WHERE m.id = _matchup_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Matchup not found';
    END IF;

    IF matchup_rec.status <> 'in_progress' THEN
        RAISE EXCEPTION 'Taunts open when the matchup goes live';
    END IF;

    IF sender_id = matchup_rec.user1_id THEN
        opponent_id := matchup_rec.user2_id;
    ELSIF sender_id = matchup_rec.user2_id THEN
        opponent_id := matchup_rec.user1_id;
    ELSE
        RAISE EXCEPTION 'Only matchup participants can send taunts';
    END IF;

    SELECT COALESCE(p.display_name, 'Opponent')
    INTO sender_name
    FROM public.profiles p
    WHERE p.id = sender_id;

    SELECT COALESCE(p.display_name, 'Opponent')
    INTO opponent_name
    FROM public.profiles p
    WHERE p.id = opponent_id;

    INSERT INTO public.league_events (
        league_id,
        event_type,
        title,
        body,
        actor_user_id
    ) VALUES (
        matchup_rec.league_id,
        'taunt',
        sender_name || ' → ' || opponent_name,
        clean_body,
        sender_id
    )
    RETURNING id INTO event_id;

    INSERT INTO public.user_notifications (
        user_id,
        league_id,
        type,
        title,
        body,
        notify_date
    ) VALUES (
        opponent_id,
        matchup_rec.league_id,
        'matchup_taunt',
        'Taunt from ' || sender_name,
        clean_body,
        NULL
    );

    RETURN event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_matchup_taunt(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_matchup_taunt(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.send_matchup_taunt IS
'Sends a short taunt between live matchup participants, creating a league feed event and opponent notification.';
