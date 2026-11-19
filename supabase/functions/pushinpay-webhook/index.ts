import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(JSON.stringify({}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);

  // A PushinPay NÃO envia um header de autenticação nas notificações de cobrança
  // (o header customizado do painel só existe para o webhook de MED). Por isso não
  // exigimos token aqui: a autenticidade é garantida logo abaixo, confirmando que
  // a cobrança pertence à nossa base e consultando a transação no provedor antes
  // de qualquer crédito.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[pushinpay-webhook] Configuração do Supabase ausente.');
    return jsonResponse({ error: 'Configuração do servidor incompleta.' }, 500);
  }

  let form: URLSearchParams;
  try {
    form = new URLSearchParams(await req.text());
  } catch {
    return jsonResponse({ error: 'Corpo do webhook inválido.' }, 400);
  }
  const eventPayload = Object.fromEntries(form.entries());
  const id = form.get('id');
  const status = form.get('status');
  if (!id || !status) {
    // O painel da PushinPay faz um POST de teste ao salvar o webhook, e também há
    // eventos que não são de cobrança (ex.: MED/infração). Apenas confirmamos o
    // recebimento para não gerar retentativas.
    console.log('[pushinpay-webhook] Evento não reconhecido, recebimento confirmado. Campos:', Object.keys(eventPayload).join(','));
    return jsonResponse({ received: true, ignored: true });
  }

  const eventType = form.has('pix_key') || form.has('receiver_national_registration') ? 'pix_cashout' : 'pix_cashin';
  const valueText = form.get('value');
  const amountCents = valueText ? Number(valueText) : null;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // Só processamos cobranças que existem na nossa base. Sem header de
  // autenticação, isso evita que requisições arbitrárias disparem consultas ao
  // provedor — consultas agressivas podem bloquear a conta na PushinPay.
  const { data: knownPayment, error: knownPaymentError } = await serviceClient
    .from('payments')
    .select('id')
    .eq('provider', 'pushinpay')
    .eq('external_id', id)
    .maybeSingle();
  if (knownPaymentError) {
    console.error('[pushinpay-webhook] Falha ao verificar a cobrança.', knownPaymentError.message);
    return jsonResponse({ error: 'Não foi possível verificar a cobrança.' }, 500);
  }
  if (!knownPayment) {
    console.log('[pushinpay-webhook] Cobrança desconhecida ignorada.', id);
    return jsonResponse({ received: true, ignored: true });
  }

  const eventKey = `${id}:${status}`;
  const { error: insertError } = await serviceClient.from('payment_webhook_events').insert({
    provider: 'pushinpay',
    event_key: eventKey,
    resource_id: id,
    event_type: eventType,
    provider_status: status,
    amount_cents: amountCents,
    payload: eventPayload,
    // A PushinPay não assina as notificações de cobrança, então não há assinatura
    // a validar; a confiança vem da consulta à transação no provedor.
    signature_valid: false,
  });
  if (insertError?.code === '23505') {
    // O evento já existe. Só podemos encerrar como duplicado se ele realmente foi
    // processado com sucesso; caso contrário precisamos reprocessar, senão uma falha
    // temporária (ex.: consulta ao provedor) bloquearia o crédito para sempre.
    const { data: existingEvent, error: existingError } = await serviceClient
      .from('payment_webhook_events')
      .select('processed_at, processing_error')
      .eq('provider', 'pushinpay')
      .eq('event_key', eventKey)
      .maybeSingle();
    if (existingError) {
      console.error('[pushinpay-webhook] Não foi possível verificar o evento duplicado.', existingError.message);
      return jsonResponse({ error: 'Não foi possível verificar o evento.' }, 500);
    }
    if (existingEvent?.processed_at && !existingEvent.processing_error) {
      return jsonResponse({ received: true, duplicate: true });
    }
    console.log('[pushinpay-webhook] Reprocessando evento ainda pendente.', eventKey);
  } else if (insertError) {
    console.error('[pushinpay-webhook] Não foi possível registrar o evento.', insertError.message);
    return jsonResponse({ error: 'Não foi possível registrar o evento.' }, 500);
  }

  const markProcessed = async (processingError: string | null = null) => {
    const { error } = await serviceClient.from('payment_webhook_events').update({
      processed_at: new Date().toISOString(),
      processing_error: processingError,
    }).eq('provider', 'pushinpay').eq('event_key', eventKey);
    if (error) console.error('[pushinpay-webhook] Não foi possível atualizar o evento.', error.message);
  };

  if (status !== 'paid' && status !== 'canceled') {
    await markProcessed();
    return jsonResponse({ received: true });
  }
  if (eventType === 'pix_cashout') {
    await markProcessed();
    return jsonResponse({ received: true });
  }

  const pushinpayToken = Deno.env.get('PUSHINPAY_TOKEN');
  if (!pushinpayToken) {
    await markProcessed('PUSHINPAY_TOKEN não configurado no servidor.');
    console.error('[pushinpay-webhook] PUSHINPAY_TOKEN não configurado.');
    return jsonResponse({ error: 'Token da PushinPay não configurado.' }, 500);
  }

  const apiUrl = (Deno.env.get('PUSHINPAY_API_URL') ?? 'https://api.pushinpay.com.br').replace(/\/$/, '');
  let transaction: Record<string, unknown>;
  try {
    const response = await fetch(`${apiUrl}/api/transactions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${pushinpayToken}`, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Consulta da transação retornou HTTP ${response.status}.`);
    const responseBody: unknown = await response.json();
    if (!responseBody || typeof responseBody !== 'object' || Array.isArray(responseBody)) {
      throw new Error('A PushinPay retornou uma resposta inválida.');
    }
    transaction = responseBody as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar a transação na PushinPay.';
    await markProcessed(message);
    console.error('[pushinpay-webhook] Falha ao verificar transação com o provedor.', message);
    return jsonResponse({ error: 'Não foi possível verificar a transação.' }, 500);
  }

  if (transaction.status !== 'paid') {
    // Cobrança cancelada, expirada ou estornada: encerra o registro local para que
    // ela não permaneça "pendente" para sempre no histórico do usuário.
    const { error: cancelError } = await serviceClient.rpc('settle_deposit', {
      p_provider: 'pushinpay',
      p_external_id: id,
      p_amount_cents: null,
      p_status: 'canceled',
      p_paid_at: null,
      p_payload: eventPayload,
    });
    if (cancelError) console.error('[pushinpay-webhook] Falha ao encerrar a cobrança local.', cancelError.message);
    await markProcessed(cancelError ? cancelError.message : null);
    return jsonResponse({ received: true });
  }
  const confirmedValue = transaction.value;
  if (typeof confirmedValue !== 'number' || !Number.isSafeInteger(confirmedValue) || confirmedValue < 0) {
    const message = 'A PushinPay retornou um valor inválido para a transação.';
    await markProcessed(message);
    console.error('[pushinpay-webhook] Valor inválido na resposta de verificação.');
    return jsonResponse({ error: 'Não foi possível verificar o valor da transação.' }, 500);
  }

  const { data: settlement, error: settlementError } = await serviceClient.rpc('settle_deposit', {
    p_provider: 'pushinpay',
    p_external_id: id,
    p_amount_cents: confirmedValue,
    p_status: 'paid',
    p_paid_at: null,
    p_payload: eventPayload,
  });
  if (settlementError) {
    await markProcessed(settlementError.message);
    console.error('[pushinpay-webhook] Falha ao liquidar o depósito.', settlementError.message);
    return jsonResponse({ received: true });
  }
  const settlementStatus = settlement?.status;
  if (settlementStatus === 'unknown_charge' || settlementStatus === 'amount_mismatch') {
    console.error('[pushinpay-webhook] Liquidação ignorada pela RPC.', settlementStatus, id);
  }
  await markProcessed();
  return jsonResponse({ received: true });
});
