CREATE OR REPLACE FUNCTION public.get_admin_user_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Apostador não encontrado';
  END IF;

  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', pr.id,
      'full_name', pr.full_name,
      'email', au.email,
      'phone', pr.phone,
      'cpf', pr.cpf,
      'pix_key_type', pr.pix_key_type,
      'pix_key', pr.pix_key,
      'avatar_url', pr.avatar_url,
      'is_active', pr.is_active,
      'created_at', pr.created_at
    ),
    'wallet', jsonb_build_object(
      'total', COALESCE(wa.total, 0),
      'withdrawable', COALESCE(wa.withdrawable, 0),
      'bonus', COALESCE(wa.bonus, 0),
      'created_at', wa.created_at
    ),
    'stats', jsonb_build_object(
      'bets_count', COALESCE((SELECT count(*) FROM public.purchased_bets pb WHERE pb.user_id = pr.id), 0),
      'total_wagered', COALESCE((SELECT sum(pb.cota_price) FROM public.purchased_bets pb WHERE pb.user_id = pr.id), 0),
      'prizes_count', COALESCE((SELECT count(*) FROM public.prize_awards pa WHERE pa.user_id = pr.id), 0),
      'prizes_amount', COALESCE((SELECT sum(pa.amount) FROM public.prize_awards pa WHERE pa.user_id = pr.id), 0),
      'withdrawals_count', COALESCE((SELECT count(*) FROM public.withdrawals w WHERE w.user_id = pr.id), 0),
      'withdrawals_paid', COALESCE((SELECT sum(w.amount) FROM public.withdrawals w WHERE w.user_id = pr.id AND w.status = 'approved'), 0),
      'deposits_total', COALESCE((SELECT sum(p.amount) FROM public.payments p WHERE p.user_id = pr.id AND p.kind = 'deposit' AND p.status = 'confirmed'), 0)
    ),
    'bets', COALESCE((
      SELECT jsonb_agg(sub.b ORDER BY sub.b_created DESC)
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
            'hits', COALESCE(h.hits, 0),
            'goal', 6,
            'rounds_published', COALESCE(h.rounds_published, 0),
            'prize_amount', COALESCE(pa.amount, 0),
            'pool_status', COALESCE(p.status, '')
          ) AS b,
          pb.created_at AS b_created
        FROM public.purchased_bets pb
        LEFT JOIN public.pools p ON p.id = pb.pool_id
        LEFT JOIN public.draws d ON d.id = p.draw_id
        LEFT JOIN public.prize_awards pa ON pa.purchased_bet_id = pb.id
        LEFT JOIN LATERAL public.pool_bet_hits(pb.pool_id) h ON h.bet_id = pb.id
        WHERE pb.user_id = pr.id
        ORDER BY pb.created_at DESC
        LIMIT 100
      ) sub
    ), '[]'::jsonb),
    'prizes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'award_id', pa.id,
        'pool_name', COALESCE(p.name, 'Bolão'),
        'hits', pa.hits,
        'amount', pa.amount,
        'created_at', pa.created_at
      ) ORDER BY pa.created_at DESC)
      FROM public.prize_awards pa
      LEFT JOIN public.pools p ON p.id = pa.pool_id
      WHERE pa.user_id = pr.id
    ), '[]'::jsonb),
    'withdrawals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', w.id,
        'amount', w.amount,
        'pix_key_type', w.pix_key_type,
        'pix_key', w.pix_key,
        'status', w.status,
        'created_at', w.created_at,
        'reviewed_at', w.reviewed_at
      ) ORDER BY w.created_at DESC)
      FROM public.withdrawals w
      WHERE w.user_id = pr.id
    ), '[]'::jsonb),
    'transactions', COALESCE((
      SELECT jsonb_agg(sub.t ORDER BY sub.t_created DESC)
      FROM (
        SELECT
          jsonb_build_object(
            'id', wl.id,
            'entry_type', wl.entry_type,
            'amount', wl.amount,
            'status', wl.status,
            'created_at', wl.created_at,
            'title', COALESCE(wl.metadata ->> 'title', CASE wl.entry_type
              WHEN 'deposit' THEN 'Depósito Pix'
              WHEN 'bet' THEN 'Compra de cota'
              WHEN 'prize' THEN 'Prêmio'
              WHEN 'withdraw' THEN 'Saque'
              WHEN 'withdrawal_reversal' THEN 'Saque devolvido'
              WHEN 'bonus' THEN 'Bônus'
              ELSE wl.entry_type END)
          ) AS t,
          wl.created_at AS t_created
        FROM public.wallet_ledger wl
        WHERE wl.user_id = pr.id
        ORDER BY wl.created_at DESC
        LIMIT 100
      ) sub
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.profiles pr
  LEFT JOIN auth.users au ON au.id = pr.id
  LEFT JOIN public.wallet_accounts wa ON wa.user_id = pr.id
  WHERE pr.id = p_user_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Apostador não encontrado';
  END IF;

  RETURN v_result;
END;
$function$;