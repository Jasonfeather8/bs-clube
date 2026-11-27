import { supabase } from '@/integrations/supabase/client';
import {
  AdminWithdrawal,
  AdminUser,
  AdminCategory,
  AdminFinancialMetrics,
  AdminUsersPage,
  AdminUsersQuery,
  AdminCategoryInput,
  AdminCategoryStatus,
  AdminCategoriesPage,
  AdminCategoriesQuery,
  ManualDrawInput,
  PrizeSettings,
  PublishRoundInput,
  PublishRoundOutcome,
  AdminRound,
  AdminResultDetail,
  AdminPoolDetail,
  AdminPoolParticipant,
  AdminUserDetail,
  AdminUserBet,
  AdminUserPrize,
  AdminUserWithdrawal,
  AdminUserTransaction,
} from '../types';

type Row = Record<string, any>;
const DEFAULT_PRIZE_SETTINGS: PrizeSettings = { housePercentage: 25, winnerPercentage: 75 };
const ADMIN_USERS_PAGE_SIZE = 10;
const ADMIN_CATEGORIES_PAGE_SIZE = 10;

function mapWithdrawal(row: Row): AdminWithdrawal {
  return {
    id: String(row.id),
    user: String(row.user_id),
    amount: Number(row.amount ?? 0),
    date: row.created_at ?? '',
    pixKey: row.pix_key ?? '',
    pixType: row.pix_key_type ?? '',
    status: row.status ?? 'pending',
  };
}

function mapUser(row: Row): AdminUser {
  return {
    id: String(row.id),
    name: row.name ?? row.full_name ?? row.display_name ?? row.email ?? 'Apostador',
    phone: row.phone ?? '',
    balance: Number(row.total ?? 0),
    bonus: Number(row.bonus ?? 0),
    active: row.is_active !== false,
    createdAt: row.created_at,
  };
}

function escapeSearchTerm(value: string) {
  return value.replace(/[\\%_(),]/g, '\\$&');
}

async function getAdminUserIds(): Promise<string[]> {
  const { data, error } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
  if (error) throw error;
  return (data ?? []).map((row) => String(row.user_id));
}

function getCurrentMonthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
  };
}

async function getWallets(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, Row>();
  const { data, error } = await supabase
    .from('wallet_accounts')
    .select('user_id, total, bonus')
    .in('user_id', userIds);
  if (error) throw error;
  return new Map((data ?? []).map((wallet) => [String(wallet.user_id), wallet as Row]));
}

