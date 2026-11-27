import React, { useEffect, useState } from 'react';
import { AdminCategory, AdminRound, PublishRoundInput } from '../../../types';

interface PublishRoundModalProps {
  isOpen: boolean;
  category: AdminCategory | null;
  round?: AdminRound | null;
  onClose: () => void;
  onSubmit: (data: PublishRoundInput) => void;
  isSubmitting: boolean;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function PublishRoundModal({ isOpen, category, round, onClose, onSubmit, isSubmitting }: PublishRoundModalProps) {
  const [contest, setContest] = useState('');
  const [drawDate, setDrawDate] = useState('');
  const [numbers, setNumbers] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const isCorrection = Boolean(round);

  useEffect(() => {
    if (!isOpen || !category) return;
    setContest(round?.contest ?? '');
    setDrawDate(round?.drawDate.slice(0, 10) ?? localToday());
    setNumbers(round?.numbers.length === 6 ? round.numbers.map((number) => String(number).padStart(2, '0')) : ['', '', '', '', '', '']);
    setError('');
  }, [category, isOpen, round]);

  if (!isOpen || !category) return null;

  const handleNumberChange = (index: number, value: string) => {
    const next = [...numbers];
    next[index] = value.replace(/\D/g, '').slice(0, 2);
    setNumbers(next);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedContest = contest.trim();
    if (!normalizedContest || !/^\d+$/.test(normalizedContest) || !Number.isSafeInteger(Number(normalizedContest)) || Number(normalizedContest) <= 0) {
      setError('Informe um número de concurso válido.');
      return;
    }
    if (!isValidDate(drawDate)) {
      setError('Selecione uma data de sorteio válida.');
      return;
    }
    const parsed = numbers.map(Number);
    if (numbers.some((value) => !value) || parsed.some((number) => !Number.isSafeInteger(number) || number < 1 || number > 60) || new Set(parsed).size !== 6) {
      setError('Informe exatamente 6 dezenas distintas entre 01 e 60.');
      return;
    }
    onSubmit({
      poolId: category.poolId ?? '',
      concurso: normalizedContest,
      drawDate,
      dezenas: parsed.sort((a, b) => a - b),
      roundId: round?.id,
    });
  };

  const nextRound = round?.roundNumber ?? category.currentRound + 1;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="publish-round-title">
      <div className="glass-card w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-amber-500/30 p-6 relative shadow-2xl">
        <button type="button" onClick={onClose} disabled={isSubmitting} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-400 rounded" aria-label="Fechar publicação de rodada">
          <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
        </button>
        <div className="mb-5 border-b border-slate-800 pb-4 pr-8">
          <h3 id="publish-round-title" className="font-heading text-xl font-bold text-white flex items-center text-amber-400">
            <i className="fa-solid fa-bullhorn mr-2 text-lg" aria-hidden="true"></i>{isCorrection ? `Corrigir dezenas da rodada ${round?.roundNumber}` : 'Publicar próxima rodada'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">{category.name} · Rodada {nextRound} de {category.maxRounds}</p>
        </div>
        {error && <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="publish-round-contest" className="block text-xs font-semibold text-slate-400 mb-1">Concurso</label>
            <input id="publish-round-contest" type="text" inputMode="numeric" value={contest} onChange={(event) => setContest(event.target.value.replace(/\D/g, ''))} disabled={isCorrection} className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/70 disabled:opacity-60" />
          </div>
          <div>
            <label htmlFor="publish-round-date" className="block text-xs font-semibold text-slate-400 mb-1">Data do sorteio</label>
            <input id="publish-round-date" type="date" value={drawDate} onChange={(event) => setDrawDate(event.target.value)} className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/70" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2" htmlFor="publish-round-number-0">6 dezenas (01 - 60)</label>
            <div className="flex justify-between gap-1.5 sm:gap-2">
              {numbers.map((value, index) => (
                <input key={index} id={`publish-round-number-${index}`} type="text" inputMode="numeric" maxLength={2} value={value} onChange={(event) => handleNumberChange(index, event.target.value)} className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-950 border border-slate-700/80 rounded-2xl text-center text-sm sm:text-base font-black text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/70 font-mono" placeholder="00" aria-label={`Dezena ${index + 1}`} />
              ))}
            </div>
          </div>
          <div className="bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed space-y-1">
            {category.currentRound === 0 && !isCorrection && <p>Esta é a primeira rodada: publicar as dezenas <strong>encerra a venda de novas cotas</strong> deste bolão.</p>}
            <p>O bolão só é encerrado quando alguma cota completar os <strong>6 acertos acumulados</strong>. Publicar a rodada não apura o bolão automaticamente.</p>
            {isCorrection && <p>A correção é permitida apenas enquanto o bolão não estiver apurado.</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl text-sm transition flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-emerald-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70">
            {isSubmitting ? <><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i><span role="status">Publicando...</span></> : <><i className="fa-solid fa-check" aria-hidden="true"></i><span>{isCorrection ? 'Salvar correção' : 'Publicar rodada'}</span></>}
          </button>
        </form>
      </div>
    </div>
  );
}
