// Regras compartilhadas da integração com a PushinPay.
//
// Toda a leitura de identificador, de valor e de transação vive aqui para que o
// webhook e a conciliação se comportem de forma idêntica. Assim uma correção vale
// para os dois caminhos de uma vez, em vez de virar um ajuste por função.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NUMERIC_PATTERN = /^-?\d+(?:[.,]\d+)?$/;

const DEFAULT_API_URL = 'https://api.pushinpay.com.br';

export const PROVIDER = 'pushinpay';

/** A PushinPay limita a consulta de uma transação a 1 chamada por minuto. */
export const PROVIDER_CHECK_INTERVAL_MS = 60_000;

export function resolveApiUrl(value: string | undefined): string {
  return (value ?? DEFAULT_API_URL).replace(/\/$/, '');
}

/**
 * O identificador da transação chega em caixa alta no webhook e em caixa baixa na
 * API de cobrança, e o Postgres compara texto diferenciando maiúsculas de
 * minúsculas. Por isso o valor é sempre normalizado antes de ser gravado ou
 * comparado. Identificadores fora do formato UUID são recusados.
 */
export function normalizeExternalId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export type ProviderAmount = {
  cents: number | null;
  raw: unknown;
  format: 'integer_cents' | 'decimal_reais' | 'invalid';
};

/**
 * Converte o valor informado pelo provedor para centavos.
 *
 * A especificação da PushinPay define o campo como inteiro em centavos, mas o
 * valor pode chegar como texto. Um valor fracionário nunca pode representar
 * centavos (centavos são inteiros), então apenas ele é interpretado como reais.
 */
export function parseProviderAmount(value: unknown): ProviderAmount {
  let numeric: number | null = null;
  if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string' && NUMERIC_PATTERN.test(value.trim())) {
    numeric = Number(value.trim().replace(',', '.'));
  }
  if (numeric === null || !Number.isFinite(numeric) || numeric < 0) {
    return { cents: null, raw: value, format: 'invalid' };
  }
  if (Number.isSafeInteger(numeric)) {
    return { cents: numeric, raw: value, format: 'integer_cents' };
  }
  const cents = Math.round(numeric * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    return { cents: null, raw: value, format: 'invalid' };
  }
  return { cents, raw: value, format: 'decimal_reais' };
}

/** Registro curto do valor recebido, sem dados pessoais, para diagnóstico. */
export function describeAmount(amount: ProviderAmount): string {
  return JSON.stringify({ raw: amount.raw, rawType: typeof amount.raw, format: amount.format, cents: amount.cents });
}

export type ProviderOutcome = 'paid' | 'canceled' | 'pending';

/**
 * A PushinPay não possui status de falha: uma cobrança não paga permanece
 * "created" até expirar ou ser cancelada. Qualquer outro status é tratado como
 * ainda pendente, e não como cancelamento.
 */
export function providerOutcome(status: unknown): ProviderOutcome {
  if (status === 'paid') return 'paid';
  if (status === 'canceled' || status === 'expired') return 'canceled';
  return 'pending';
}

export type ProviderLookup =
  | { ok: true; transaction: Record<string, unknown> }
  | { ok: false; error: string };

/** Consulta a transação no provedor. Nunca lança: devolve o motivo da falha. */
export async function fetchProviderTransaction(
  apiUrl: string,
  token: string,
  externalId: string,
): Promise<ProviderLookup> {
  try {
    const response = await fetch(`${apiUrl}/api/transactions/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok) {
      return { ok: false, error: `A consulta da transação retornou HTTP ${response.status}.` };
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, error: 'A PushinPay retornou uma resposta inválida.' };
    }
    return { ok: true, transaction: body as Record<string, unknown> };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar a transação na PushinPay.';
    return { ok: false, error: message };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

/** Registra no depósito o momento da consulta ao provedor. */
export function withProviderCheckStamp(metadata: unknown, checkedAt: Date): Record<string, unknown> {
  return { ...asRecord(metadata), provider_checked_at: checkedAt.toISOString() };
}

/** Informa se a transação foi consultada há menos que o intervalo permitido. */
export function isWithinCheckInterval(metadata: unknown, now: number): boolean {
  const previous = asRecord(metadata).provider_checked_at;
  const previousTime = typeof previous === 'string' ? Date.parse(previous) : Number.NaN;
  return Number.isFinite(previousTime) && previousTime <= now && now - previousTime < PROVIDER_CHECK_INTERVAL_MS;
}