function toIsoDate(value: string) {
  const parts = value.split('/');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : value;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function mapCategory(row: Row): AdminCategory {
  const pools = Array.isArray(row.pools) ? row.pools : row.pools ? [row.pools] : [];
  const pool = pools[0] ?? {};
  const draw = Array.isArray(pool.draws) ? pool.draws[0] : pool.draws;
  const rawPoolStatus = pool.status;
  const poolStatus: AdminCategoryStatus = rawPoolStatus === 'inactive' ? 'inactive' : rawPoolStatus === 'completed' ? 'completed' : rawPoolStatus === 'closed' ? 'closed' : rawPoolStatus === 'late_registration' ? 'late_registration' : 'open';
  return {
    id: String(row.id),
    poolId: pool.id ? String(pool.id) : undefined,
    name: row.name ?? '',
    concurso: draw?.contest ?? '',
    cota: Number(pool.buy_in ?? 0),
    quotaId: pool.quota_id ? String(pool.quota_id) : undefined,
    vagas: Number(pool.total_slots ?? 0),
    filled: Number(pool.filled_slots ?? 0),
    drawDate: draw?.draw_date ?? '',
    minNumbers: Number(pool.min_numbers ?? 6),
    maxNumbers: Number(pool.max_numbers ?? 6),
    numbers: Array.isArray(draw?.numbers) ? draw.numbers.map(Number) : [],
    housePercentage: Number(pool.house_percentage ?? DEFAULT_PRIZE_SETTINGS.housePercentage),
    winnerPercentage: Number(pool.winner_percentage ?? DEFAULT_PRIZE_SETTINGS.winnerPercentage),
    currentRound: Number(pool.current_round ?? 0),
    maxRounds: Number(pool.max_rounds ?? 20),
    settledAt: pool.settled_at ?? undefined,
    poolStatus,
    status: poolStatus === 'inactive' ? 'inativo' : poolStatus === 'completed' ? 'concluido' : poolStatus === 'closed' ? 'finalizado' : 'em_andamento',
  };
}

function mapRound(round: Row): AdminRound {
  return {
    id: String(round.id ?? ''),
    drawId: String(round.draw_id ?? ''),
    roundNumber: Number(round.round_number ?? 0),
    contest: String(round.contest ?? ''),
    drawDate: String(round.draw_date ?? ''),
    numbers: Array.isArray(round.numbers) ? round.numbers.map(Number) : [],
    isPublished: round.is_published === true,
    publishedAt: String(round.published_at ?? ''),
  };
}

function validatePrizeSettings(settings: PrizeSettings) {
  if (
    !Number.isFinite(settings.housePercentage) ||
    !Number.isFinite(settings.winnerPercentage) ||
    settings.housePercentage < 0 ||
    settings.housePercentage > 100 ||
    settings.winnerPercentage < 0 ||
    settings.winnerPercentage > 100 ||
    Number((settings.housePercentage + settings.winnerPercentage).toFixed(2)) !== 100
  ) {
    throw new Error('Os percentuais devem estar entre 0 e 100 e somar 100%.');
  }
}

const categorySelect = '*, pools!inner(*, draws!inner(id, contest, draw_date, numbers))';

async function readCategory(id: number | string): Promise<AdminCategory> {
  const { data, error } = await supabase.from('pool_categories').select(categorySelect).eq('id', String(id)).single();
  if (error) throw error;
  return mapCategory(data);
}

function validateCategoryInput(data: AdminCategoryInput) {
  if (typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('Informe o nome do bolão.');
  }
  if (
    typeof data.concurso !== 'string' ||
    !/^\d+$/.test(data.concurso.trim()) ||
    !Number.isSafeInteger(Number(data.concurso)) ||
    Number(data.concurso) <= 0
  ) {
    throw new Error('Informe um número de concurso válido.');
  }
  if (typeof data.quotaId !== 'string' || !data.quotaId.trim()) {
    throw new Error('Selecione uma cota do catálogo.');
  }
  if (typeof data.vagas !== 'number' || !Number.isSafeInteger(data.vagas) || data.vagas <= 0) {
    throw new Error('Informe a quantidade de vagas.');
  }
  if (typeof data.drawDate !== 'string' || !isValidIsoDate(toIsoDate(data.drawDate))) {
    throw new Error('Informe uma data de sorteio válida.');
  }
  if (
    typeof data.numbersPerBet !== 'number' ||
    !Number.isSafeInteger(data.numbersPerBet) ||
    data.numbersPerBet < 6 ||
    data.numbersPerBet > 20
  ) {
    throw new Error('A quantidade de dezenas por aposta deve estar entre 6 e 20.');
  }
  validatePrizeSettings({
    housePercentage: data.housePercentage,
    winnerPercentage: data.winnerPercentage,
  });
}

function validateOfficialNumbers(numbers: number[]) {
  if (
    !Array.isArray(numbers) ||
    numbers.length !== 6 ||
    numbers.some((number) => !Number.isSafeInteger(number) || number < 1 || number > 60) ||
    new Set(numbers).size !== 6
  ) {
    throw new Error('Informe exatamente 6 dezenas distintas entre 01 e 60.');
  }
}

async function requireAdmin() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('É necessário estar autenticado.');
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error) throw error;
  if (isAdmin !== true) throw new Error('Acesso administrativo necessário.');
}

