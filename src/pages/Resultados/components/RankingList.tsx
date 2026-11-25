import React from 'react';
import { Game, RankingParticipant } from '../../../types';
import PoolRankingTable from '../../../components/PoolRankingTable';

interface RankingListProps {
  ranking: RankingParticipant[];
  officialNumbers?: number[];
  isLoading?: boolean;
  searchTerm?: string;
  game?: Game | null;
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RankingList({
  ranking,
  officialNumbers = [],
  isLoading,
  searchTerm = '',
  game,
}: RankingListProps) {
  const hasOfficial = officialNumbers.length > 0;
  const gameDetails = game
    ? [
        <span key="name" className="font-bold text-white">{game.nome}</span>,
        ...(game.concursoRef?.trim()
          ? [<span key="contest">Concurso {game.concursoRef}</span>]
          : []),
        ...(game.premio > 0
          ? [<span key="prize">Prêmio {formatCurrency(game.premio)}</span>]
          : []),
        ...(game.buyIn > 0
          ? [<span key="buy-in">Cota {formatCurrency(game.buyIn)}</span>]
          : []),
      ]
    : [];

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-[2rem] p-2 sm:p-4 shadow-2xl shadow-black/20">
      {game && (
        <div className="flex items-center gap-x-2 overflow-x-auto whitespace-nowrap px-3 pb-3 pt-2 text-[11px] text-slate-400">
          {gameDetails.map((detail, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span aria-hidden="true">·</span>}
              {detail}
            </React.Fragment>
          ))}
        </div>
      )}
      {hasOfficial && (
        <div className="px-3 sm:px-4 pt-3 pb-2 flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider">
          <i className="fa-solid fa-circle-info text-emerald-500/70" aria-hidden="true"></i>
          <span>Dezenas apostadas por cada participante · destacadas em verde quando premiadas</span>
        </div>
      )}
      {!hasOfficial && ranking.length > 0 && (
        <div
          role="status"
          className="mx-2 sm:mx-4 mt-3 mb-1 flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-200/90"
        >
          <i className="fa-regular fa-clock text-amber-400" aria-hidden="true"></i>
          <span>Resultado oficial ainda não publicado · exibindo apenas as dezenas apostadas.</span>
        </div>
      )}
      <PoolRankingTable
        ranking={ranking}
        officialNumbers={officialNumbers}
        isLoading={isLoading}
        searchTerm={searchTerm}
      />
    </div>
  );
}
