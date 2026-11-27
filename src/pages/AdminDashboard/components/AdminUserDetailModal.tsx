import React, { useEffect, useState } from 'react';
import { AdminUser, AdminUserDetail } from '../../../types';

interface AdminUserDetailModalProps {
  isOpen: boolean;
  user: AdminUser | null;
  detail: AdminUserDetail | undefined;
  isLoading: boolean;
  error: unknown;
  isTogglingStatus: boolean;
  onToggleStatus: (id: number | string) => void;
  onClose: () => void;
}

type TabKey = 'resumo' | 'apostas' | 'premios' | 'saques' | 'extrato';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'resumo', label: 'Resumo', icon: 'fa-id-card' },
  { key: 'apostas', label: 'Apostas', icon: 'fa-dice' },
  { key: 'premios', label: 'Prêmios', icon: 'fa-trophy' },
  { key: 'saques', label: 'Saques', icon: 'fa-money-bill-transfer' },
  { key: 'extrato', label: 'Extrato', icon: 'fa-receipt' },
];

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedCurrency(value: number) {
  return `${value < 0 ? '-' : '+'} ${formatCurrency(Math.abs(value))}`;
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

function formatNumbers(numbers: number[]) {
  return numbers.map((number) => String(number).padStart(2, '0')).join(' · ') || '—';
}

function formatCpf(value: string | null) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return value || '—';
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string | null) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || '—';
}

