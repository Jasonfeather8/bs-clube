CREATE OR REPLACE FUNCTION public.register_pool_result(
  p_pool_id uuid,
  p_draw_id uuid,
  p_draw_date date,
  p_numbers integer[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_contest text;
  v_round_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;

  SELECT d.contest INTO v_contest FROM public.draws d WHERE d.id = p_draw_id;
  IF v_contest IS NULL THEN
    RAISE EXCEPTION 'Sorteio não encontrado';
  END IF;

  -- Se o sorteio informado já é uma rodada deste bolão, a chamada é tratada como
  -- correção daquela rodada (reedição permitida enquanto o bolão não estiver apurado).
  SELECT pr.id INTO v_round_id
  FROM public.pool_rounds pr
  WHERE pr.pool_id = p_pool_id AND pr.draw_id = p_draw_id;

  RETURN public.publish_pool_round(p_pool_id, v_contest, p_draw_date, p_numbers, v_round_id);
END;
$function$