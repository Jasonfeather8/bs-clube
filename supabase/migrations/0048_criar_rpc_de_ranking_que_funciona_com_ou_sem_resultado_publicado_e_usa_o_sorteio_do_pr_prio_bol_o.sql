CREATE OR REPLACE FUNCTION public.get_pool_ranking(p_pool_id uuid)
 RETURNS TABLE(
   id uuid,
   pool_id uuid,
   name text,
   initials text,
   numbers integer[],
   hits integer,
   is_me boolean,
   prize_amount numeric,
   official_numbers integer[],
   created_at timestamp with time zone
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH src AS (
  SELECT
    pb.id,
    pb.pool_id,
    pb.user_id,
    pb.numbers,
    pb.created_at,
    COALESCE(pa.amount, 0)::numeric AS prize_amount,
    COALESCE(d.is_published, false) AS is_published,
    d.numbers AS official_numbers_raw,
    regexp_replace(btrim(COALESCE(pr.full_name, '')), '\s+', ' ', 'g') AS full_name
  FROM public.purchased_bets pb
  LEFT JOIN public.pools p ON p.id = pb.pool_id
  LEFT JOIN public.draws d ON d.id = p.draw_id
  LEFT JOIN public.profiles pr ON pr.id = pb.user_id
  LEFT JOIN public.prize_awards pa ON pa.purchased_bet_id = pb.id
  WHERE pb.pool_id = p_pool_id
)
SELECT
  s.id,
  s.pool_id,
  CASE
    WHEN s.full_name = '' THEN 'Apostador'
    WHEN strpos(s.full_name, ' ') = 0 THEN left(s.full_name, 40)
    ELSE left(split_part(s.full_name, ' ', 1), 40) || ' ' || upper(left(reverse(split_part(reverse(s.full_name), ' ', 1)), 1)) || '.'
  END AS name,
  CASE
    WHEN s.full_name = '' THEN 'AP'
    ELSE upper(left(s.full_name, 1) || left(reverse(split_part(reverse(s.full_name), ' ', 1)), 1))
  END AS initials,
  s.numbers,
  CASE
    WHEN s.is_published AND s.official_numbers_raw IS NOT NULL AND cardinality(s.official_numbers_raw) > 0
    THEN (COUNT(*) FILTER (WHERE bet_number.number = ANY (s.official_numbers_raw)))::integer
    ELSE 0
  END AS hits,
  (s.user_id = auth.uid()) AS is_me,
  s.prize_amount,
  CASE
    WHEN s.is_published AND s.official_numbers_raw IS NOT NULL THEN s.official_numbers_raw
    ELSE ARRAY[]::integer[]
  END AS official_numbers,
  s.created_at
FROM src s
CROSS JOIN LATERAL unnest(s.numbers) AS bet_number(number)
GROUP BY s.id, s.pool_id, s.user_id, s.numbers, s.created_at, s.prize_amount, s.full_name, s.is_published, s.official_numbers_raw
ORDER BY s.created_at ASC;
$function$;