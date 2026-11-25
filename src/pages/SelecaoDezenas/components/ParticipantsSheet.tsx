import React, { useEffect, useRef, useState } from 'react';
import { RankingParticipant } from '../../../types';
import PoolRankingTable from '../../../components/PoolRankingTable';

interface ParticipantsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  bolaoName: string;
  vagasPreenchidas: number;
  vagasTotal: number;
  participants: RankingParticipant[];
  isLoading: boolean;
  isError?: boolean;
}

export default function ParticipantsSheet({
  isOpen,
  onClose,
  bolaoName,
  vagasPreenchidas,
  vagasTotal,
  participants,
  isLoading,
  isError = false,
}: ParticipantsSheetProps) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);

    if (isOpen) {
      setIsVisible(false);
      setIsMounted(true);
      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = requestAnimationFrame(() => setIsVisible(true));
      });
    } else if (isMounted) {
      setIsVisible(false);
      closeTimerRef.current = setTimeout(() => setIsMounted(false), 300);
    }

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsMounted(false);
      onClose();
    }, 300);
  };

  if (!isMounted) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="participants-sheet-title">
      <div
        className={`absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className={`absolute bottom-0 left-0 w-full bg-slate-900 border-t border-slate-700 rounded-t-3xl transition-transform duration-300 ease-out max-h-[85vh] overflow-y-auto ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-3 mb-5" />
        <div className="px-6 pb-8 max-w-4xl mx-auto">
          <div className="flex justify-between items-start gap-4 mb-5">
            <div>
              <h2 id="participants-sheet-title" className="font-heading text-xl font-black text-white">Participantes do bolão</h2>
              <p className="mt-1 text-sm text-slate-400">{bolaoName}</p>
              <p className="mt-2 text-xs text-slate-400">Vagas Preenchidas: <span className="font-bold text-white">{vagasPreenchidas}/{vagasTotal} cotas</span></p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar"
              className="w-8 h-8 shrink-0 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
          {isError ? (
            <div role="status" className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-5 text-center text-sm text-amber-200/90">
              Não foi possível carregar os participantes.
            </div>
          ) : (
            <PoolRankingTable
              ranking={participants}
              isLoading={isLoading}
              showPrize={false}
              ariaLabel="Participantes do bolão"
            />
          )}
        </div>
      </div>
    </div>
  );
}
