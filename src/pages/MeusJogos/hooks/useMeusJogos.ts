import { useMemo, useState } from 'react';
import { useOwnBets } from '../../../hooks/useBets';
import { OwnBet } from '../../../types';

export type MeusJogosFilter = 'all' | 'running' | 'result' | 'prized';

export function useMeusJogos() {
  const { data: bets = [], isLoading, isError, refetch } = useOwnBets();
  const [filter, setFilter] = useState<MeusJogosFilter>('all');
  const [selectedBet, setSelectedBet] = useState<OwnBet | null>(null);

  const summary = useMemo(() => {
    const totalWagered = bets.reduce((sum, bet) => sum + bet.cotaPrice, 0);
    const prizesAmount = bets.reduce((sum, bet) => sum + bet.prizeAmount, 0);
    const prizesCount = bets.filter((bet) => bet.prizeAmount > 0).length;
    return { betsCount: bets.length, totalWagered, prizesAmount, prizesCount };
  }, [bets]);

  const filteredBets = useMemo(() => {
    switch (filter) {
      case 'running':
        return bets.filter((bet) => bet.poolStatus !== 'completed');
      case 'result':
        return bets.filter((bet) => bet.roundsPublished > 0);
      case 'prized':
        return bets.filter((bet) => bet.prizeAmount > 0);
      default:
        return bets;
    }
  }, [bets, filter]);

  return {
    bets,
    filteredBets,
    summary,
    isLoading,
    isError,
    refetch,
    filter,
    setFilter,
    selectedBet,
    setSelectedBet,
  };
}
