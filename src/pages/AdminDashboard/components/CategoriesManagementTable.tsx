import React from 'react';
import AdminPagination from '../../../components/AdminPagination';
import { AdminCategory, AdminCategoryStatus } from '../../../types';

interface CategoriesManagementTableProps {
  categories: AdminCategory[];
  totalCount: number;
  page: number;
  totalPages: number;
  statusFilter: AdminCategoryStatus;
  monthFilter: string;
  onPageChange: (page: number) => void;
  onStatusFilterChange: (status: AdminCategoryStatus) => void;
  onMonthFilterChange: (month: string) => void;
  isLoading: boolean;
  onOpenNewCategory: () => void;
  onOpenPrizeSettings: () => void;
  onOpenManualDraw: () => void;
  onEditCategory: (category: AdminCategory) => void;
  onPublishRound: (category: AdminCategory) => void;
  onViewResult: (category: AdminCategory) => void;
  onViewDetails: (category: AdminCategory) => void;
  onToggleCategoryStatus: (category: AdminCategory) => void;
  onDeleteCategory: (category: AdminCategory) => void;
  isBusy?: boolean;
}

export default function CategoriesManagementTable({
  categories,
  totalCount,
  page,
  totalPages,
  statusFilter,
  monthFilter,
  onPageChange,
  onStatusFilterChange,
  onMonthFilterChange,
  isLoading,
  onOpenNewCategory,
  onOpenPrizeSettings,
  onOpenManualDraw,
  onEditCategory,
  onPublishRound,
  onViewResult,
  onViewDetails,
  onToggleCategoryStatus,
  onDeleteCategory,
  isBusy = false,
}: CategoriesManagementTableProps) {
  const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const filterClass = (filter: AdminCategoryStatus) =>
    `rounded-xl px-4 py-3 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 cursor-pointer ${
      statusFilter === filter ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h4 className="font-heading font-bold text-white text-base">Bolões</h4>
          <p className="text-xs text-slate-400">Gerencie os bolões disponíveis e publique rodadas. Clique em um bolão para ver os apostadores.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={onOpenManualDraw} className="border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 cursor-pointer">
            <i className="fa-solid fa-bullhorn text-xs"></i><span>Registrar sorteio oficial</span>
          </button>
          <button type="button" onClick={onOpenPrizeSettings} className="border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 cursor-pointer">
            <i className="fa-solid fa-sliders text-xs"></i><span>Configuração global</span>
          </button>
          <button type="button" onClick={onOpenNewCategory} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/30 cursor-pointer">
            <i className="fa-solid fa-plus text-xs"></i><span>Novo Bolão</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-2xl border border-slate-800 bg-slate-950/80 p-1" role="tablist" aria-label="Filtro de status dos bolões">
          <button type="button" onClick={() => onStatusFilterChange('open')} className={filterClass('open')}>Abertos</button>
          <button type="button" onClick={() => onStatusFilterChange('closed')} className={filterClass('closed')}>Finalizados</button>
          <button type="button" onClick={() => onStatusFilterChange('completed')} className={filterClass('completed')}>Concluídos</button>
          <button type="button" onClick={() => onStatusFilterChange('inactive')} className={filterClass('inactive')}>Inativos</button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <span>Mês</span>
          <input type="month" value={monthFilter} onChange={(event) => onMonthFilterChange(event.target.value)} className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-slate-200 focus:border-emerald-400 focus:outline-none" />
        </label>
        {monthFilter && (
          <button type="button" onClick={() => onMonthFilterChange('')} className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-emerald-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 cursor-pointer">Todos os meses</button>
        )}
      </div>

      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead><tr className="bg-slate-900/60 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              <th className="p-4">Nome do Bolão</th><th className="p-4 text-center">Concurso</th><th className="p-4 text-center">Cota</th><th className="p-4 text-center">Vagas</th><th className="p-4 text-center">Data</th><th className="p-4 text-center">Resultado</th><th className="p-4 text-center">Ações</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-xs"><i className="fa-solid fa-circle-notch fa-spin text-emerald-400 text-base mr-2"></i>Carregando bolões...</td></tr> : categories.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-xs">Nenhum bolão cadastrado no momento.</td></tr> : categories.map((category) => {
                const progress = category.vagas > 0 ? Math.min((category.filled / category.vagas) * 100, 100) : 0;
                const completed = category.poolStatus === 'completed';
                const closed = category.poolStatus === 'closed';
                const inactive = category.poolStatus === 'inactive';
                const openDetails = () => onViewDetails(category);
                return <tr
                  key={category.id}
                  className="hover:bg-slate-800/40 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                  onClick={openDetails}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openDetails();
                    }
                  }}
                  tabIndex={0}
                  title={`Ver apostadores de ${category.name}`}
                  aria-label={`Ver apostadores de ${category.name}`}
                >
                  <td className="p-4 font-bold text-white"><div className="flex items-center space-x-2"><div className={`w-2 h-2 rounded-full ${completed ? 'bg-amber-400' : inactive ? 'bg-slate-500' : 'bg-emerald-400'}`}></div><span>{category.name}</span></div></td>
                  <td className="p-4 text-center text-slate-300 font-mono"><div>#{category.concurso || '—'}</div><div className="mt-1 text-[10px] text-slate-500">Rodada {category.currentRound}/{category.maxRounds}</div></td>
                  <td className="p-4 text-center font-bold text-emerald-400 font-mono">{formatCurrency(category.cota)}</td>
                  <td className="p-4 text-center text-slate-300"><div className="flex flex-col items-center justify-center w-24 mx-auto"><span className="text-xs font-bold font-mono">{category.filled} <span className="text-slate-500 font-normal">/ {category.vagas}</span></span><div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-brand-accent rounded-full" style={{ width: `${progress}%` }}></div></div></div></td>
                  <td className="p-4 text-center text-slate-300 text-xs font-mono">{category.drawDate || '—'}</td>
                  <td className="p-4 text-center">{completed ? <div className="flex flex-col items-center gap-1"><span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/20">Concluído</span><div className="flex gap-0.5">{(category.numbers ?? []).map((number) => <span key={number} className="text-[9px] text-amber-300 font-mono">{String(number).padStart(2, '0')}</span>)}</div></div> : closed ? <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-500/20">{category.currentRound > 0 ? 'Em andamento' : 'Vagas preenchidas'}</span> : inactive ? <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-700">Inativo</span> : category.poolStatus === 'late_registration' ? <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-500/20">Reg. Tardio</span> : <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-blue-500/20">Aberto</span>}</td>
                  <td className="p-4" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-center gap-2">
                      {!completed && !closed && !inactive && <button type="button" onClick={() => onEditCategory(category)} disabled={isBusy} className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-emerald-400 text-[10px] font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Editar ${category.name}`}><i className="fa-solid fa-pen"></i></button>}
                      {!completed && !inactive && <button type="button" onClick={() => onPublishRound(category)} disabled={isBusy} className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-[10px] font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-50">Publicar rodada</button>}
                      {!completed && !inactive && <button type="button" onClick={() => onToggleCategoryStatus(category)} disabled={isBusy} className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-rose-400 text-[10px] font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Desativar ${category.name}`} title="Desativar"><i className="fa-solid fa-ban"></i></button>}
                      {inactive && <button type="button" onClick={() => onToggleCategoryStatus(category)} disabled={isBusy} className="px-2.5 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 text-[10px] font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Reativar ${category.name}`} title="Reativar"><i className="fa-solid fa-rotate-left"></i></button>}
                      {!completed && <button type="button" onClick={() => { if (window.confirm(`Excluir o bolão "${category.name}"? Esta ação não pode ser desfeita.`)) onDeleteCategory(category); }} disabled={isBusy} className="px-2.5 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-[10px] font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Excluir ${category.name}`} title="Excluir"><i className="fa-solid fa-trash"></i></button>}
                      {completed && <button type="button" onClick={() => onViewResult(category)} disabled={isBusy} className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-amber-400 text-[10px] font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Ver resultado de ${category.name}`} title="Ver resultado"><i className="fa-solid fa-eye"></i></button>}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <AdminPagination itemCount={categories.length} totalCount={totalCount} page={page} totalPages={totalPages} itemLabel="bolões" ariaLabel="Paginação de bolões" onPageChange={onPageChange} />
      </div>
    </div>
  );
}
