CREATE OR REPLACE FUNCTION public.publish_pool_round(
  p_pool_id uuid,
  p_concurso text,
  p_draw_date date,
  p_numbers integer[],
  p_round_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_pool public.pools;
  v_draw public.draws;
  v_round_number integer;
  v_draw_id uuid;
  v_is_new_round boolean := false;
  v_draw_shared boolean := false;
  v_goal integer := 6;
  v_threshold integer := 6;
  v_bets_count integer := 0;
  v_max_hits integer := 0;
  v_goal_count integer := 0;
  v_winner_count integer := 0;
  v_gross numeric(14,2) := 0;
  v_house numeric(14,2) := 0;
  v_winners_amount numeric(14,2) := 0;
  v_settlement_id uuid;
  v_settled boolean := false;
  v_cap_reached boolean := false;
  v_award numeric(14,2);
  v_paid numeric(14,2) := 0;
  v_index integer := 0;
  v_winner record;
  v_wallet public.wallet_accounts;
  v_profile public.profiles;
  v_email text;
  v_message text;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;

  IF p_numbers IS NULL OR cardinality(p_numbers) <> 6
     OR (SELECT count(DISTINCT item.number) FROM unnest(p_numbers) AS item(number)) <> 6
     OR EXISTS (SELECT 1 FROM unnest(p_numbers) AS item(number) WHERE item.number < 1 OR item.number > 60) THEN
    RAISE EXCEPTION 'O resultado deve conter 6 dezenas distintas entre 01 e 60';
  END IF;

  IF p_concurso IS NULL OR btrim(p_concurso) = '' THEN
    RAISE EXCEPTION 'Informe o número do concurso';
  END IF;

  IF p_draw_date IS NULL THEN
    RAISE EXCEPTION 'Informe a data do sorteio';
  END IF;

  SELECT * INTO v_pool FROM public.pools WHERE id = p_pool_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bolão não encontrado';
  END IF;

  IF v_pool.status = 'completed' THEN
    RAISE EXCEPTION 'Este bolão já foi apurado e não aceita novas rodadas';
  END IF;

  IF v_pool.status = 'inactive' THEN
    RAISE EXCEPTION 'Este bolão está inativo. Reative-o antes de publicar rodadas';
  END IF;

  IF p_round_id IS NOT NULL THEN
    SELECT pr.round_number, pr.draw_id INTO v_round_number, v_draw_id
    FROM public.pool_rounds pr
    WHERE pr.id = p_round_id AND pr.pool_id = p_pool_id;
    IF v_round_number IS NULL THEN
      RAISE EXCEPTION 'Rodada não encontrada para este bolão';
    END IF;
  ELSIF v_pool.current_round = 0 THEN
    IF v_pool.draw_id IS NULL THEN
      SELECT d.id INTO v_draw_id FROM public.draws d WHERE d.contest = btrim(p_concurso) ORDER BY d.created_at DESC LIMIT 1;
      IF v_draw_id IS NULL THEN
        INSERT INTO public.draws (contest, draw_date, location, numbers, is_published)
        VALUES (btrim(p_concurso), p_draw_date, 'Caixa Econômica Federal', p_numbers, true)
        RETURNING id INTO v_draw_id;
      END IF;
    ELSE
      v_draw_id := v_pool.draw_id;
    END IF;
    v_round_number := 1;
    v_is_new_round := true;
  ELSE
    SELECT d.id INTO v_draw_id FROM public.draws d WHERE d.contest = btrim(p_concurso) ORDER BY d.created_at DESC LIMIT 1;
    IF v_draw_id IS NULL THEN
      INSERT INTO public.draws (contest, draw_date, location, numbers, is_published)
      VALUES (btrim(p_concurso), p_draw_date, 'Caixa Econômica Federal', p_numbers, true)
      RETURNING id INTO v_draw_id;
      v_round_number := v_pool.current_round + 1;
      v_is_new_round := true;
    ELSE
      SELECT pr.round_number INTO v_round_number
      FROM public.pool_rounds pr
      WHERE pr.pool_id = p_pool_id AND pr.draw_id = v_draw_id;
      IF v_round_number IS NULL THEN
        v_round_number := v_pool.current_round + 1;
        v_is_new_round := true;
      END IF;
    END IF;
  END IF;

  IF v_is_new_round THEN
    IF v_round_number > v_pool.max_rounds THEN
      RAISE EXCEPTION 'Este bolão já atingiu o limite de % rodadas', v_pool.max_rounds;
    END IF;
    IF v_round_number <> v_pool.current_round + 1 THEN
      RAISE EXCEPTION 'A próxima rodada deste bolão deve ser a %', v_pool.current_round + 1;
    END IF;
    SELECT count(*) INTO v_bets_count FROM public.purchased_bets pb WHERE pb.pool_id = p_pool_id;
    IF v_bets_count = 0 THEN
      RAISE EXCEPTION 'Este bolão ainda não possui cotas vendidas';
    END IF;
  END IF;

  SELECT * INTO v_draw FROM public.draws WHERE id = v_draw_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sorteio não encontrado';
  END IF;

  v_draw_shared := EXISTS (
    SELECT 1 FROM public.pool_rounds pr
    WHERE pr.draw_id = v_draw_id AND pr.pool_id <> p_pool_id
  );

  IF v_draw.is_published
     AND COALESCE(cardinality(v_draw.numbers), 0) > 0
     AND v_draw.numbers IS DISTINCT FROM p_numbers
     AND v_draw_shared THEN
    RAISE EXCEPTION 'O concurso % já foi publicado com outras dezenas em outro bolão', v_draw.contest;
  END IF;

  UPDATE public.draws
  SET contest = CASE WHEN v_draw_shared THEN contest ELSE btrim(p_concurso) END,
      numbers = p_numbers,
      draw_date = p_draw_date,
      is_published = true
  WHERE id = v_draw_id;

  IF v_is_new_round THEN
    INSERT INTO public.pool_rounds (pool_id, draw_id, round_number)
    VALUES (p_pool_id, v_draw_id, v_round_number);
  END IF;

  UPDATE public.pools
  SET current_round = v_round_number,
      draw_id = v_draw_id,
      status = CASE WHEN v_round_number = 1 AND status IN ('open', 'late_registration') THEN 'closed' ELSE status END
  WHERE id = p_pool_id
  RETURNING * INTO v_pool;

  SELECT COALESCE(max(h.hits), 0), count(*) FILTER (WHERE h.hits >= v_goal)
  INTO v_max_hits, v_goal_count
  FROM public.pool_bet_hits(p_pool_id) h;

  v_cap_reached := v_round_number >= v_pool.max_rounds;

  IF v_goal_count > 0 THEN
    v_threshold := v_goal;
    v_winner_count := v_goal_count;
    v_settled := true;
  ELSIF v_cap_reached THEN
    v_threshold := v_max_hits;
    SELECT count(*) INTO v_winner_count
    FROM public.pool_bet_hits(p_pool_id) h
    WHERE h.hits = v_max_hits;
    v_settled := v_winner_count > 0;
  END IF;

  IF v_settled THEN
    IF EXISTS (SELECT 1 FROM public.prize_settlements s WHERE s.pool_id = p_pool_id) THEN
      RAISE EXCEPTION 'Este bolão já foi apurado';
    END IF;

    SELECT COALESCE(sum(pb.cota_price), 0)::numeric(14,2) INTO v_gross
    FROM public.purchased_bets pb
    WHERE pb.pool_id = p_pool_id;

    v_house := round(v_gross * v_pool.house_percentage / 100, 2);
    v_winners_amount := round(v_gross - v_house, 2);
    IF v_winner_count = 0 THEN
      v_house := v_gross;
      v_winners_amount := 0;
    END IF;

    INSERT INTO public.prize_settlements (pool_id, gross_amount, house_amount, winners_amount, winner_count, created_by)
    VALUES (p_pool_id, v_gross, v_house, v_winners_amount, v_winner_count, v_admin)
    RETURNING id INTO v_settlement_id;

    IF v_winner_count > 0 AND v_winners_amount > 0 THEN
      FOR v_winner IN
        SELECT h.bet_id, h.user_id, h.numbers, h.created_at AS played_at, h.hits
        FROM public.pool_bet_hits(p_pool_id) h
        WHERE h.hits >= v_threshold
        ORDER BY h.created_at, h.bet_id
      LOOP
        v_index := v_index + 1;
        IF v_index = v_winner_count THEN
          v_award := v_winners_amount - v_paid;
        ELSE
          v_award := round(v_winners_amount / v_winner_count, 2);
        END IF;

        IF v_award > 0 THEN
          SELECT * INTO v_wallet FROM public.wallet_accounts WHERE user_id = v_winner.user_id FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Carteira do ganhador não encontrada';
          END IF;

          SELECT * INTO v_profile FROM public.profiles WHERE id = v_winner.user_id;
          SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_winner.user_id;

          UPDATE public.wallet_accounts
          SET total = total + v_award, withdrawable = withdrawable + v_award
          WHERE user_id = v_winner.user_id;

          INSERT INTO public.wallet_ledger (user_id, entry_type, amount, balance_before, balance_after, withdrawable_before, withdrawable_after, reference_id, idempotency_key, metadata, status)
          VALUES (
            v_winner.user_id,
            'prize',
            v_award,
            v_wallet.total,
            v_wallet.total + v_award,
            v_wallet.withdrawable,
            v_wallet.withdrawable + v_award,
            v_settlement_id,
            concat('prize:', v_settlement_id::text, ':', v_winner.bet_id::text),
            jsonb_build_object('pool_id', p_pool_id, 'settlement_id', v_settlement_id, 'hits', v_winner.hits),
            'success'
          );

          INSERT INTO public.prize_awards (
            settlement_id, purchased_bet_id, user_id, pool_id, hits, amount,
            winner_name, winner_email, winner_phone, winner_cpf, pix_key_type, pix_key
          )
          VALUES (
            v_settlement_id, v_winner.bet_id, v_winner.user_id, p_pool_id, v_winner.hits, v_award,
            v_profile.full_name, v_email, v_profile.phone, v_profile.cpf, v_profile.pix_key_type, v_profile.pix_key
          );

          v_paid := v_paid + v_award;
        END IF;
      END LOOP;
    END IF;

    UPDATE public.pools
    SET status = 'completed', settled_at = now()
    WHERE id = p_pool_id
    RETURNING * INTO v_pool;
  END IF;

  IF v_settled AND v_goal_count > 0 THEN
    v_message := format('Meta atingida na rodada %s de %s. %s cota(s) premiada(s). O bolão foi encerrado.',
      v_round_number, v_pool.max_rounds, v_winner_count);
  ELSIF v_settled THEN
    v_message := format('Limite de %s rodadas atingido. Prêmio rateado entre as %s cotas com maior acúmulo.',
      v_pool.max_rounds, v_winner_count);
  ELSE
    v_message := format('Rodada %s de %s publicada. Nenhuma cota atingiu os 6 acertos ainda.',
      v_round_number, v_pool.max_rounds);
  END IF;

  RETURN jsonb_build_object(
    'pool_id', p_pool_id,
    'draw_id', v_draw_id,
    'contest', v_draw.contest,
    'round_number', v_round_number,
    'rounds_published', v_round_number,
    'max_rounds', v_pool.max_rounds,
    'goal', v_goal,
    'max_hits', v_max_hits,
    'bets_count', (SELECT count(*) FROM public.purchased_bets pb WHERE pb.pool_id = p_pool_id),
    'settled', v_settled,
    'winner_count', v_winner_count,
    'gross_amount', v_gross,
    'house_amount', v_house,
    'winners_amount', v_winners_amount,
    'settlement_id', v_settlement_id,
    'message', v_message
  );
END;
$function$