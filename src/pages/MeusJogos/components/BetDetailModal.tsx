import React from 'react';
import { OwnBet } from '../../../types';

interface BetDetailModalProps {
  isOpen: boolean;
  bet: OwnBet | null;
  onClose: () => void;
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
}

function pad(number: number) {
  return String(number).padStart(2, '0');
}

function statusBadge(status: string) {
  switch (status) {
    case 'open':
      return { label: 'Aberto', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    case 'late_registration':
      return { label: 'Reg. Tardio', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'closed':
      return { label: 'Encerrado', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'completed':
      return { label: 'Concluído', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'inactive':
      return { label: 'Inativo', className: 'bg-slate-800 text-slate-400 border-slate-700' };
    default:
      return { label: status || '—', className: 'bg-slate-800 text-slate-400 border-slate-700' };
  }
}

function Metric({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function BetDetailModal({ isOpen, bet, onClose }: BetDetailModalProps) {
  if (!isOpen || !bet) return null;

  const status = statusBadge(bet.poolStatus);
  const officialSet = new Set(bet.officialNumbers);
  const reachedGoal = bet.hits >= bet.goal;
  const orderedRounds = [...bet.rounds].sort((a, b) => a.roundNumber - b.roundNumber);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="bet-detail-title">
      <div className="glass-card w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-emerald-500/30 p-5 sm:p-6 relative shadow-2xl">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded" aria-label="Fechar detalhe da aposta">
          <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
        </button>

        <div className="mb-5 border-b border-slate-800 pb-4 pr-8">
          <h3 id="bet-detail-title" className="font-heading text-lg font-bold text-white flex items-center flex-wrap gap-2">
            <i className="fa-solid fa-dice text-emerald-400" aria-hidden="true"></i>
            <span className="truncate">{bet.poolName}</span>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${status.className}`}>{status.label}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Concurso #{bet.contest || '—'} · Sorteio {formatDate(bet.drawDate)}
            {bet.roundsPublished > 0 && ` · Rodada ${bet.currentRound} de ${bet.maxRounds}`}
          </p>
        </div>

        <div className="space-y-5">
          <section aria-labelledby="bet-own-numbers-title">
            <div className="flex items-center justify-between mb-2">
              <h4 id="bet-own-numbers-title" className="text-sm font-bold text-white">Sua cartela</h4>
              <span className="text-[11px] text-slate-500">{bet.numbers.length} dezenas</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {bet.numbers.map((number) => {
                const matched = officialSet.has(number);
                return (
                  <span
                    key={number}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black font-mono text-sm border ${
                      matched ? 'bg-amber-500/20 text-amber-300 border-amber-400/60' : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    {pad(number)}
                  </span>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="bet-official-numbers-title">
            <h4 id="bet-official-numbers-title" className="text-sm font-bold text-white mb-2">Dezenas já sorteadas</h4>
            {bet.roundsPublished > 0 ? (
              <div className="flex flex-wrap gap-2">
                {bet.officialNumbers.map((number) => {
                  const matched = bet.numbers.includes(number);
                  return (
                    <span
                      key={number}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-black font-mono text-sm border ${
                        matched ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      {pad(number)}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400 flex items-center gap-2" role="status">
                <i className="fa-regular fa-clock" aria-hidden="true"></i>
                Nenhuma rodada publicada ainda.
              </div>
            )}
          </section>

          <section aria-labelledby="bet-progress-title">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 id="bet-progress-title" className="text-sm font-bold text-white">Progresso até a meta</h4>
              {reachedGoal && <span className="text-xs font-bold text-amber-300">Meta atingida</span>}
            </div>
            <p className={`text-xs ${reachedGoal ? 'text-amber-300' : 'text-slate-400'}`}>
              {bet.hits} de {bet.goal} dezenas da sua cartela já foram sorteadas
            </p>
            <div
              className="mt-2 bg-slate-800 h-2 rounded-full overflow-hidden"
              role="progressbar"
              aria-label={`Progresso até a meta: ${bet.hits} de ${bet.goal} dezenas sorteadas`}
              aria-valuemin={0}
              aria-valuemax={bet.goal}
              aria-valuenow={bet.hits}
            >
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, (bet.hits / bet.goal) * 100)}%` }} />
            </div>
          </section>

          <section aria-labelledby="bet-rounds-title">
            <h4 id="bet-rounds-title" className="text-sm font-bold text-white mb-2">Rodadas</h4>
            {orderedRounds.length > 0 ? (
              <div className="space-y-3">
                {orderedRounds.map((round) => (
                  <div key={round.roundNumber} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs font-semibold text-slate-300">
                      Rodada {round.roundNumber} · Concurso {round.concurso} · {formatDate(round.drawDate)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {round.numbers.map((number, index) => {
                        const matched = bet.numbers.includes(number);
                        return (
                          <span
                            key={`${number}-${index}`}
                            className={`w-7 h-7 rounded-lg text-[11px] font-bold flex items-center justify-center font-mono border ${
                              matched ? 'bg-amber-500/20 border-amber-400/60 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            {pad(number)}
                          </span>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {round.hits} {round.hits === 1 ? 'dezena' : 'dezenas'} da sua cartela nesta rodada
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500" role="status">Nenhuma rodada para exibir.</p>
            )}
          </section>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Metric
              label="Acertos acumulados"
              value={`${bet.hits}/${bet.goal}`}
              valueClass={reachedGoal ? 'text-amber-300' : 'text-white'}
            />
            <Metric label="Prêmio" value={bet.prizeAmount > 0 ? formatCurrency(bet.prizeAmount) : '—'} valueClass="text-amber-300" />
            <Metric label="Valor pago" value={formatCurrency(bet.cotaPrice)} valueClass="text-emerald-400" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Aposta registrada em</p>
            <p className="mt-1 text-sm font-bold text-white">{formatDateTime(bet.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
