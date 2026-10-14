UPDATE public.season_standings ss
SET championship_points = ss.total_points::INT,
    updated_at = now()
FROM public.seasons s
JOIN public.leagues l ON l.id = s.league_id
WHERE ss.season_id = s.id
  AND l.game_format = 'leaderboard';