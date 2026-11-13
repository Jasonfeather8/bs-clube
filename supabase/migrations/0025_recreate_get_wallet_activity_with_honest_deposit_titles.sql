CREATE OR REPLACE FUNCTION public.get_wallet_activity(p_page integer DEFAULT 1, p_page_size integer DEFAULT 10, p_type text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH activity AS (
  SELECT
    wl.id,
    CASE
      WHEN wl.entry_type = 'deposit' THEN 'deposit'
      WHEN wl.entry_type = 'prize' THEN 'prize'
      WHEN wl.entry_type IN ('withdraw', 'withdrawal_reversal') THEN 'withdraw'
      ELSE 'bet'
    END AS type,
    COALESCE(
      wl.metadata ->> 'title',
      CASE
        WHEN wl.entry_type = 'withdrawal_reversal' THEN 'Saque devolvido'
        WHEN wl.entry_type = 'deposit' THEN 'Depósito Pix'
        WHEN wl.entry_type = 'prize' THEN 'Prêmio'
        WHEN wl.entry_type = 'withdraw' THEN 'Saque Pix'
        ELSE 'Aposta'
      END
    ) AS title,
    wl.created_at AS activity_date,
    wl.amount AS value,
    wl.status,
    NULL::text AS pix_key_type,
    NULL::text AS pix_key
  FROM public.wallet_ledger wl
  WHERE wl.user_id = auth.uid()
    AND wl.entry_type NOT IN ('withdraw', 'withdrawal_reversal')

  UNION ALL

  SELECT
    p.id,
    CASE WHEN p.kind = 'withdraw' THEN 'withdraw' ELSE 'deposit' END AS type,
    CASE
      WHEN p.kind = 'withdraw' THEN 'Saque Solicitado'
      WHEN p.status = 'canceled' THEN 'Depósito Pix cancelado'
      WHEN p.status = 'failed' THEN 'Depósito Pix não concluído'
      ELSE 'Depósito Pix'
    END AS title,
    p.created_at AS activity_date,
    p.amount AS value,
    p.status,
    NULL::text AS pix_key_type,
    NULL::text AS pix_key
  FROM public.payments p
  WHERE p.user_id = auth.uid()
    AND p.status <> 'confirmed'

  UNION ALL

  SELECT
    w.id,
    'withdraw' AS type,
    'Saque Solicitado' AS title,
    w.created_at AS activity_date,
    -abs(w.amount) AS value,
    w.status,
    w.pix_key_type,
    w.pix_key
  FROM public.withdrawals w
  WHERE w.user_id = auth.uid()
), filtered_activity AS (
  SELECT *
  FROM activity
  WHERE p_type IS NULL OR p_type = 'all' OR type = p_type
), counted AS (
  SELECT filtered_activity.*, count(*) OVER () AS total_count
  FROM filtered_activity
), page_rows AS (
  SELECT *
  FROM counted
  ORDER BY activity_date DESC, id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 10), 1), 50)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 10), 1), 50)
)
SELECT jsonb_build_object(
  'items', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'type', type,
          'title', title,
          'date', activity_date,
          'value', value,
          'status', status,
          'pix_key_type', pix_key_type,
          'pix_key', pix_key
        )
        ORDER BY activity_date DESC, id DESC
      )
      FROM page_rows
    ),
    '[]'::jsonb
  ),
  'total_count', COALESCE((SELECT max(total_count) FROM counted), 0)
);
$function$;