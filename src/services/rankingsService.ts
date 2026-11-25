import { supabase } from '@/integrations/supabase/client';
import { RankingParticipant } from '../types';

type Row = Record<string, any>;

function mapParticipant(row: Row): RankingParticipant {
  const name = row.name ?? row.display_name ?? 'Apostador';
  return {
    id: row.id,
    gameId: String(row.game_id ?? row.pool_id ?? ''),
    name,
    initials: row.initials ?? String(name).slice(0, 2).toUpperCase(),
    isMe: Boolean(row.is_me),
    hits: Number(row.hits ?? 0),
    numbers: Array.isArray(row.numbers) ? row.numbers.map(Number) : [],
    prizeAmount: Number(row.prize_amount ?? 0),
    officialNumbers: Array.isArray(row.official_numbers) ? row.official_numbers.map(Number) : [],
  };
}

export const rankingsService = {
  async getAll(poolId?: string): Promise<RankingParticipant[]> {
    const { data, error } = await supabase.rpc('get_pool_ranking', {
      p_pool_id: poolId ?? null,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map(mapParticipant);
  },
};
