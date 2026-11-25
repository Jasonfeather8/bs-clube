import { useNavigate } from 'react-router-dom';
import { useMeusJogos, MeusJogosFilter } from './MeusJogos/hooks/useMeusJogos';
import BetCard from './MeusJogos/components/BetCard';
import BetDetailModal from './MeusJogos/components/BetDetailModal';

const FILTERS: { key: MeusJogosFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'running', label: 'Em andamento' },
  { key: 'result', label: 'Com resultado' },
  { key: 'prized', label: 'Premiadas' },
];

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SummaryCard({ label, value, icon, valueClass = 'text-white' }: { label: string; value: string; icon: string; valueClass?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <i className={`fa-solid ${icon} text-emerald-400 text-xs`} aria-hidden="true"></i>
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-1.5 text-lg font-black font-mono ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function MeusJogos() {
  const navigate = useNavigate();
  const { bets, filteredBets, summary, isLoading, isError, refetch, filter, setFilter, selectedBet, setSelectedBet } = useMeusJogos();

  return (
    <div className="min-h-screen bg-brand-dark pb-32">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <i className="fa-solid fa-ticket" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-heading text-2xl font-black text-white">Meus Jogos</h3>
            <p className="text-xs text-slate-400">Suas apostas, resultados e prêmios com total transparência</p>
          </div>
        </div>

        {!isError && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Cartelas" value={String(summary.betsCount)} icon="fa-dice" />
            <SummaryCard label="Total apostado" value={formatCurrency(summary.totalWagered)} icon="fa-coins" />
            <SummaryCard label="Prêmios" value={String(summary.prizesCount)} icon="fa-trophy" valueClass="text-amber-300" />
            <SummaryCard label="Valor em prêmios" value={formatCurrency(summary.prizesAmount)} icon="fa-sack-dollar" valueClass="text-amber-300" />
          </div>
        )}

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtro de apostas">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400/70 ${
                filter === item.key ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950/70 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/90 p-5 animate-pulse space-y-3">
                <div className="h-4 w-40 bg-slate-800 rounded"></div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map((chip) => (
                    <div key={chip} className="w-7 h-7 rounded-lg bg-slate-800"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="bg-red-950/40 border border-red-800/80 rounded-2xl p-6 text-center text-red-300 space-y-3">
            <i className="fa-solid fa-triangle-exclamation text-2xl text-red-400" aria-hidden="true" />
            <p className="text-sm font-semibold">Não foi possível carregar suas apostas.</p>
            <button onClick={() => refetch()} className="px-4 py-2 bg-red-900/60 hover:bg-red-800 text-white rounded-xl text-xs font-bold transition cursor-pointer">
              Tentar novamente
            </button>
          </div>
        )}

        {!isLoading && !isError && bets.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-10 text-center space-y-4">
            <i className="fa-solid fa-ticket-simple text-3xl text-slate-600" aria-hidden="true"></i>
            <div>
              <p className="text-sm font-bold text-white">Você ainda não participa de nenhum bolão</p>
              <p className="text-xs text-slate-400 mt-1">Escolha um bolão aberto e garanta suas cotas.</p>
            </div>
            <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer">
              Ver bolões disponíveis
            </button>
          </div>
        )}

        {!isLoading && !isError && bets.length > 0 && filteredBets.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-10 text-center text-xs text-slate-400">
            Nenhuma aposta encontrada neste filtro.
          </div>
        )}

        {!isLoading && !isError && filteredBets.length > 0 && (
          <div className="space-y-3">
            {filteredBets.map((bet) => (
              <BetCard key={bet.betId} bet={bet} onOpen={setSelectedBet} />
            ))}
          </div>
        )}
      </main>

      <BetDetailModal isOpen={Boolean(selectedBet)} bet={selectedBet} onClose={() => setSelectedBet(null)} />
    </div>
  );
}
