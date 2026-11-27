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
        'contest', COALESCE(lr.contest, d.contest, ''),
        'draw_date', COALESCE(lr.draw_date, d.draw_date),
        'numbers', pb.numbers,
        'cota_price', pb.cota_price,
        'created_at', pb.created_at,
        'pool_status', COALESCE(p.status, ''),
        'is_published', COALESCE(h.rounds_published, 0) > 0,
        'official_numbers', COALESCE(h.official_numbers, ARRAY[]::integer[]),
        'hits', COALESCE(h.hits, 0),
        'goal', 6,
        'rounds_published', COALESCE(h.rounds_published, 0),
        'current_round', COALESCE(p.current_round, 0),
        'max_rounds', COALESCE(p.max_rounds, 20),
        'rounds', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'round_number', pr.round_number,
            'contest', rd.contest,
            'draw_date', rd.draw_date,
            'numbers', rd.numbers,
            'hits', (SELECT count(*) FROM unnest(pb.numbers) AS b(num) WHERE b.num = ANY(rd.numbers))::integer
          ) ORDER BY pr.round_number)
          FROM public.pool_rounds pr
          JOIN public.draws rd ON rd.id = pr.draw_id
          WHERE pr.pool_id = pb.pool_id AND rd.is_published
        ), '[]'::jsonb),
        'prize_amount', COALESCE(pa.amount, 0)
      ) AS b,
      pb.created_at AS b_created
    FROM public.purchased_bets pb
    LEFT JOIN public.pools p ON p.id = pb.pool_id
    LEFT JOIN public.draws d ON d.id = p.draw_id
    LEFT JOIN public.prize_awards pa ON pa.purchased_bet_id = pb.id
    LEFT JOIN LATERAL public.pool_bet_hits(pb.pool_id) h ON h.bet_id = pb.id
    LEFT JOIN LATERAL (
      SELECT rd.contest, rd.draw_date
      FROM public.pool_rounds pr
      JOIN public.draws rd ON rd.id = pr.draw_id
      WHERE pr.pool_id = pb.pool_id AND rd.is_published
      ORDER BY pr.round_number DESC
      LIMIT 1
    ) lr ON true
    WHERE pb.user_id = v_user
    ORDER BY pb.created_at DESC
  ) sub;

  RETURN v_result;
END;
$function$