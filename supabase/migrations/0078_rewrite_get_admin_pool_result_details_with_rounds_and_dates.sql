CREATE OR REPLACE FUNCTION public.get_admin_pool_result_details(p_pool_id uuid)
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
      'house_percentage', p.house_percentage,
      'winner_percentage', p.winner_percentage,
      'status', p.status,
      'created_at', p.created_at,
      'current_round', p.current_round,
      'max_rounds', p.max_rounds,
      'settled_at', p.settled_at
    ),
    'draw', jsonb_build_object(
      'id', d.id,
      'contest', d.contest,
      'draw_date', d.draw_date,
      'numbers', d.numbers
    ),
    'settlement', jsonb_build_object(
      'id', s.id,
      'gross_amount', s.gross_amount,
      'house_amount', s.house_amount,
      'winners_amount', s.winners_amount,
      'winner_count', s.winner_count,
      'status', s.status,
      'created_at', s.created_at
    ),
    'rounds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'draw_id', pr.draw_id,
        'round_number', pr.round_number,
        'contest', rd.contest,
        'draw_date', rd.draw_date,
        'numbers', rd.numbers,
        'published_at', pr.published_at
      ) ORDER BY pr.round_number)
      FROM public.pool_rounds pr
      JOIN public.draws rd ON rd.id = pr.draw_id
      WHERE pr.pool_id = p.id
    ), '[]'::jsonb),
    'participants_count', (
      SELECT count(DISTINCT pb.user_id)::integer
      FROM public.purchased_bets pb
      WHERE pb.pool_id = p.id
    ),
    'bets_count', (
      SELECT count(*)::integer
      FROM public.purchased_bets pb
      WHERE pb.pool_id = p.id
    ),
    'winners', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'award_id', pa.id,
          'user_id', pa.user_id,
          'name', pa.winner_name,
          'email', pa.winner_email,
          'phone', pa.winner_phone,
          'cpf', pa.winner_cpf,
          'pix_key_type', pa.pix_key_type,
          'pix_key', pa.pix_key,
          'hits', pa.hits,
          'amount', pa.amount,
          'numbers', pb.numbers,
          'played_at', pb.created_at,
          'awarded_at', pa.created_at
        )
        ORDER BY pa.created_at, pa.id
      )
      FROM public.prize_awards pa
      JOIN public.purchased_bets pb ON pb.id = pa.purchased_bet_id
      WHERE pa.pool_id = p.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.pools p
  JOIN public.draws d ON d.id = p.draw_id
  JOIN public.prize_settlements s ON s.pool_id = p.id
  WHERE p.id = p_pool_id
    AND p.status = 'completed';

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Resultado concluído não encontrado para este bolão';
  END IF;

  RETURN v_result;
END;
$function$