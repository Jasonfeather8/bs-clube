import React, { useEffect, useMemo, useState } from 'react';
import AdminPagination from '../../../components/AdminPagination';
import { AdminCategory, AdminPoolDetail, AdminRound } from '../../../types';

interface AdminPoolDetailModalProps {
  isOpen: boolean;
  category: AdminCategory | null;
  detail: AdminPoolDetail | undefined;
  isLoading: boolean;
  error: unknown;
  onClose: () => void;
  onPublishRound: () => void;
  onCorrectRound: (round: AdminRound) => void;
}

const PAGE_SIZE = 10;

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

function statusLabel(status: string, currentRound = 0) {
  switch (status) {
    case 'open':
      return { label: 'Aberto', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    case 'late_registration':
      return { label: 'Reg. Tardio', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'closed':
      return { label: currentRound > 0 ? 'Em andamento' : 'Vagas preenchidas', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'completed':
      return { label: 'Concluído', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'inactive':
      return { label: 'Inativo', className: 'bg-slate-800 text-slate-400 border-slate-700' };
    default:
      return { label: status || '—', className: 'bg-slate-800 text-slate-400 border-slate-700' };
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Tente novamente.';
}

// Prefixa células que começam com caracteres de fórmula para evitar injeção em planilhas.
function csvCell(value: string | number) {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function DetailMetric({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function AdminPoolDetailModal({ isOpen, category, detail, isLoading, error, onClose, onPublishRound, onCorrectRound }: AdminPoolDetailModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSearchTerm('');
    setPage(1);
  }, [category?.poolId]);

  const participants = detail?.participants ?? [];
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return participants;
    return participants.filter((participant) => {
      const numbersText = participant.numbers.map((number) => String(number).padStart(2, '0')).join(' ');
      return (
        participant.name.toLowerCase().includes(term) ||
        participant.phone.toLowerCase().includes(term) ||
        participant.cpf.toLowerCase().includes(term) ||
        participant.email.toLowerCase().includes(term) ||
        numbersText.includes(term)
      );
    });
  }, [detail, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rounds = [...(detail?.rounds ?? [])].sort((a, b) => a.roundNumber - b.roundNumber);
  const hasResult = rounds.length > 0;
  const currentRound = detail?.pool.currentRound ?? category?.currentRound ?? 0;
  const maxRounds = detail?.pool.maxRounds ?? category?.maxRounds ?? 20;
  const poolStatus = detail?.pool.status ?? category?.poolStatus ?? '';
  const status = statusLabel(poolStatus, currentRound);
  // Dezenas que já saíram em qualquer rodada publicada (união, sem repetição).
  const drawnNumbers = new Set(rounds.flatMap((round) => round.numbers));
  const publishDisabledReason = poolStatus === 'completed'
    ? 'Bolão apurado — não aceita novas rodadas'
    : poolStatus === 'inactive'
      ? 'Bolão inativo — reative para publicar rodadas'
      : currentRound >= maxRounds
        ? `Limite de ${maxRounds} rodadas atingido`
        : (detail?.pool.filledSlots ?? category?.filled ?? 0) === 0
          ? 'Nenhuma cota vendida ainda'
          : '';

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const header = ['Apostador', 'Telefone', 'CPF', 'E-mail', 'Cartela', 'Valor (R$)', 'Data/Hora', 'Acertos', 'Prêmio (R$)'];
    const rows = filtered.map((participant) => [
      participant.name,
      participant.phone,
      participant.cpf,
      participant.email,
      participant.numbers.map((number) => String(number).padStart(2, '0')).join(' '),
      participant.cotaPrice.toFixed(2).replace('.', ','),
      formatDateTime(participant.createdAt),
      hasResult ? String(participant.hits) : '',
      participant.prizeAmount > 0 ? participant.prizeAmount.toFixed(2).replace('.', ',') : '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `apostadores-${(detail?.pool.name ?? 'bolao').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-pool-detail-title">
      <div className="glass-card w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-emerald-500/30 p-5 sm:p-6 relative shadow-2xl">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded" aria-label="Fechar detalhe do bolão">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="mb-5 border-b border-slate-800 pb-4 pr-8">
          <h3 id="admin-pool-detail-title" className="font-heading text-xl font-bold text-white flex items-center flex-wrap gap-2">
            <i className="fa-solid fa-users-viewfinder text-emerald-400 text-lg"></i>
            <span>{category.name}</span>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${status.className}`}>{status.label}</span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Rodada {detail?.pool.currentRound ?? category.currentRound} de {detail?.pool.maxRounds ?? category.maxRounds}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">Concurso {category.concurso || 'não informado'} · Apostadores e detalhes do bolão</p>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-10 text-center text-slate-300" role="status">
            <i className="fa-solid fa-circle-notch fa-spin text-emerald-400 text-xl mr-2"></i>Carregando apostadores...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-300" role="alert">
            <i className="fa-solid fa-circle-exclamation mr-2"></i>Não foi possível carregar os apostadores deste bolão. {getErrorMessage(error)}
          </div>
        )}

        {!isLoading && !error && detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DetailMetric label="Cota" value={formatCurrency(detail.pool.buyIn)} valueClass="text-emerald-400" />
              <DetailMetric label="Vagas" value={`${detail.pool.filledSlots} / ${detail.pool.totalSlots}`} />
              <DetailMetric label="Criado em" value={formatDate(detail.pool.createdAt ?? '')} />
              <DetailMetric label="Prêmio estimado" value={formatCurrency(detail.pool.prizeEstimate)} valueClass="text-brand-gold" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DetailMetric label="Apostadores" value={String(detail.totals.participantsCount)} />
              <DetailMetric label="Cartelas" value={String(detail.totals.betsCount)} />
              <DetailMetric label="Total arrecadado" value={formatCurrency(detail.totals.grossAmount)} valueClass="text-emerald-400" />
              <DetailMetric
                label={detail.settlement ? 'Prêmios pagos' : 'Rateio (casa/ganhadores)'}
                value={detail.settlement ? formatCurrency(detail.settlement.winnersAmount) : `${detail.pool.housePercentage}% / ${detail.pool.winnerPercentage}%`}
                valueClass={detail.settlement ? 'text-amber-300' : 'text-slate-200'}
              />
              {detail.pool.settledAt && <DetailMetric label="Concluído em" value={formatDateTime(detail.pool.settledAt)} />}
            </div>

            <section className="space-y-3" aria-labelledby="pool-detail-rounds-title">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 id="pool-detail-rounds-title" className="font-heading font-bold text-white">Rodadas</h4>
                  <p className="text-xs text-slate-400">{rounds.length} de {maxRounds} publicada(s)</p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-1">
                  <button type="button" onClick={onPublishRound} disabled={Boolean(publishDisabledReason)} className="rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70">
                    <i className="fa-solid fa-bullhorn mr-2" aria-hidden="true"></i>Publicar próxima rodada
                  </button>
                  {publishDisabledReason && (
                    <span className="text-[11px] text-amber-300/90" role="status">{publishDisabledReason}</span>
                  )}
                </div>
              </div>
              {rounds.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-center text-sm text-slate-400" role="status">Nenhuma rodada publicada ainda.</div>
              ) : rounds.map((round) => (
                <article key={round.id} className="rounded-2xl border border-amber-500/25 bg-slate-950/60 p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h5 className="font-heading font-bold text-white">Rodada {round.roundNumber} · Concurso {round.contest}</h5>
                      <p className="mt-1 text-xs text-slate-400">Data do sorteio: {formatDate(round.drawDate)}</p>
                      <p className="mt-1 text-xs text-slate-400">Publicado em: {formatDateTime(round.publishedAt)}</p>
                    </div>
                    {detail.pool.status !== 'completed' && <button type="button" onClick={() => onCorrectRound(round)} className="self-start rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70">Corrigir</button>}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2 sm:gap-3">
                    {round.numbers.map((number, index) => (
                      <div key={`${number}-${index}`} className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-heading font-black text-base sm:text-lg shadow-lg shadow-amber-900/30">{String(number).padStart(2, '0')}</div>
                    ))}
                  </div>
                </article>
              ))}
            </section>

            <section aria-labelledby="pool-detail-participants-title">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div>
                  <h4 id="pool-detail-participants-title" className="font-heading font-bold text-white">Apostadores</h4>
                  <p className="text-xs text-slate-500">Em verde, as dezenas que já saíram em alguma rodada · clique em exportar para baixar a lista em CSV.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <i className="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs" aria-hidden="true"></i>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }}
                      placeholder="Buscar por nome, telefone, CPF ou dezena..."
                      aria-label="Buscar apostador"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={exportCsv}
                    disabled={filtered.length === 0}
                    className="rounded-xl border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 px-3 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                  >
                    <i className="fa-solid fa-file-csv" aria-hidden="true"></i><span>Exportar</span>
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-900/60 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        <th className="p-4">Apostador</th>
                        <th className="p-4">Cartela</th>
                        <th className="p-4 text-right">Valor</th>
                        <th className="p-4 text-center">Data</th>
                        <th className="p-4 text-center">Acertos</th>
                        <th className="p-4 text-right">Prêmio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-sm">
                      {pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                            {participants.length === 0 ? 'Este bolão ainda não possui apostadores.' : 'Nenhum apostador encontrado para esta busca.'}
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((participant) => (
                          <tr key={participant.betId} className="hover:bg-slate-800/40 transition">
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[11px] text-slate-400 shrink-0">
                                  <i className="fa-solid fa-user" aria-hidden="true"></i>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-white truncate">{participant.name}</p>
                                  <p className="text-[11px] text-slate-500 font-mono">{participant.phone || participant.email || '—'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1" role="img" aria-label={`Cartela ${participant.numbers.map((number) => String(number).padStart(2, '0')).join(', ')}`}>
                                {participant.numbers.map((number) => {
                                  const drawn = hasResult && drawnNumbers.has(number);
                                  return (
                                    <span
                                      key={number}
                                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-mono font-bold ${
                                        drawn ? 'bg-emerald-500 text-slate-950' : 'border border-slate-700 bg-slate-800 text-slate-300'
                                      }`}
                                    >
                                      {String(number).padStart(2, '0')}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-4 text-right text-slate-300 font-mono text-xs">{formatCurrency(participant.cotaPrice)}</td>
                            <td className="p-4 text-center text-slate-400 text-xs font-mono">{formatDateTime(participant.createdAt)}</td>
                            <td className="p-4 text-center">
                              {hasResult ? (
                                <span className={`text-xs font-bold ${participant.hits >= 6 ? 'text-amber-300' : 'text-slate-400'}`}>{participant.hits}/6</span>
                              ) : (
                                <span className="text-slate-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {participant.prizeAmount > 0 ? (
                                <span className="text-amber-300 font-bold font-mono text-xs">{formatCurrency(participant.prizeAmount)}</span>
                              ) : (
                                <span className="text-slate-600 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <AdminPagination
                  itemCount={pageItems.length}
                  totalCount={filtered.length}
                  page={safePage}
                  totalPages={totalPages}
                  itemLabel="cartelas"
                  ariaLabel="Paginação de apostadores do bolão"
                  onPageChange={setPage}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
