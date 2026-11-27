CREATE OR REPLACE FUNCTION public.pool_bet_hits(p_pool_id uuid)
RETURNS TABLE (
  bet_id uuid,
  user_id uuid,
  numbers integer[],
  created_at timestamp with time zone,
  hits integer,
  rounds_published integer,
  official_numbers integer[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH rounds AS (
    SELECT pr.draw_id, d.numbers
    FROM public.pool_rounds pr
    JOIN public.draws d ON d.id = pr.draw_id
    WHERE pr.pool_id = p_pool_id AND d.is_published
  ),
  drawn AS (
    SELECT DISTINCT item.number AS number
    FROM rounds r
    CROSS JOIN LATERAL unnest(r.numbers) AS item(number)
  )
  SELECT
    pb.id,
    pb.user_id,
    pb.numbers,
    pb.created_at,
    (SELECT count(*) FROM unnest(pb.numbers) AS b(num) WHERE b.num IN (SELECT number FROM drawn))::integer AS hits,
    (SELECT count(*) FROM rounds)::integer AS rounds_published,
    COALESCE((SELECT array_agg(drawn.number ORDER BY drawn.number) FROM drawn), ARRAY[]::integer[]) AS official_numbers
  FROM public.purchased_bets pb
  WHERE pb.pool_id = p_pool_id;
$function$