import React from 'react';
import { RankingParticipant } from '../types';

interface PoolRankingTableProps {
  ranking: RankingParticipant[];
  officialNumbers?: number[];
  isLoading?: boolean;
  searchTerm?: string;
  showPrize?: boolean;
  ariaLabel?: string;
}

function pad(number: number) {
  return String(number).padStart(2, '0');
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PoolRankingTable({
  ranking,
  officialNumbers = [],
  isLoading = false,
  searchTerm = '',
  showPrize = true,
  ariaLabel = 'Ranking de participantes do bolão',
}: PoolRankingTableProps) {
  const officialSet = new Set(officialNumbers);
  const hasOfficial = officialNumbers.length > 0;
  const groups: { hits: number; participants: RankingParticipant[] }[] = [];

  if (hasOfficial) {
    ranking.forEach((participant) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.hits === participant.hits) {
        lastGroup.participants.push(participant);
      } else {
        groups.push({ hits: participant.hits, participants: [participant] });
      }
    });
  }

  const tableHeader = (
    <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
      <tr>
        <th scope="col" className="w-12 px-2 py-2 text-center font-medium">Ord</th>
        <th scope="col" className="px-3 py-2 text-left font-medium">Nome</th>
        <th scope="col" className="px-3 py-2 text-center font-medium">Dezenas</th>
        <th scope="col" className="px-3 py-2 text-center font-medium">Acertos</th>
        {showPrize && <th scope="col" className="px-3 py-2 text-center font-medium">Prêmio</th>}
      </tr>
    </thead>
  );

  const renderParticipant = (participant: RankingParticipant, ordinal: number) => (
    <tr
      key={participant.id}
      className={`border-b border-slate-800/70 last:border-0 ${participant.isMe ? 'bg-emerald-950/20' : ''}`}
    >
      <td className="px-2 py-2 text-center text-xs font-mono text-slate-500 whitespace-nowrap">{ordinal}</td>
      <td className={`px-3 py-2 text-sm font-bold whitespace-nowrap ${participant.isMe ? 'text-emerald-400' : 'text-white'}`}>
        {participant.isMe ? 'Você' : participant.name}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
          {participant.numbers.map((number) => {
            const isHit = hasOfficial && officialSet.has(number);
            return (
              <span
                key={`${participant.id}-${number}`}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-mono font-bold ${
                  isHit
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-800 text-slate-300'
                }`}
              >
                {pad(number)}
              </span>
            );
          })}
        </div>
      </td>
      <td className={`px-3 py-2 text-center font-mono font-bold whitespace-nowrap ${participant.hits >= (participant.goal || 6) ? 'text-amber-300' : participant.hits > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
        <div>{participant.hits}/{participant.goal || 6}</div>
        <div
          role="progressbar"
          aria-label={`Progresso: ${participant.hits} de ${participant.goal || 6} acertos`}
          aria-valuemin={0}
          aria-valuemax={participant.goal || 6}
          aria-valuenow={participant.hits}
          className="mx-auto mt-1 h-1.5 w-14 overflow-hidden rounded-full bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${Math.min((participant.hits / (participant.goal || 6)) * 100, 100)}%` }}
          />
        </div>
      </td>
      {showPrize && (
        <td className={`px-3 py-2 text-center font-bold whitespace-nowrap ${participant.prizeAmount > 0 ? 'text-amber-300' : 'text-slate-600'}`}>
          {participant.prizeAmount > 0 ? formatCurrency(participant.prizeAmount) : '—'}
        </td>
      )}
    </tr>
  );

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando ranking" className="overflow-x-auto animate-pulse px-2">
        <table aria-label="Carregando ranking de participantes" className="w-full min-w-[560px] border-collapse">
          {tableHeader}
          <tbody>
            {[1, 2, 3, 4].map((row) => (
              <tr key={row} className="border-b border-slate-800/70">
                <td className="px-2 py-3"><div className="mx-auto h-3 w-4 rounded bg-slate-800" /></td>
                <td className="px-3 py-3"><div className="h-3 w-28 rounded bg-slate-800" /></td>
                <td className="px-3 py-2">
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5, 6].map((number) => (
                      <span key={number} className="h-6 w-6 rounded-full bg-slate-800" />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3"><div className="mx-auto h-3 w-5 rounded bg-slate-800" /></td>
                {showPrize && <td className="px-3 py-3"><div className="mx-auto h-3 w-14 rounded bg-slate-800" /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (ranking.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 space-y-2" role="status">
        <i className="fa-solid fa-users-slash text-2xl text-slate-600 block" aria-hidden="true"></i>
        {searchTerm.trim() ? (
          <span>Nenhum participante encontrado para esta busca.</span>
        ) : (
          <>
            <span className="block font-bold text-slate-400">Este bolão ainda não possui apostadores</span>
            <span className="block">Assim que alguém comprar uma cota, o nome aparece aqui.</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table aria-label={ariaLabel} className="w-full min-w-[560px] border-collapse">
        {tableHeader}
        <tbody>
          {hasOfficial
            ? (() => {
                let ordinal = 0;
                return groups.map((group) => (
                  <React.Fragment key={`hits-${group.hits}`}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={showPrize ? 5 : 4}
                        className="bg-slate-800/80 px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-white"
                      >
                        {group.participants.length} {group.participants.length === 1 ? 'aposta' : 'apostas'} com {group.hits} de {group.participants[0]?.goal || 6} {group.hits === 1 ? 'acerto' : 'acertos'}
                      </th>
                    </tr>
                    {group.participants.map((participant) => renderParticipant(participant, ++ordinal))}
                  </React.Fragment>
                ));
              })()
            : ranking.map((participant, index) => renderParticipant(participant, index + 1))}
        </tbody>
      </table>
    </div>
  );
}
