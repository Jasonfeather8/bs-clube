import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(JSON.stringify({}), { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Autenticação necessária.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pushinpayToken = Deno.env.get('PUSHINPAY_TOKEN');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('[pushinpay-reconcile] Configuração do Supabase ausente.');
    return jsonResponse({ error: 'Configuração do Supabase incompleta no servidor.' }, 500);
  }
  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
    if (!pushinpayToken) {
      console.error('[pushinpay-reconcile] PUSHINPAY_TOKEN não configurado.');
      return jsonResponse({ error: 'Token da PushinPay não configurado no servidor.' }, 500);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: payments, error: paymentsError } = await serviceClient
      .from('payments')
      .select('id, user_id, external_id, metadata, created_at')
      .eq('user_id', user.id)
      .eq('kind', 'deposit')
      .eq('provider', 'pushinpay')
      .eq('status', 'pending')
      .not('external_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    if (paymentsError) {
      console.error('[pushinpay-reconcile] Falha ao carregar depósitos pendentes.', paymentsError.message);
      return jsonResponse({ error: 'Não foi possível carregar os depósitos pendentes.' }, 500);
    }

    const results: { paymentId: string; outcome: string; detail?: string }[] = [];
    const apiUrl = (Deno.env.get('PUSHINPAY_API_URL') ?? 'https://api.pushinpay.com.br').replace(/\/$/, '');

    for (const payment of payments ?? []) {
      const paymentId = String(payment.id);
      try {
        const metadata = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
          ? payment.metadata as Record<string, unknown>
          : {};
        const previousCheck = typeof metadata.reconcile_checked_at === 'string'
          ? Date.parse(metadata.reconcile_checked_at)
          : Number.NaN;
        const checkedNow = Date.now();
        if (Number.isFinite(previousCheck) && previousCheck <= checkedNow && checkedNow - previousCheck < 45_000) {
          results.push({ paymentId, outcome: 'skipped', detail: 'cooldown' });
          continue;
        }

        const { error: stampError } = await serviceClient.from('payments').update({
          metadata: { ...metadata, reconcile_checked_at: new Date(checkedNow).toISOString() },
        }).eq('id', payment.id).eq('user_id', user.id);
        if (stampError) {
          console.error('[pushinpay-reconcile] Falha ao registrar consulta do depósito.', paymentId, stampError.message);
          results.push({ paymentId, outcome: 'error', detail: 'metadata_update_failed' });
          continue;
        }

        let providerResponse: Response;
        try {
          providerResponse = await fetch(`${apiUrl}/api/transactions/${encodeURIComponent(payment.external_id)}`, {
            headers: { Authorization: `Bearer ${pushinpayToken}`, Accept: 'application/json' },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'network_error';
          console.error('[pushinpay-reconcile] Erro de rede ao consultar a PushinPay.', paymentId, message);
          results.push({ paymentId, outcome: 'error', detail: 'provider_network_error' });
          continue;
        }

        if (!providerResponse.ok) {
          results.push({ paymentId, outcome: 'error', detail: `provider_http_${providerResponse.status}` });
          continue;
        }

        let providerData: unknown;
        try {
          providerData = await providerResponse.json();
        } catch {
          results.push({ paymentId, outcome: 'error', detail: 'invalid_provider_json' });
          continue;
        }
        if (!providerData || typeof providerData !== 'object' || Array.isArray(providerData)) {
          results.push({ paymentId, outcome: 'error', detail: 'invalid_provider_response' });
          continue;
        }
        const transaction = providerData as { status?: unknown; value?: unknown };

        if (transaction.status === 'paid') {
          if (typeof transaction.value !== 'number' || !Number.isSafeInteger(transaction.value) || transaction.value < 0) {
            results.push({ paymentId, outcome: 'error', detail: 'invalid_provider_value' });
            continue;
          }
          const { data, error } = await serviceClient.rpc('settle_deposit', {
            p_provider: 'pushinpay',
            p_external_id: payment.external_id,
            p_amount_cents: transaction.value,
            p_status: 'paid',
            p_paid_at: null,
            p_payload: { source: 'reconcile' },
          });
          if (error) {
            console.error('[pushinpay-reconcile] Falha ao liquidar depósito pago.', paymentId, error.message);
            results.push({ paymentId, outcome: 'error', detail: 'settlement_failed' });
          } else {
            results.push({ paymentId, outcome: 'settled', detail: typeof data?.status === 'string' ? data.status : undefined });
          }
          continue;
        }

        if (transaction.status === 'canceled' || transaction.status === 'expired') {
          const { data, error } = await serviceClient.rpc('settle_deposit', {
            p_provider: 'pushinpay',
            p_external_id: payment.external_id,
            p_amount_cents: null,
            p_status: 'canceled',
            p_paid_at: null,
            p_payload: { source: 'reconcile' },
          });
          if (error) {
            console.error('[pushinpay-reconcile] Falha ao cancelar depósito encerrado.', paymentId, error.message);
            results.push({ paymentId, outcome: 'error', detail: 'settlement_failed' });
          } else {
            results.push({ paymentId, outcome: 'canceled', detail: typeof data?.status === 'string' ? data.status : undefined });
          }
          continue;
        }

        results.push({ paymentId, outcome: 'pending' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected_error';
        console.error('[pushinpay-reconcile] Erro ao reconciliar depósito.', paymentId, message);
        results.push({ paymentId, outcome: 'error', detail: 'unexpected_error' });
      }
    }

    const { data: wallet, error: walletError } = await serviceClient
      .from('wallet_accounts')
      .select('total, withdrawable, bonus')
      .eq('user_id', user.id)
      .maybeSingle();
    if (walletError) {
      console.error('[pushinpay-reconcile] Falha ao carregar saldo da carteira.', walletError.message);
      return jsonResponse({ error: 'Não foi possível carregar o saldo da carteira.' }, 500);
    }

    return jsonResponse({
      balance: {
        total: Number(wallet?.total ?? 0),
        withdrawable: Number(wallet?.withdrawable ?? 0),
        bonus: Number(wallet?.bonus ?? 0),
      },
      results,
    });
  } catch (error) {
    console.error('[pushinpay-reconcile] Erro inesperado na reconciliação.', error);
    return jsonResponse({ error: 'Não foi possível reconciliar os depósitos.' }, 500);
  }
});
