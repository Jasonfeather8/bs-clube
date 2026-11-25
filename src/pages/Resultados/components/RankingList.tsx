import React from 'react';
import { RankingParticipant } from '../../../types';

interface RankingListProps {
  ranking: RankingParticipant[];
  officialNumbers?: number[];
  isLoading?: boolean;
}

function pad(number: number) {
  return String(number).padStart(2, '0');
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RankingList({ ranking, officialNumbers = [], isLoading }: RankingListProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-[2rem] p-4 sm:p-6 space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-slate-800"></div>
              <div className="space-y-1.5">
                <div className="w-28 h-3.5 bg-slate-800 rounded"></div>
                <div className="w-16 h-2.5 bg-slate-800/60 rounded"></div>
              </div>
            </div>
            <div className="flex space-x-1.5">
              {[1, 2, 3, 4, 5, 6].map((b) => (
                <div key={b} className="w-6 h-6 rounded-full bg-slate-800"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const officialSet = new Set(officialNumbers);
  const hasOfficial = officialNumbers.length > 0;

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-[2rem] p-2 sm:p-4 shadow-2xl shadow-black/20">
      {hasOfficial && (
        <div className="px-3 sm:px-4 pt-3 pb-2 flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider">
          <i className="fa-solid fa-circle-info text-emerald-500/70" aria-hidden="true"></i>
          <span>Dezenas apostadas por cada participante · destacadas em verde quando premiadas</span>
        </div>
      )}
      <div className="space-y-2">
        {ranking.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <i className="fa-solid fa-users-slash text-2xl text-slate-600 block"></i>
            <span>Nenhum participante encontrado para este filtro.</span>
          </div>
        ) : (
          ranking.map((p, index) => {
            let positionHtml = (
              <span className="text-xs font-bold text-slate-500 w-4">{index + 1}º</span>
            );
            let avatarColor = 'bg-slate-800 text-slate-400 border-slate-700';

            if (index === 0) {
              positionHtml = (
                <i className="fa-solid fa-medal text-brand-gold w-4 text-center"></i>
              );
              avatarColor =
                'bg-amber-500 text-slate-900 border-amber-400 shadow-lg shadow-amber-900/30';
            } else if (index === 1) {
              positionHtml = (
                <i className="fa-solid fa-medal text-slate-300 w-4 text-center"></i>
              );
            } else if (index === 2) {
              positionHtml = (
                <i className="fa-solid fa-medal text-amber-700 w-4 text-center"></i>
              );
            }

            if (p.isMe) {
              avatarColor =
                'bg-emerald-500 text-slate-900 border-emerald-400 shadow-lg shadow-emerald-900/30';
            }

            return (
              <div
                key={p.id}
                className={`bg-slate-950 p-3 sm:p-4 rounded-2xl border ${
                  p.isMe ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'
                } space-y-3 transition hover:border-slate-700`}
              >
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    {positionHtml}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border shrink-0 ${avatarColor}`}
                    >
                      {p.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <p
                          className={`text-sm font-bold truncate ${
                            p.isMe ? 'text-emerald-400' : 'text-white'
                          }`}
                        >
                          {p.isMe ? 'Você' : p.name}
                        </p>
                        {p.isMe && (
                          <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
                            Você
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {p.hits ?? 0} {p.hits === 1 ? 'acerto' : 'acertos'}
                      </p>
                    </div>
                  </div>

                  {p.prizeAmount > 0 && (
                    <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0">
                      <i className="fa-solid fa-trophy" aria-hidden="true"></i>
                      {formatCurrency(p.prizeAmount)}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {p.numbers.map((number) => {
                    const isHit = hasOfficial && officialSet.has(number);
                    return (
                      <span
                        key={number}
                        className={`w-7 h-7 rounded-lg text-[11px] font-bold flex items-center justify-center font-mono border ${
                          isHit
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {pad(number)}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
