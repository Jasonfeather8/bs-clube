CREATE OR REPLACE FUNCTION public.get_admin_pool_participants(p_pool_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;

  SELECT jsonb_build_object(
    'pool', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'buy_in', p.buy_in,
      'filled_slots', p.filled_slots,
      'total_slots', p.total_slots,
      'prize_estimate', p.prize_estimate,
      'house_percentage', p.house_percentage,
      'winner_percentage', p.winner_percentage,
      'status', p.status,
      'created_at', p.created_at,
      'current_round', p.current_round,
      'max_rounds', p.max_rounds,
      'settled_at', p.settled_at,
      'category_name', COALESCE(pc.name, '')
    ),
    'draw', CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', d.id,
      'contest', d.contest,
      'draw_date', d.draw_date,
      'numbers', d.numbers,
      'is_published', d.is_published
    ) END,
    'settlement', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', s.id,
      'gross_amount', s.gross_amount,
      'house_amount', s.house_amount,
      'winners_amount', s.winners_amount,
      'winner_count', s.winner_count,
      'status', s.status,
      'created_at', s.created_at
    ) END,
    'rounds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'draw_id', pr.draw_id,
        'round_number', pr.round_number,
        'contest', rd.contest,
        'draw_date', rd.draw_date,
        'numbers', rd.numbers,
        'is_published', rd.is_published,
        'published_at', pr.published_at
      ) ORDER BY pr.round_number)
      FROM public.pool_rounds pr
      JOIN public.draws rd ON rd.id = pr.draw_id
      WHERE pr.pool_id = p.id
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'participants_count', COALESCE((SELECT count(DISTINCT pb.user_id) FROM public.purchased_bets pb WHERE pb.pool_id = p.id), 0),
      'bets_count', COALESCE((SELECT count(*) FROM public.purchased_bets pb WHERE pb.pool_id = p.id), 0),
      'gross_amount', COALESCE((SELECT sum(pb.cota_price) FROM public.purchased_bets pb WHERE pb.pool_id = p.id), 0),
      'rounds_published', COALESCE((SELECT count(*) FROM public.pool_rounds pr WHERE pr.pool_id = p.id), 0)
    ),
    'participants', COALESCE((
      SELECT jsonb_agg(sub.row_data ORDER BY sub.created_at, sub.bet_id)
      FROM (
        SELECT
          pb.id AS bet_id,
          pb.created_at AS created_at,
          jsonb_build_object(
            'bet_id', pb.id,
            'user_id', pb.user_id,
            'name', COALESCE(NULLIF(pr2.full_name, ''), 'Apostador'),
            'email', COALESCE(au.email, ''),
            'phone', COALESCE(pr2.phone, ''),
            'cpf', COALESCE(pr2.cpf, ''),
            'numbers', pb.numbers,
            'cota_price', pb.cota_price,
            'created_at', pb.created_at,
            'hits', COALESCE(h.hits, 0),
            'prize_amount', COALESCE(pa.amount, 0)
          ) AS row_data
        FROM public.purchased_bets pb
        LEFT JOIN public.profiles pr2 ON pr2.id = pb.user_id
        LEFT JOIN auth.users au ON au.id = pb.user_id
        LEFT JOIN public.prize_awards pa ON pa.purchased_bet_id = pb.id
        LEFT JOIN LATERAL public.pool_bet_hits(p.id) h ON h.bet_id = pb.id
        WHERE pb.pool_id = p.id
      ) sub
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.pools p
  LEFT JOIN public.pool_categories pc ON pc.id = p.category_id
  LEFT JOIN public.draws d ON d.id = p.draw_id
  LEFT JOIN public.prize_settlements s ON s.pool_id = p.id
  WHERE p.id = p_pool_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Bolão não encontrado';
  END IF;

  RETURN v_result;
END;
$function$