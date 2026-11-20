CREATE OR REPLACE FUNCTION public.sync_pool_prize_estimate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_gross numeric(14,2);
  v_prize numeric(12,2);
BEGIN
  IF NEW.prize_estimate IS NOT NULL AND NEW.prize_estimate > 0 THEN
    RETURN NULL;
  END IF;
  v_gross := round(COALESCE(NEW.total_slots, 0) * COALESCE(NEW.buy_in, 0), 2);
  v_prize := round(v_gross - round(v_gross * COALESCE(NEW.house_percentage, 0) / 100, 2), 2);
  IF v_prize > 0 AND v_prize IS DISTINCT FROM NEW.prize_estimate THEN
    UPDATE public.pools SET prize_estimate = v_prize WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END;
$function$;