export const adminService = {
  async getPrizeSettings(): Promise<PrizeSettings> {
    await requireAdmin();
    const { data, error } = await supabase
      .from('app_settings')
      .select('house_percentage, winner_percentage')
      .eq('id', 'global')
      .single();
    if (error) throw error;
    const settings = {
      housePercentage: Number(data.house_percentage),
      winnerPercentage: Number(data.winner_percentage),
    };
    validatePrizeSettings(settings);
    return settings;
  },

  async updatePrizeSettings(settings: PrizeSettings): Promise<PrizeSettings> {
    await requireAdmin();
    validatePrizeSettings(settings);
    const { data, error } = await supabase
      .from('app_settings')
      .update({
        house_percentage: settings.housePercentage,
        winner_percentage: settings.winnerPercentage,
      })
      .eq('id', 'global')
      .select('house_percentage, winner_percentage')
      .single();
    if (error) throw error;
    return {
      housePercentage: Number(data.house_percentage),
      winnerPercentage: Number(data.winner_percentage),
    };
  },

  async getMetrics(): Promise<AdminFinancialMetrics> {
    await requireAdmin();
    const adminIds = await getAdminUserIds();
    const { start, end } = getCurrentMonthRange();
    const [{ data: settlements, error: settlementsError }, { data: purchasedBets, error: betsError }] = await Promise.all([
      supabase
        .from('prize_settlements')
        .select('gross_amount, winners_amount, house_amount')
        .eq('status', 'success')
        .gte('created_at', start)
        .lt('created_at', end),
      supabase
        .from('purchased_bets')
        .select('user_id')
        .gte('created_at', start)
        .lt('created_at', end),
    ]);
    if (settlementsError) throw settlementsError;
    if (betsError) throw betsError;

    const totalArrecadado = (settlements ?? []).reduce(
      (sum: number, row: Row) => sum + Number(row.gross_amount ?? 0),
      0,
    );
    const premiosPagos = (settlements ?? []).reduce(
      (sum: number, row: Row) => sum + Number(row.winners_amount ?? 0),
      0,
    );
    const lucroRetido = (settlements ?? []).reduce(
      (sum: number, row: Row) => sum + Number(row.house_amount ?? 0),
      0,
    );
    const adminIdSet = new Set(adminIds);
    const apostadoresAtivos = new Set(
      (purchasedBets ?? [])
        .map((row: Row) => String(row.user_id))
        .filter((userId) => !adminIdSet.has(userId)),
    ).size;

    return {
      totalArrecadado,
      lucroRetido,
      lucroPercent: totalArrecadado ? (lucroRetido / totalArrecadado) * 100 : 0,
      premiosPagos,
      premiosPercent: totalArrecadado ? (premiosPagos / totalArrecadado) * 100 : 0,
      apostadoresAtivos,
    };
  },

  async getWithdrawals(): Promise<AdminWithdrawal[]> {
    await requireAdmin();
    // Consulta global excepcional: a RLS deve restringir esta leitura ao papel admin.
    const { data, error } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapWithdrawal);
  },

  async approveWithdrawal(id: string): Promise<AdminWithdrawal> {
    await requireAdmin();
    const { data, error } = await supabase.rpc('approve_withdrawal', { p_withdrawal_id: id });
    if (error) throw error;
    return mapWithdrawal(Array.isArray(data) ? data[0] : data);
  },

  async rejectWithdrawal(id: string): Promise<AdminWithdrawal> {
    await requireAdmin();
    const { data, error } = await supabase.rpc('reject_withdrawal', { p_withdrawal_id: id });
    if (error) throw error;
    return mapWithdrawal(Array.isArray(data) ? data[0] : data);
  },

  async getUsers({ page, pageSize, search, status }: AdminUsersQuery): Promise<AdminUsersPage> {
    await requireAdmin();
    const adminIds = await getAdminUserIds();
    const safePageSize = Math.max(1, Math.min(pageSize || ADMIN_USERS_PAGE_SIZE, 50));
    const safePage = Math.max(1, page);
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    let profilesQuery = supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, is_active, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (adminIds.length > 0) {
      profilesQuery = profilesQuery.not('id', 'in', `(${adminIds.join(',')})`);
    }
    if (status === 'active') profilesQuery = profilesQuery.eq('is_active', true);
    if (status === 'blocked') profilesQuery = profilesQuery.eq('is_active', false);
    if (search.trim()) {
      const searchTerm = escapeSearchTerm(search.trim());
      profilesQuery = profilesQuery.or(`full_name.ilike.*${searchTerm}*,phone.ilike.*${searchTerm}*`);
    }

    const { data, count, error } = await profilesQuery;
    if (error) throw error;
    const profileRows = (data ?? []) as Row[];
    const wallets = await getWallets(profileRows.map((row) => String(row.id)));
    const items = profileRows.map((row) => mapUser({ ...row, ...(wallets.get(String(row.id)) ?? {}) }));
    const totalCount = count ?? 0;
    return {
      items,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / safePageSize)),
      page: safePage,
      pageSize: safePageSize,
    };
  },

  async toggleUserStatus(id: number | string): Promise<AdminUser> {
    await requireAdmin();
    const { error } = await supabase.rpc('toggle_user_status', { p_user_id: String(id) });
    if (error) throw error;
    const { data, error: readError } = await supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, is_active, created_at')
      .eq('id', String(id))
      .single();
    if (readError) throw readError;
    const wallets = await getWallets([String(id)]);
    return mapUser({ ...data, ...(wallets.get(String(id)) ?? {}) });
  },

  async getCategories({ page, pageSize, status, month }: AdminCategoriesQuery): Promise<AdminCategoriesPage> {
    await requireAdmin();
    const safePageSize = Math.max(1, Math.min(pageSize || ADMIN_CATEGORIES_PAGE_SIZE, 50));
    const safePage = Math.max(1, page);
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    let categoriesQuery = supabase
      .from('pool_categories')
      .select(categorySelect, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
      .in('pools.status', status === 'open' ? ['open', 'late_registration'] : [status]);

    const [year, monthNumber] = month.split('-').map(Number);
    if (Number.isInteger(year) && Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
      const start = `${month}-01`;
      const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
      categoriesQuery = categoriesQuery.gte('pools.draws.draw_date', start).lt('pools.draws.draw_date', end);
    }

    const { data, count, error } = await categoriesQuery;
    if (error) throw error;
    const totalCount = count ?? 0;
    return {
      items: (data ?? []).map(mapCategory),
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / safePageSize)),
      page: safePage,
      pageSize: safePageSize,
    };
  },

  async createCategory(data: AdminCategoryInput): Promise<AdminCategory> {
    await requireAdmin();
    validateCategoryInput(data);

    const name = data.name.trim();
    const drawDate = toIsoDate(data.drawDate);
    const { data: quota, error: quotaError } = await supabase.from('quota_catalog').select('id, amount, is_active').eq('id', data.quotaId).eq('is_active', true).single();
    if (quotaError) throw quotaError;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const { data: category, error: categoryError } = await supabase.from('pool_categories').insert({ name, slug, status: 'active' }).select('*').single();
    if (categoryError) throw categoryError;
    const { data: draw, error: drawError } = await supabase.from('draws').insert({
      contest: data.concurso.trim(),
      draw_date: drawDate,
      location: 'Caixa Econômica Federal',
      numbers: [],
      is_published: false,
    }).select('id').single();
    if (drawError) throw drawError;
    const { error: poolError } = await supabase.from('pools').insert({
      category_id: category.id,
      draw_id: draw.id,
      name,
      quota_id: quota.id,
      buy_in: Number(quota.amount),
      prize_estimate: 0,
      speed: 'normal',
      game_type: 'Mega-Sena',
      status: 'open',
      filled_slots: 0,
      total_slots: data.vagas,
      min_numbers: data.numbersPerBet,
      max_numbers: data.numbersPerBet,
      total_lottery_numbers: 60,
      house_percentage: data.housePercentage,
      winner_percentage: data.winnerPercentage,
    });
    if (poolError) throw poolError;
    return readCategory(category.id);
  },

  async updateCategory(id: number | string, data: AdminCategoryInput): Promise<AdminCategory> {
    await requireAdmin();
    validateCategoryInput(data);
    const { data: pool, error: poolLookupError } = await supabase
      .from('pools')
      .select('id, draw_id')
      .eq('category_id', String(id))
      .single();
    if (poolLookupError) throw poolLookupError;

    const { data: quota, error: quotaError } = await supabase
      .from('quota_catalog')
      .select('id, amount, is_active')
      .eq('id', data.quotaId)
      .eq('is_active', true)
      .single();
    if (quotaError) throw quotaError;

    const name = data.name.trim();
    const drawDate = toIsoDate(data.drawDate);
    const { error: categoryError } = await supabase
      .from('pool_categories')
      .update({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') })
      .eq('id', String(id));
    if (categoryError) throw categoryError;
    const { error: poolError } = await supabase
      .from('pools')
      .update({
        name,
        quota_id: quota.id,
        buy_in: Number(quota.amount),
        total_slots: data.vagas,
        min_numbers: data.numbersPerBet,
        max_numbers: data.numbersPerBet,
        house_percentage: data.housePercentage,
        winner_percentage: data.winnerPercentage,
      })
      .eq('id', pool.id);
    if (poolError) throw poolError;
    const { error: drawError } = await supabase
      .from('draws')
      .update({ contest: data.concurso.trim(), draw_date: drawDate })
      .eq('id', pool.draw_id);
    if (drawError) throw drawError;
    return readCategory(id);
  },

  async deleteCategory(id: number | string): Promise<void> {
    await requireAdmin();
    const { data: pools, error: poolLookupError } = await supabase
      .from('pools')
      .select('id, draw_id')
      .eq('category_id', String(id))
      .limit(1);
    if (poolLookupError) throw poolLookupError;
    const pool = pools?.[0];
    if (!pool) throw new Error('Bolão não encontrado para exclusão.');

    const historyTables = ['purchased_bets', 'prize_settlements', 'prize_awards', 'bet_audit_ledger'] as const;
    for (const table of historyTables) {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('pool_id', pool.id);
      if (error) throw error;
      if ((count ?? 0) > 0) {
        throw new Error('Este bolão já possui apostas ou apuração registradas e não pode ser excluído. Use "Desativar" para retirá-lo da vitrine.');
      }
    }

    const { error: deletePoolError } = await supabase.from('pools').delete().eq('id', pool.id);
    if (deletePoolError) throw deletePoolError;

    if (pool.draw_id) {
      const { count: drawPoolCount, error: drawCountError } = await supabase
        .from('pools')
        .select('id', { count: 'exact', head: true })
        .eq('draw_id', pool.draw_id);
      if (drawCountError) throw drawCountError;
      if (drawPoolCount === 0) {
        const { error: deleteDrawError } = await supabase.from('draws').delete().eq('id', pool.draw_id);
        if (deleteDrawError) throw deleteDrawError;
      }
    }

    const { count: categoryPoolCount, error: categoryCountError } = await supabase
      .from('pools')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', String(id));
    if (categoryCountError) throw categoryCountError;
    if (categoryPoolCount === 0) {
      const { error: deleteCategoryError } = await supabase.from('pool_categories').delete().eq('id', String(id));
      if (deleteCategoryError) throw deleteCategoryError;
    }
  },

  async setCategoryActive(id: number | string, isActive: boolean): Promise<void> {
    await requireAdmin();
    const { data: pools, error: poolLookupError } = await supabase
      .from('pools')
      .select('id, status')
      .eq('category_id', String(id))
      .limit(1);
    if (poolLookupError) throw poolLookupError;
    const target = pools?.[0];
    if (!target) throw new Error('Bolão não encontrado.');

    if (!isActive && target.status === 'completed') {
      throw new Error('Bolões já concluídos não podem ser desativados.');
    }
    const { error } = await supabase
      .from('pools')
      .update({ status: isActive ? 'open' : 'inactive' })
      .eq('id', target.id);
    if (error) throw error;
  },

  async getAdminResultDetails(poolId: string): Promise<AdminResultDetail> {
    await requireAdmin();
    if (!poolId) throw new Error('Bolão inválido para consultar o resultado.');
    const { data, error } = await supabase.rpc('get_admin_pool_result_details', { p_pool_id: poolId });
    if (error) throw error;
    const result = (data ?? {}) as Row;
    const pool = (result.pool ?? {}) as Row;
    const draw = (result.draw ?? {}) as Row;
    const settlement = (result.settlement ?? {}) as Row;
    return {
      pool: {
        id: String(pool.id ?? poolId),
        name: String(pool.name ?? ''),
        buyIn: Number(pool.buy_in ?? 0),
        filledSlots: Number(pool.filled_slots ?? 0),
        totalSlots: Number(pool.total_slots ?? 0),
        housePercentage: Number(pool.house_percentage ?? 0),
        winnerPercentage: Number(pool.winner_percentage ?? 0),
        status: String(pool.status ?? ''),
        createdAt: pool.created_at ?? undefined,
        currentRound: Number(pool.current_round ?? 0),
        maxRounds: Number(pool.max_rounds ?? 20),
        settledAt: pool.settled_at ?? undefined,
      },
      rounds: (Array.isArray(result.rounds) ? result.rounds : []).map(mapRound),
      draw: {
        id: String(draw.id ?? ''),
        contest: String(draw.contest ?? ''),
        drawDate: String(draw.draw_date ?? ''),
        numbers: Array.isArray(draw.numbers) ? draw.numbers.map(Number) : [],
      },
      settlement: {
        id: String(settlement.id ?? ''),
        grossAmount: Number(settlement.gross_amount ?? 0),
        houseAmount: Number(settlement.house_amount ?? 0),
        winnersAmount: Number(settlement.winners_amount ?? 0),
        winnerCount: Number(settlement.winner_count ?? 0),
        status: String(settlement.status ?? ''),
        createdAt: settlement.created_at ?? undefined,
      },
      participantsCount: Number(result.participants_count ?? 0),
      betsCount: Number(result.bets_count ?? 0),
      winners: (Array.isArray(result.winners) ? result.winners : []).map((winner: Row) => ({
        awardId: String(winner.award_id ?? ''),
        userId: String(winner.user_id ?? ''),
        name: String(winner.name ?? 'Apostador'),
        email: String(winner.email ?? ''),
        phone: String(winner.phone ?? ''),
        cpf: String(winner.cpf ?? ''),
        pixKeyType: String(winner.pix_key_type ?? ''),
        pixKey: String(winner.pix_key ?? ''),
        hits: Number(winner.hits ?? 0),
        amount: Number(winner.amount ?? 0),
        numbers: Array.isArray(winner.numbers) ? winner.numbers.map(Number) : [],
        playedAt: String(winner.played_at ?? ''),
        awardedAt: String(winner.awarded_at ?? ''),
      })),
    };
  },

  async getPoolParticipants(poolId: string): Promise<AdminPoolDetail> {
    await requireAdmin();
    if (!poolId) throw new Error('Bolão inválido para consultar os apostadores.');
    const { data, error } = await supabase.rpc('get_admin_pool_participants', { p_pool_id: poolId });
    if (error) throw error;
    const result = (data ?? {}) as Row;
    const pool = (result.pool ?? {}) as Row;
    const draw = result.draw ? (result.draw as Row) : null;
    const settlement = result.settlement ? (result.settlement as Row) : null;
    const totals = (result.totals ?? {}) as Row;
    return {
      pool: {
        id: String(pool.id ?? poolId),
        name: String(pool.name ?? ''),
        categoryName: String(pool.category_name ?? ''),
        buyIn: Number(pool.buy_in ?? 0),
        filledSlots: Number(pool.filled_slots ?? 0),
        totalSlots: Number(pool.total_slots ?? 0),
        prizeEstimate: Number(pool.prize_estimate ?? 0),
        housePercentage: Number(pool.house_percentage ?? 0),
        winnerPercentage: Number(pool.winner_percentage ?? 0),
        status: String(pool.status ?? ''),
        createdAt: pool.created_at ?? undefined,
        currentRound: Number(pool.current_round ?? 0),
        maxRounds: Number(pool.max_rounds ?? 20),
        settledAt: pool.settled_at ?? undefined,
      },
      rounds: (Array.isArray(result.rounds) ? result.rounds : []).map(mapRound),
      draw: draw
        ? {
            id: String(draw.id ?? ''),
            contest: String(draw.contest ?? ''),
            drawDate: String(draw.draw_date ?? ''),
            numbers: Array.isArray(draw.numbers) ? draw.numbers.map(Number) : [],
            isPublished: draw.is_published === true,
          }
        : null,
      settlement: settlement
        ? {
            id: String(settlement.id ?? ''),
            grossAmount: Number(settlement.gross_amount ?? 0),
            houseAmount: Number(settlement.house_amount ?? 0),
            winnersAmount: Number(settlement.winners_amount ?? 0),
            winnerCount: Number(settlement.winner_count ?? 0),
            status: String(settlement.status ?? ''),
            createdAt: settlement.created_at ?? undefined,
          }
        : null,
      totals: {
        participantsCount: Number(totals.participants_count ?? 0),
        betsCount: Number(totals.bets_count ?? 0),
        grossAmount: Number(totals.gross_amount ?? 0),
      },
      participants: (Array.isArray(result.participants) ? result.participants : []).map(
        (participant: Row): AdminPoolParticipant => ({
          betId: String(participant.bet_id ?? ''),
          userId: String(participant.user_id ?? ''),
          name: String(participant.name ?? 'Apostador'),
          email: String(participant.email ?? ''),
          phone: String(participant.phone ?? ''),
          cpf: String(participant.cpf ?? ''),
          numbers: Array.isArray(participant.numbers) ? participant.numbers.map(Number) : [],
          cotaPrice: Number(participant.cota_price ?? 0),
          createdAt: String(participant.created_at ?? ''),
          hits: Number(participant.hits ?? 0),
          prizeAmount: Number(participant.prize_amount ?? 0),
        }),
      ),
    };
  },

  async getUserDetails(userId: number | string): Promise<AdminUserDetail> {
    await requireAdmin();
    const id = String(userId ?? '').trim();
    if (!id) throw new Error('Apostador inválido para consultar os detalhes.');
    const { data, error } = await supabase.rpc('get_admin_user_details', { p_user_id: id });
    if (error) throw error;
    const result = (data ?? {}) as Row;
    const profile = (result.profile ?? {}) as Row;
    const wallet = (result.wallet ?? {}) as Row;
    const stats = (result.stats ?? {}) as Row;
    return {
      profile: {
        id: String(profile.id ?? id),
        fullName: profile.full_name ?? null,
        email: String(profile.email ?? ''),
        phone: profile.phone ?? null,
        cpf: profile.cpf ?? null,
        pixKeyType: profile.pix_key_type ?? null,
        pixKey: profile.pix_key ?? null,
        avatarUrl: profile.avatar_url ?? null,
        isActive: profile.is_active !== false,
        createdAt: String(profile.created_at ?? ''),
      },
      wallet: {
        total: Number(wallet.total ?? 0),
        withdrawable: Number(wallet.withdrawable ?? 0),
        bonus: Number(wallet.bonus ?? 0),
        createdAt: wallet.created_at ?? undefined,
      },
      stats: {
        betsCount: Number(stats.bets_count ?? 0),
        totalWagered: Number(stats.total_wagered ?? 0),
        prizesCount: Number(stats.prizes_count ?? 0),
        prizesAmount: Number(stats.prizes_amount ?? 0),
        withdrawalsCount: Number(stats.withdrawals_count ?? 0),
        withdrawalsPaid: Number(stats.withdrawals_paid ?? 0),
        depositsTotal: Number(stats.deposits_total ?? 0),
      },
      bets: (Array.isArray(result.bets) ? result.bets : []).map(
        (bet: Row): AdminUserBet => ({
          betId: String(bet.bet_id ?? ''),
          poolId: String(bet.pool_id ?? ''),
          poolName: String(bet.pool_name ?? 'Bolão'),
          contest: String(bet.contest ?? ''),
          drawDate: String(bet.draw_date ?? ''),
          numbers: Array.isArray(bet.numbers) ? bet.numbers.map(Number) : [],
          cotaPrice: Number(bet.cota_price ?? 0),
          createdAt: String(bet.created_at ?? ''),
          hits: Number(bet.hits ?? 0),
          prizeAmount: Number(bet.prize_amount ?? 0),
          poolStatus: String(bet.pool_status ?? ''),
        }),
      ),
      prizes: (Array.isArray(result.prizes) ? result.prizes : []).map(
        (prize: Row): AdminUserPrize => ({
          awardId: String(prize.award_id ?? ''),
          poolName: String(prize.pool_name ?? 'Bolão'),
          hits: Number(prize.hits ?? 0),
          amount: Number(prize.amount ?? 0),
          createdAt: String(prize.created_at ?? ''),
        }),
      ),
      withdrawals: (Array.isArray(result.withdrawals) ? result.withdrawals : []).map(
        (withdrawal: Row): AdminUserWithdrawal => ({
          id: String(withdrawal.id ?? ''),
          amount: Number(withdrawal.amount ?? 0),
          pixKeyType: String(withdrawal.pix_key_type ?? ''),
          pixKey: String(withdrawal.pix_key ?? ''),
          status: String(withdrawal.status ?? 'pending'),
          createdAt: String(withdrawal.created_at ?? ''),
          reviewedAt: withdrawal.reviewed_at ?? null,
        }),
      ),
      transactions: (Array.isArray(result.transactions) ? result.transactions : []).map(
        (transaction: Row): AdminUserTransaction => ({
          id: String(transaction.id ?? ''),
          entryType: String(transaction.entry_type ?? ''),
          amount: Number(transaction.amount ?? 0),
          status: String(transaction.status ?? 'success'),
          createdAt: String(transaction.created_at ?? ''),
          title: String(transaction.title ?? 'Movimentação'),
        }),
      ),
    };
  },

  async publishPoolRound(input: PublishRoundInput): Promise<PublishRoundOutcome> {
    await requireAdmin();
    if (!input.poolId) throw new Error('Bolão inválido para publicar a rodada.');
    const contest = typeof input.concurso === 'string' ? input.concurso.trim() : '';
    if (!/^\d+$/.test(contest) || !Number.isSafeInteger(Number(contest)) || Number(contest) <= 0) {
      throw new Error('Informe um número de concurso válido.');
    }
    if (typeof input.drawDate !== 'string' || !isValidIsoDate(toIsoDate(input.drawDate))) {
      throw new Error('Informe uma data de sorteio válida.');
    }
    validateOfficialNumbers(input.dezenas);
    const { data, error } = await supabase.rpc('publish_pool_round', {
      p_pool_id: input.poolId,
      p_concurso: contest,
      p_draw_date: toIsoDate(input.drawDate),
      p_numbers: input.dezenas,
      p_round_id: input.roundId ?? null,
    });
    if (error) throw error;
    const outcome = (data ?? {}) as Row;
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('category_id')
      .eq('id', input.poolId)
      .single();
    if (poolError) throw poolError;
    const category = await readCategory(pool.category_id);
    return {
      settled: outcome.settled === true,
      message: String(outcome.message ?? ''),
      roundNumber: Number(outcome.round_number ?? 0),
      maxRounds: Number(outcome.max_rounds ?? 20),
      maxHits: Number(outcome.max_hits ?? 0),
      winnerCount: Number(outcome.winner_count ?? 0),
      gross: Number(outcome.gross_amount ?? 0),
      house: Number(outcome.house_amount ?? 0),
      winners: Number(outcome.winners_amount ?? 0),
      category,
    };
  },

  async executeManualDraw(input: ManualDrawInput): Promise<{ message: string; drawnNumbers: number[] }> {
    await requireAdmin();
    const contest = input.concurso.trim();
    const drawData = {
      contest,
      draw_date: toIsoDate(input.data),
      location: 'Caixa Econômica Federal',
      numbers: input.dezenas,
      is_published: true,
    };
    const { data: existingDraw, error: lookupError } = await supabase
      .from('draws')
      .select('id')
      .eq('contest', contest)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existingDraw) {
      const { error } = await supabase.from('draws').update(drawData).eq('id', existingDraw.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('draws').insert(drawData);
      if (error) throw error;
    }

    return {
      message: `Concurso #${input.concurso} registrado com sucesso.`,
      drawnNumbers: input.dezenas,
    };
  },
};
