CREATE OR REPLACE FUNCTION public.place_bets(p_pool_id uuid, p_number_sets jsonb, p_cota_price numeric DEFAULT NULL::numeric)
 RETURNS SETOF purchased_bets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_pool public.pools;
  v_wallet public.wallet_accounts;
  v_bet public.purchased_bets;
  v_numbers integer[];
  v_set_json jsonb;
  v_set_count integer := 0;
  v_number_count integer;
  v_distinct_count integer;
  v_total_amount numeric;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id and is_active = false) then
    raise exception 'Sua conta está bloqueada. Entre em contato com o suporte.';
  end if;

  if p_number_sets is null or jsonb_typeof(p_number_sets) <> 'array' then
    raise exception 'Conjunto de apostas inválido';
  end if;

  v_set_count := jsonb_array_length(p_number_sets);

  if v_set_count < 1 then
    raise exception 'Selecione ao menos uma aposta';
  end if;

  select * into v_pool from public.pools where id = p_pool_id and status in ('open', 'late_registration') for update;
  if not found then
    raise exception 'Bolão indisponível';
  end if;

  if v_pool.filled_slots + v_set_count > v_pool.total_slots then
    raise exception 'Não há vagas suficientes';
  end if;

  if p_cota_price is not null and round(p_cota_price, 2) <> v_pool.buy_in then
    raise exception 'Preço da cota inválido';
  end if;

  select * into v_wallet from public.wallet_accounts where user_id = v_user_id for update;
  if not found then
    raise exception 'Carteira não encontrada';
  end if;

  v_total_amount := v_pool.buy_in * v_set_count;

  if v_wallet.total < v_total_amount or v_wallet.withdrawable < v_total_amount then
    raise exception 'Saldo insuficiente';
  end if;

  for v_set_json in select value from jsonb_array_elements(p_number_sets) loop
    if jsonb_typeof(v_set_json) <> 'array' then
      raise exception 'Cada aposta deve ser um conjunto de dezenas';
    end if;
    v_numbers := array(select value::integer from jsonb_array_elements_text(v_set_json));
    v_number_count := coalesce(array_length(v_numbers, 1), 0);
    if v_number_count < v_pool.min_numbers or v_number_count > v_pool.max_numbers then
      raise exception 'Quantidade de dezenas inválida';
    end if;
    select count(*), count(distinct value) into v_number_count, v_distinct_count from unnest(v_numbers) as item(value);
    if v_number_count <> v_distinct_count then
      raise exception 'As dezenas não podem se repetir';
    end if;
    if exists (select 1 from unnest(v_numbers) as item(value) where item.value < 1 or item.value > v_pool.total_lottery_numbers) then
      raise exception 'Dezena fora do intervalo permitido';
    end if;
  end loop;

  update public.wallet_accounts set total = total - v_total_amount, withdrawable = withdrawable - v_total_amount where user_id = v_user_id;
  update public.pools set filled_slots = filled_slots + v_set_count where id = p_pool_id;

  insert into public.wallet_ledger (user_id, entry_type, amount, balance_before, balance_after, withdrawable_before, withdrawable_after, reference_id, metadata, status)
  values (v_user_id, 'bet', -v_total_amount, v_wallet.total, v_wallet.total - v_total_amount, v_wallet.withdrawable, v_wallet.withdrawable - v_total_amount, p_pool_id, jsonb_build_object('pool_id', p_pool_id, 'sets', v_set_count), 'success');

  for v_set_json in select value from jsonb_array_elements(p_number_sets) loop
    v_numbers := array(select value::integer from jsonb_array_elements_text(v_set_json));
    insert into public.purchased_bets (user_id, pool_id, numbers, cota_price) values (v_user_id, p_pool_id, v_numbers, v_pool.buy_in) returning * into v_bet;
    return next v_bet;
  end loop;

  return;
end;
$function$