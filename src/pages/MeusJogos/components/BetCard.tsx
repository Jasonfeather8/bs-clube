import React from 'react';
import { OwnBet } from '../../../types';

interface BetCardProps {
  key?: React.Key;
  bet: OwnBet;
  onOpen: (bet: OwnBet) => void;
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

export default function BetCard({ bet, onOpen }: BetCardProps) {
  const status = statusBadge(bet.poolStatus);
  const completed = bet.poolStatus === 'completed';
  const officialSet = new Set(bet.officialNumbers);

  return (
    <button
      type="button"
      onClick={() => onOpen(bet)}
      aria-label={`Ver detalhes da aposta no bolão ${bet.poolName}`}
      className="w-full text-left rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5 transition hover:border-emerald-500/40 hover:bg-slate-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-heading font-bold text-white truncate">{bet.poolName}</h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.className}`}>{status.label}</span>
            {bet.prizeAmount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/20 flex items-center gap-1">
                <i className="fa-solid fa-trophy" aria-hidden="true"></i>Premiada
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Concurso #{bet.contest || '—'} · Sorteio {formatDate(bet.drawDate)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-emerald-400 font-mono">{formatCurrency(bet.cotaPrice)}</p>
          <p className="text-[10px] text-slate-500 font-mono">{formatDateTime(bet.createdAt)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {bet.numbers.map((number) => {
          const matched = completed && officialSet.has(number);
          return (
            <span
              key={number}
              className={`w-7 h-7 rounded-lg text-[11px] font-bold flex items-center justify-center font-mono border ${
                matched ? 'bg-amber-500/20 border-amber-400/50 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {pad(number)}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        {completed ? (
          <span className="text-slate-400">
            Acertos: <strong className={bet.hits >= 4 ? 'text-amber-300' : 'text-slate-200'}>{bet.hits}</strong> de {bet.numbers.length}
          </span>
        ) : (
          <span className="text-slate-500 flex items-center gap-1.5">
            <i className="fa-regular fa-clock" aria-hidden="true"></i>Aguardando resultado oficial
          </span>
        )}
        {bet.prizeAmount > 0 ? (
          <span className="text-amber-300 font-bold whitespace-nowrap">Prêmio: {formatCurrency(bet.prizeAmount)}</span>
        ) : (
          <span className="text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
            Detalhes<i className="fa-solid fa-chevron-right text-[9px]" aria-hidden="true"></i>
          </span>
        )}
      </div>
    </button>
  );
}
