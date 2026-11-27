import { supabase } from '@/integrations/supabase/client';
import { BolaoDetails, OwnBet, UserBet } from '../types';

type Row = Record<string, any>;

const firstRelation = (value: unknown): Row | undefined =>
  Array.isArray(value) ? value[0] : (value as Row | undefined);

function mapPool(row: Row): BolaoDetails {
  const category = firstRelation(row.pool_categories);
  const draw = firstRelation(row.draws);
  const status = row.status as string;
  return {
    id: String(row.id),
    nome: row.name ?? '',
    lottery: category?.name ?? row.game_type ?? 'Mega-Sena',
    concurso: draw?.contest ?? '',
    concursoRef: draw?.contest ?? '',
    mesaName: category?.name ?? row.name ?? '',
    dataSorteio: draw?.draw_date ?? '',
    horarioSorteio: '',
    cotaPrice: Number(row.buy_in ?? 0),
    vagasPreenchidas: Number(row.filled_slots ?? 0),
    vagasTotal: Number(row.total_slots ?? 0),
    estado: status === 'closed' || status === 'completed' ? 'Encerrada' : 'Aberta',
    minNumbers: Number(row.min_numbers ?? 6),
    maxNumbers: Number(row.max_numbers ?? 6),
    totalLotteryNumbers: Number(row.total_lottery_numbers ?? 60),
    descricao: row.description ?? '',
  };
}

function mapBet(row: Row): UserBet {
  return {
    id: String(row.id),
    bolaoId: String(row.pool_id),
    numbers: Array.isArray(row.numbers) ? row.numbers.map(Number) : [],
    createdAt: row.created_at ?? '',
    cotaPrice: Number(row.cota_price ?? 0),
  };
}

const poolSelect = '*, pool_categories(name, slug), draws(contest, draw_date, location, numbers)';

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('É necessário estar autenticado.');
  return data.user;
}

export const betsService = {
  async getBolaoDetails(id?: string): Promise<BolaoDetails> {
    let query = supabase.from('pools').select(poolSelect).in('status', ['open', 'late_registration']);
    if (id) query = query.eq('id', id);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Nenhum bolão disponível no momento.');
    return mapPool(data);
  },

  async getAll(): Promise<UserBet[]> {
    const user = await currentUser();
    const { data, error } = await supabase
      .from('purchased_bets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapBet);
  },

  async getOwnBets(): Promise<OwnBet[]> {
    await currentUser();
    const { data, error } = await supabase.rpc('get_own_bets');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row: Row): OwnBet => ({
      betId: String(row.bet_id ?? ''),
      poolId: String(row.pool_id ?? ''),
      poolName: String(row.pool_name ?? 'Bolão'),
      contest: String(row.contest ?? ''),
      drawDate: String(row.draw_date ?? ''),
      numbers: Array.isArray(row.numbers) ? row.numbers.map(Number) : [],
      cotaPrice: Number(row.cota_price ?? 0),
      createdAt: String(row.created_at ?? ''),
      poolStatus: String(row.pool_status ?? ''),
      isPublished: row.is_published === true,
      officialNumbers: Array.isArray(row.official_numbers) ? row.official_numbers.map(Number) : [],
      hits: Number(row.hits ?? 0),
      goal: Number(row.goal ?? 6),
      roundsPublished: Number(row.rounds_published ?? 0),
      currentRound: Number(row.current_round ?? 0),
      maxRounds: Number(row.max_rounds ?? 20),
      rounds: Array.isArray(row.rounds)
        ? row.rounds.map((round: Row) => ({
            roundNumber: Number(round.round_number ?? 0),
            concurso: String(round.contest ?? ''),
            drawDate: String(round.draw_date ?? ''),
            numbers: Array.isArray(round.numbers) ? round.numbers.map(Number) : [],
            hits: Number(round.hits ?? 0),
          }))
        : [],
      prizeAmount: Number(row.prize_amount ?? 0),
    }));
  },

  async getById(id: string): Promise<UserBet | null> {
    const user = await currentUser();
    const { data, error } = await supabase.from('purchased_bets').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data ? mapBet(data) : null;
  },

  // A validação das dezenas vive no banco, dentro de place_bets. Repetir as regras
  // aqui só criaria um caminho de falha que não deixa registro; por isso a compra
  // passa por place_bets_tracked, que aplica as regras e registra o resultado.
  async placeBets(poolId: string, numberSets: number[][]): Promise<UserBet[]> {
    await currentUser();
    const { data, error } = await supabase.rpc('place_bets_tracked', {
      p_pool_id: poolId,
      p_number_sets: numberSets,
      p_cota_price: null,
    });
    if (error) throw error;
    const result = (data ?? {}) as { status?: string; message?: string; bets?: unknown };
    if (result.status !== 'success') {
      throw new Error(
        typeof result.message === 'string' && result.message.trim()
          ? result.message
          : 'Não foi possível registrar a aposta. Tente novamente.',
      );
    }
    const rows = Array.isArray(result.bets) ? result.bets : [];
    return rows.map((row) => mapBet(row as Row));
  },
};
