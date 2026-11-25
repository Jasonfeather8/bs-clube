CREATE OR REPLACE FUNCTION public.get_own_bets()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'É necessário estar autenticado';
  END IF;

  SELECT COALESCE(jsonb_agg(sub.b ORDER BY sub.b_created DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'bet_id', pb.id,
        'pool_id', pb.pool_id,
        'pool_name', COALESCE(p.name, 'Bolão'),
        'contest', COALESCE(d.contest, ''),
        'draw_date', d.draw_date,
        'numbers', pb.numbers,
        'cota_price', pb.cota_price,
        'created_at', pb.created_at,
        'pool_status', COALESCE(p.status, ''),
        'is_published', COALESCE(d.is_published, false),
        'official_numbers', CASE
          WHEN d.is_published AND d.numbers IS NOT NULL THEN d.numbers
          ELSE ARRAY[]::integer[]
        END,
        'hits', CASE
          WHEN d.is_published AND d.numbers IS NOT NULL AND cardinality(d.numbers) > 0
          THEN (SELECT count(*) FROM unnest(pb.numbers) AS n WHERE n = ANY(d.numbers))::int
          ELSE 0
        END,
        'prize_amount', COALESCE(pa.amount, 0)
      ) AS b,
      pb.created_at AS b_created
    FROM public.purchased_bets pb
    LEFT JOIN public.pools p ON p.id = pb.pool_id
    LEFT JOIN public.draws d ON d.id = p.draw_id
    LEFT JOIN public.prize_awards pa ON pa.purchased_bet_id = pb.id
    WHERE pb.user_id = v_user
    ORDER BY pb.created_at DESC
  ) sub;

  RETURN v_result;
END;
$function$;