CREATE FUNCTION public.get_pool_ranking(p_pool_id uuid)
RETURNS TABLE (
  id uuid,
  pool_id uuid,
  name text,
  initials text,
  numbers integer[],
  hits integer,
  is_me boolean,
  prize_amount numeric,
  official_numbers integer[],
  created_at timestamp with time zone,
  rounds_published integer,
  goal integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH base AS (
    SELECT
      h.bet_id AS bet_id,
      h.user_id,
      h.numbers,
      h.created_at,
      h.hits,
      h.rounds_published,
      h.official_numbers,
      COALESCE(pa.amount, 0)::numeric AS prize_amount,
      regexp_replace(btrim(COALESCE(pr.full_name, '')), '\s+', ' ', 'g') AS full_name
    FROM public.pool_bet_hits(p_pool_id) h
    LEFT JOIN public.profiles pr ON pr.id = h.user_id
    LEFT JOIN public.prize_awards pa ON pa.purchased_bet_id = h.bet_id
  )
  SELECT
    b.bet_id,
    p_pool_id,
    CASE
      WHEN b.full_name = '' THEN 'Apostador'
      WHEN strpos(b.full_name, ' ') = 0 THEN left(b.full_name, 40)
      ELSE left(split_part(b.full_name, ' ', 1), 40) || ' ' || upper(left(reverse(split_part(reverse(b.full_name), ' ', 1)), 1)) || '.'
    END AS name,
    CASE
      WHEN b.full_name = '' THEN 'AP'
      ELSE upper(left(b.full_name, 1) || left(reverse(split_part(reverse(b.full_name), ' ', 1)), 1))
    END AS initials,
    b.numbers,
    b.hits,
    (b.user_id = auth.uid()) AS is_me,
    b.prize_amount,
    b.official_numbers,
    b.created_at,
    b.rounds_published,
    6 AS goal
  FROM base b
  ORDER BY b.created_at ASC;
$function$