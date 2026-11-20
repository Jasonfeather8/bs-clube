CREATE OR REPLACE FUNCTION public.place_bets_tracked(
  p_pool_id uuid,
  p_number_sets jsonb,
  p_cota_price numeric DEFAULT NULL::numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_sets_count integer := 0;
  v_buy_in numeric(12,2);
  v_total numeric(14,2);
  v_bets jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'failed', 'message', 'É necessário estar autenticado.');
  END IF;

  IF p_number_sets IS NOT NULL AND jsonb_typeof(p_number_sets) = 'array' THEN
    v_sets_count := jsonb_array_length(p_number_sets);
  END IF;

  SELECT buy_in INTO v_buy_in FROM public.pools WHERE id = p_pool_id;
  IF v_buy_in IS NOT NULL THEN
    v_total := round(v_buy_in * v_sets_count, 2);
  END IF;

  BEGIN
    SELECT jsonb_agg(to_jsonb(bet) ORDER BY bet.created_at, bet.id)
    INTO v_bets
    FROM public.place_bets(p_pool_id, p_number_sets, p_cota_price) AS bet;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.bet_attempts (user_id, pool_id, sets_count, total_amount, outcome, message, number_sets)
    VALUES (v_user_id, p_pool_id, v_sets_count, v_total, 'failed', left(SQLERRM, 500), COALESCE(p_number_sets, '[]'::jsonb));
    RETURN jsonb_build_object('status', 'failed', 'message', SQLERRM);
  END;

  INSERT INTO public.bet_attempts (user_id, pool_id, sets_count, total_amount, outcome, message, number_sets)
  VALUES (v_user_id, p_pool_id, v_sets_count, v_total, 'success', NULL, COALESCE(p_number_sets, '[]'::jsonb));

  RETURN jsonb_build_object('status', 'success', 'bets', COALESCE(v_bets, '[]'::jsonb));
END;
$function$;