function withdrawalStatusLabel(status: string) {
  switch (status) {
    case 'approved':
      return { label: 'Aprovado', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'rejected':
      return { label: 'Rejeitado', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    default:
      return { label: 'Pendente', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  }
}

function transactionStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return { label: 'Pendente', className: 'text-amber-400' };
    case 'failed':
      return { label: 'Falhou', className: 'text-rose-400' };
    case 'reversed':
      return { label: 'Estornado', className: 'text-slate-400' };
    default:
      return { label: 'Concluído', className: 'text-emerald-400' };
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Tente novamente.';
}

function Metric({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8 text-center text-xs text-slate-400">{message}</div>;
}

export default function AdminUserDetailModal({
  isOpen,
  user,
  detail,
  isLoading,
  error,
  isTogglingStatus,
  onToggleStatus,
  onClose,
}: AdminUserDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('resumo');

  useEffect(() => {
    setActiveTab('resumo');
  }, [user?.id]);

  if (!isOpen || !user) return null;

  const displayName = detail?.profile.fullName || user.name || 'Apostador';
  const initials = displayName.substring(0, 2).toUpperCase();
  const safeAvatarUrl = detail?.profile.avatarUrl && /^https?:\/\//i.test(detail.profile.avatarUrl) ? detail.profile.avatarUrl : null;
  const isActive = detail?.profile.isActive ?? user.active;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-user-detail-title">
      <div className="glass-card w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-emerald-500/30 p-5 sm:p-6 relative shadow-2xl">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded" aria-label="Fechar detalhe do apostador">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="mb-5 border-b border-slate-800 pb-4 pr-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-lg overflow-hidden shrink-0">
                {safeAvatarUrl ? <img src={safeAvatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
              </div>
              <div className="min-w-0">
                <h3 id="admin-user-detail-title" className="font-heading text-lg font-bold text-white flex items-center flex-wrap gap-2">
                  <span className="truncate">{displayName}</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                    {isActive ? 'Ativo' : 'Bloqueado'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{detail?.profile.email || user.phone || 'Apostador'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleStatus(user.id)}
              disabled={isTogglingStatus}
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 shrink-0 ${isActive ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10' : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'}`}
            >
              <i className={`fa-solid ${isActive ? 'fa-ban' : 'fa-unlock'}`} aria-hidden="true"></i>
              <span>{isActive ? 'Bloquear' : 'Desbloquear'}</span>
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-10 text-center text-slate-300" role="status">
            <i className="fa-solid fa-circle-notch fa-spin text-emerald-400 text-xl mr-2"></i>Carregando detalhes do apostador...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-300" role="alert">
            <i className="fa-solid fa-circle-exclamation mr-2"></i>Não foi possível carregar os detalhes deste apostador. {getErrorMessage(error)}
          </div>
        )}

        {!isLoading && !error && detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Metric label="Saldo total" value={formatCurrency(detail.wallet.total)} valueClass="text-emerald-400" />
              <Metric label="Saldo sacável" value={formatCurrency(detail.wallet.withdrawable)} />
              <Metric label="Bônus" value={formatCurrency(detail.wallet.bonus)} valueClass="text-amber-300" />
            </div>

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seções do detalhe do apostador">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400/70 ${
                    activeTab === tab.key ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950/70 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} aria-hidden="true"></i>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {activeTab === 'resumo' && (
              <div role="tabpanel" className="space-y-5">
                <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
                  <h4 className="font-heading font-bold text-white mb-3">Dados cadastrais</h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="flex justify-between gap-3 border-b border-slate-800/60 py-1.5"><dt className="text-slate-500">E-mail</dt><dd className="text-slate-200 font-semibold truncate">{detail.profile.email || '—'}</dd></div>
                    <div className="flex justify-between gap-3 border-b border-slate-800/60 py-1.5"><dt className="text-slate-500">Telefone</dt><dd className="text-slate-200 font-semibold">{formatPhone(detail.profile.phone)}</dd></div>
                    <div className="flex justify-between gap-3 border-b border-slate-800/60 py-1.5"><dt className="text-slate-500">CPF</dt><dd className="text-slate-200 font-semibold">{formatCpf(detail.profile.cpf)}</dd></div>
                    <div className="flex justify-between gap-3 border-b border-slate-800/60 py-1.5"><dt className="text-slate-500">Chave Pix</dt><dd className="text-slate-200 font-semibold truncate">{detail.profile.pixKey ? `${detail.profile.pixKeyType || 'pix'} · ${detail.profile.pixKey}` : '—'}</dd></div>
                    <div className="flex justify-between gap-3 border-b border-slate-800/60 py-1.5"><dt className="text-slate-500">Cadastro</dt><dd className="text-slate-200 font-semibold">{formatDateTime(detail.profile.createdAt)}</dd></div>
                    <div className="flex justify-between gap-3 border-b border-slate-800/60 py-1.5"><dt className="text-slate-500">Identificador</dt><dd className="text-slate-400 font-mono text-[11px] truncate">{detail.profile.id}</dd></div>
                  </dl>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
                  <h4 className="font-heading font-bold text-white mb-3">Histórico financeiro</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Metric label="Depósitos" value={formatCurrency(detail.stats.depositsTotal)} valueClass="text-emerald-400" />
                    <Metric label="Total apostado" value={formatCurrency(detail.stats.totalWagered)} />
                    <Metric label="Prêmios ganhos" value={formatCurrency(detail.stats.prizesAmount)} valueClass="text-amber-300" />
                    <Metric label="Total sacado" value={formatCurrency(detail.stats.withdrawalsPaid)} />
                    <Metric label="Cartelas" value={String(detail.stats.betsCount)} />
                    <Metric label="Prêmios" value={String(detail.stats.prizesCount)} />
                    <Metric label="Saques" value={String(detail.stats.withdrawalsCount)} />
                    <Metric label="Carteira criada" value={formatDate(detail.wallet.createdAt ?? '')} />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'apostas' && (
              <div role="tabpanel">
                {detail.bets.length === 0 ? (
                  <EmptyState message="Este apostador ainda não realizou nenhuma aposta." />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-900/60 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                            <th className="p-4">Bolão</th>
                            <th className="p-4">Cartela</th>
                            <th className="p-4 text-right">Valor</th>
                            <th className="p-4 text-center">Data</th>
                            <th className="p-4 text-center">Acertos</th>
                            <th className="p-4 text-right">Prêmio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                          {detail.bets.map((bet) => (
                            <tr key={bet.betId} className="hover:bg-slate-800/40 transition">
                              <td className="p-4">
                                <p className="font-bold text-white">{bet.poolName}</p>
                                <p className="text-[11px] text-slate-500 font-mono">#{bet.contest || '—'} · {formatDate(bet.drawDate)}</p>
                              </td>
                              <td className="p-4"><span className="text-emerald-400 font-mono text-xs">{formatNumbers(bet.numbers)}</span></td>
                              <td className="p-4 text-right text-slate-300 font-mono text-xs">{formatCurrency(bet.cotaPrice)}</td>
                              <td className="p-4 text-center text-slate-400 text-xs font-mono">{formatDateTime(bet.createdAt)}</td>
                              <td className="p-4 text-center">
                                {bet.roundsPublished > 0 ? (
                                  <span className={`text-xs font-bold ${bet.hits >= bet.goal ? 'text-amber-300' : 'text-slate-400'}`}>{bet.hits}/{bet.goal}</span>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                {bet.prizeAmount > 0 ? (
                                  <span className="text-amber-300 font-bold font-mono text-xs">{formatCurrency(bet.prizeAmount)}</span>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'premios' && (
              <div role="tabpanel">
                {detail.prizes.length === 0 ? (
                  <EmptyState message="Este apostador ainda não ganhou nenhum prêmio." />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-900/60 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                            <th className="p-4">Bolão</th>
                            <th className="p-4 text-center">Acertos</th>
                            <th className="p-4 text-right">Valor</th>
                            <th className="p-4 text-center">Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                          {detail.prizes.map((prize) => (
                            <tr key={prize.awardId} className="hover:bg-slate-800/40 transition">
                              <td className="p-4 font-bold text-white">{prize.poolName}</td>
                              <td className="p-4 text-center text-amber-300 text-xs font-bold">{prize.hits}</td>
                              <td className="p-4 text-right text-amber-300 font-bold font-mono text-xs">{formatCurrency(prize.amount)}</td>
                              <td className="p-4 text-center text-slate-400 text-xs font-mono">{formatDateTime(prize.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'saques' && (
              <div role="tabpanel">
                {detail.withdrawals.length === 0 ? (
                  <EmptyState message="Este apostador ainda não solicitou nenhum saque." />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-900/60 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                            <th className="p-4 text-right">Valor</th>
                            <th className="p-4">Chave Pix</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-center">Solicitado</th>
                            <th className="p-4 text-center">Revisado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                          {detail.withdrawals.map((withdrawal) => {
                            const status = withdrawalStatusLabel(withdrawal.status);
                            return (
                              <tr key={withdrawal.id} className="hover:bg-slate-800/40 transition">
                                <td className="p-4 text-right text-slate-200 font-bold font-mono text-xs">{formatCurrency(withdrawal.amount)}</td>
                                <td className="p-4 text-slate-400 text-xs"><span className="uppercase text-slate-500">{withdrawal.pixKeyType}</span> · {withdrawal.pixKey}</td>
                                <td className="p-4 text-center"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${status.className}`}>{status.label}</span></td>
                                <td className="p-4 text-center text-slate-400 text-xs font-mono">{formatDateTime(withdrawal.createdAt)}</td>
                                <td className="p-4 text-center text-slate-400 text-xs font-mono">{formatDateTime(withdrawal.reviewedAt ?? '')}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'extrato' && (
              <div role="tabpanel">
                {detail.transactions.length === 0 ? (
                  <EmptyState message="Nenhuma movimentação registrada na carteira." />
                ) : (
                  <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                    {detail.transactions.map((transaction) => {
                      const status = transactionStatusLabel(transaction.status);
                      const positive = transaction.amount >= 0;
                      return (
                        <li key={transaction.id} className="flex items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{transaction.title}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{formatDateTime(transaction.createdAt)} · <span className={status.className}>{status.label}</span></p>
                          </div>
                          <span className={`text-sm font-bold font-mono shrink-0 ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>{formatSignedCurrency(transaction.amount)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
