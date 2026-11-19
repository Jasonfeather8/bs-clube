import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  PROVIDER,
  describeAmount,
  fetchProviderTransaction,
  normalizeExternalId,
  parseProviderAmount,
  providerOutcome,
  resolveApiUrl,
  withProviderCheckStamp,
} from '../_shared/pushinpay.ts';

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
  // (o header customizado do painel só existe no webhook de MED). Por isso não
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
  const status = form.get('status');
  if (!form.get('id') || !status) {
    // O painel da PushinPay faz um POST de teste ao salvar o webhook, e também há
    // eventos que não são de cobrança (ex.: MED/infração). Apenas confirmamos o
    // recebimento para não gerar retentativas.
    console.log('[pushinpay-webhook] Evento não reconhecido, recebimento confirmado. Campos:', Object.keys(eventPayload).join(','));
    return jsonResponse({ received: true, ignored: true });
  }

  const externalId = normalizeExternalId(form.get('id'));
  if (!externalId) {
    console.log('[pushinpay-webhook] Identificador inválido ignorado.');
    return jsonResponse({ received: true, ignored: true });
  }

  const eventType = form.has('pix_key') || form.has('receiver_national_registration') ? 'pix_cashout' : 'pix_cashin';
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // Só processamos cobranças que existem na nossa base. Sem header de
  // autenticação, isso evita que requisições arbitrárias disparem consultas ao
  // provedor — consultas agressivas podem bloquear a conta na PushinPay.
  const { data: knownPayment, error: knownPaymentError } = await serviceClient
    .from('payments')
    .select('id, external_id, status, metadata')
    .eq('provider', PROVIDER)
    .ilike('external_id', externalId)
    .maybeSingle();
  if (knownPaymentError) {
    console.error('[pushinpay-webhook] Falha ao verificar a cobrança.', knownPaymentError.message);
    return jsonResponse({ error: 'Não foi possível verificar a cobrança.' }, 500);
  }
  if (!knownPayment) {
    console.log('[pushinpay-webhook] Cobrança desconhecida ignorada.', externalId);
    return jsonResponse({ received: true, ignored: true });
  }

  const eventKey = `${externalId}:${status}`;
  const { error: insertError } = await serviceClient.from('payment_webhook_events').insert({
    provider: PROVIDER,
    event_key: eventKey,
    resource_id: externalId,
    event_type: eventType,
    provider_status: status,
    amount_cents: parseProviderAmount(form.get('value')).cents,
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
      .eq('provider', PROVIDER)
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
    }).eq('provider', PROVIDER).eq('event_key', eventKey);
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

  // Depósito já finalizado localmente não tem o que creditar nem cancelar. Sair
  // aqui evita consultas inúteis ao provedor, que limita a 1 chamada por minuto
  // por transação e pode bloquear a conta em caso de excesso.
  if (knownPayment.status !== 'pending') {
    console.log('[pushinpay-webhook] Depósito já finalizado localmente, nada a fazer.', externalId, knownPayment.status);
    await markProcessed();
    return jsonResponse({ received: true, settled: true });
  }

  const pushinpayToken = Deno.env.get('PUSHINPAY_TOKEN');
  if (!pushinpayToken) {
    await markProcessed('PUSHINPAY_TOKEN não configurado no servidor.');
    console.error('[pushinpay-webhook] PUSHINPAY_TOKEN não configurado.');
    return jsonResponse({ error: 'Token da PushinPay não configurado.' }, 500);
  }

  const apiUrl = resolveApiUrl(Deno.env.get('PUSHINPAY_API_URL'));

  // Registra a consulta para que a conciliação não repita a mesma chamada.
  const { error: stampError } = await serviceClient
    .from('payments')
    .update({ metadata: withProviderCheckStamp(knownPayment.metadata, new Date()) })
    .eq('id', knownPayment.id);
  if (stampError) {
    console.error('[pushinpay-webhook] Não foi possível registrar a consulta do depósito.', stampError.message);
  }

  const lookup = await fetchProviderTransaction(apiUrl, pushinpayToken, externalId);
  if (!lookup.ok) {
    await markProcessed(lookup.error);
    console.error('[pushinpay-webhook] Falha ao verificar transação com o provedor.', lookup.error);
    return jsonResponse({ error: 'Não foi possível verificar a transação.' }, 500);
  }

  const outcome = providerOutcome(lookup.transaction.status);

  if (outcome === 'pending') {
    // O provedor ainda não confirmou. Não encerramos o evento para permitir nova
    // tentativa (a notificação reenviada e a conciliação continuam valendo).
    await markProcessed('A PushinPay ainda não confirmou a transação.');
    console.log('[pushinpay-webhook] Transação ainda não confirmada pelo provedor.', externalId, String(lookup.transaction.status));
    return jsonResponse({ received: true, pending: true });
  }

  if (outcome === 'canceled') {
    // Cobrança cancelada, expirada ou estornada: encerra o registro local para que
    // ela não permaneça "pendente" para sempre no histórico do usuário.
    const { error: cancelError } = await serviceClient.rpc('settle_deposit', {
      p_provider: PROVIDER,
      p_external_id: knownPayment.external_id,
      p_amount_cents: null,
      p_status: 'canceled',
      p_paid_at: null,
      p_payload: eventPayload,
    });
    if (cancelError) console.error('[pushinpay-webhook] Falha ao encerrar a cobrança local.', cancelError.message);
    await markProcessed(cancelError ? cancelError.message : null);
    return jsonResponse({ received: true });
  }

  const amount = parseProviderAmount(lookup.transaction.value);
  console.log('[pushinpay-webhook] Valor informado pelo provedor.', externalId, describeAmount(amount));
  if (amount.cents === null) {
    const message = `A PushinPay retornou um valor inválido para a transação: ${describeAmount(amount)}`;
    await markProcessed(message);
    console.error('[pushinpay-webhook] Valor inválido na resposta de verificação.', externalId);
    return jsonResponse({ error: 'Não foi possível verificar o valor da transação.' }, 500);
  }

  const { data: settlement, error: settlementError } = await serviceClient.rpc('settle_deposit', {
    p_provider: PROVIDER,
    p_external_id: knownPayment.external_id,
    p_amount_cents: amount.cents,
    p_status: 'paid',
    p_paid_at: null,
    p_payload: eventPayload,
  });
  if (settlementError) {
    await markProcessed(settlementError.message);
    console.error('[pushinpay-webhook] Falha ao liquidar o depósito.', settlementError.message);
    return jsonResponse({ received: true });
  }

  // A RPC recusa creditar cobrança desconhecida ou com valor divergente do
  // contratado. O motivo fica registrado no evento para não passar em silêncio.
  const settlementStatus = typeof settlement?.status === 'string' ? settlement.status : '';
  if (settlementStatus !== 'credited' && settlementStatus !== 'already_confirmed') {
    await markProcessed(`Liquidação não creditada: ${settlementStatus || 'sem status'}.`);
    console.error('[pushinpay-webhook] Liquidação não creditada pela RPC.', settlementStatus, externalId);
    return jsonResponse({ received: true });
  }

  await markProcessed();
  return jsonResponse({ received: true });
});
