UPDATE public.competitors
SET is_house = true, updated_at = now()
WHERE nome ILIKE '%cn cold%' OR nome ILIKE '%cncold%' OR nome ILIKE '%cn-cold%';