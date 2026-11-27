import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useWalletBalance } from '../../../hooks/useWallet';
import { usePoolRounds } from '../../../hooks/useDraws';
import { useRankingGames } from '../../../hooks/useGames';
import { useRankings } from '../../../hooks/useRankings';
import { useOwnPrizeAwards } from '../../../hooks/usePrizeAwards';
import { Game } from '../../../types';

export function useResultadosRanking() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: walletBalance } = useWalletBalance();
  const authMode = session ? 'auth' as const : 'guest' as const;

  const { data: games = [], isLoading: isLoadingGames } = useRankingGames();

  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [selectedDrawId, setSelectedDrawId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);

  const rankingGameId = selectedGameId || games[0]?.id;
  const { data: draws = [], isLoading: isLoadingDraws } = usePoolRounds(rankingGameId);
  const effectiveSelectedDrawId = draws.some((draw) => draw.id === selectedDrawId)
    ? selectedDrawId
    : draws[0]?.id ?? '';

  // O ranking é sempre do próprio bolão selecionado (usa o sorteio vinculado a ele),
  // e não do sorteio escolhido no carrossel de sorteios oficiais.
  const { data: participants = [], isLoading: isLoadingParticipants } = useRankings(rankingGameId);
  const { data: ownPrizeAwards = [], isLoading: isLoadingPrizeAwards } = useOwnPrizeAwards(rankingGameId);

  const rankingOfficialNumbers = useMemo(
    () => participants[0]?.officialNumbers ?? [],
    [participants],
  );

  // Hits are calculated by the ranking RPC from the pool's own official draw.
  const ranking = useMemo(() => {
    if (!participants || participants.length === 0) return [];

    let processed = [...participants];
    processed.sort((a, b) => {
      if (b.hits !== a.hits) return b.hits - a.hits;
      return a.name.localeCompare(b.name);
    });

    if (searchTerm.trim() !== '') {
      const term = searchTerm.trim().toLowerCase();
      processed = processed.filter((p) => (p.isMe ? 'você' : p.name).toLowerCase().includes(term));
    }
    return processed;
  }, [participants, searchTerm]);

  const activeGame: Game | null = useMemo(() => {
    return games.find((g) => g.id === rankingGameId) || null;
  }, [games, rankingGameId]);

  const openLogin = () => {
    setIsGuestModalOpen(false);
    navigate('/login', { state: { from: '/resultados' } });
  };

  const isLoading = isLoadingDraws || isLoadingGames || isLoadingParticipants || isLoadingPrizeAwards;

  return {
    draws,
    games,
    selectedGameId: rankingGameId || '',
    setSelectedGameId,
    selectedDrawId: effectiveSelectedDrawId,
    setSelectedDrawId,
    activeGame,
    ownPrizeAwards,
    ranking,
    rankingOfficialNumbers,
    searchTerm,
    setSearchTerm,
    isGuestModalOpen,
    setIsGuestModalOpen,
    authMode,
    balanceTotal: walletBalance?.total ?? 0,
    openLogin,
    isLoading,
  };
}
